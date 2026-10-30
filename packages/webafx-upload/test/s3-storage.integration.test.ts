import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createImagePolicy } from '@blendsdk/upload-core';
import { SharpImageProcessor } from '../src/processors.js';
import { createS3UploadStorage } from '../src/s3-storage.js';
import type { UploadSessionRecord } from '../src/types.js';

const enabled = process.env.S3_INTEGRATION === '1';
const endpoint = process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9090';
const bucket = process.env.S3_BUCKET ?? 'uploads-test';
const config: S3ClientConfig = {
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'test',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'test',
  },
};
const client = new S3Client(config);
const roots: string[] = [];

async function ensureBucket(): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks);
}

afterAll(async () => {
  client.destroy();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.skipIf(!enabled)('S3UploadStorage integration', () => {
  beforeAll(ensureBucket);

  it('moves, reads, ranges and deletes objects through S3', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-s3-integration-'));
    roots.push(root);
    const source = path.join(root, 'source.txt');
    await writeFile(source, 'hello s3mock');
    const scope = `integration-${randomUUID()}`;
    const storage = await createS3UploadStorage({
      bucket,
      prefix: `tests/${scope}`,
      localRoot: root,
      clientConfig: config,
    });

    const staged = storage.stagingPath(scope, 'file-1', '.txt');
    await storage.move(source, staged);
    expect(await storage.exists(staged)).toBe(true);
    expect(await storage.exists(source)).toBe(false);

    const originalKey = storage.finalPath(scope, 'file-1', 'original', '.txt');
    await storage.move(staged, originalKey);
    expect(await storage.exists(originalKey)).toBe(true);
    expect(await storage.exists(staged)).toBe(false);
    await expect(storage.stat(originalKey)).resolves.toEqual({ size: 12 });
    expect((await readAll(await storage.readStream(originalKey))).toString()).toBe('hello s3mock');

    const variantKey = storage.finalPath(scope, 'file-1', 'display', '.webp');
    await storage.write(variantKey, Buffer.from('0123456789'));
    expect(
      (await readAll(await storage.readStream(variantKey, { start: 2, end: 5 }))).toString(),
    ).toBe('2345');

    await storage.delete(originalKey);
    await storage.delete(variantKey);
    expect(await storage.exists(originalKey)).toBe(false);
    expect(await storage.exists(variantKey)).toBe(false);
  });

  it('processes an image whose original is already in S3', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-s3-image-'));
    roots.push(root);
    const source = path.join(root, 'source.png');
    await writeFile(
      source,
      await sharp({
        create: { width: 200, height: 100, channels: 3, background: '#88aaff' },
      })
        .png()
        .toBuffer(),
    );
    const scope = `image-${randomUUID()}`;
    const storage = await createS3UploadStorage({
      bucket,
      prefix: `tests/${scope}`,
      localRoot: root,
      clientConfig: config,
    });
    const originalKey = storage.finalPath(scope, 'file-1', 'original', '.png');
    await storage.move(source, originalKey);
    const policy = createImagePolicy('playground.image');
    const now = new Date();
    const session: UploadSessionRecord = {
      id: '00000000-0000-4000-8000-000000000001',
      purpose: policy.purpose,
      status: 'processing',
      file: { name: 'photo.png', size: 326, type: 'image/png' },
      bytesUploaded: 326,
      bytesTotal: 326,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
      updatedAt: now.toISOString(),
      context: {},
      constraints: policy.constraints,
      commitMode: policy.commitMode,
      contentDisposition: policy.contentDisposition,
      files: [],
    };

    const files = await new SharpImageProcessor().process({
      session,
      fileId: 'file-1',
      sourcePath: originalKey,
      detectedMime: 'image/png',
      extension: '.png',
      scope,
      storage,
    });

    expect(files).toHaveLength(2);
    expect(files.every((file) => file.storageKey.startsWith('s3://'))).toBe(true);
    expect((await readAll(await storage.readStream(files[0]!.storageKey))).length).toBeGreaterThan(
      0,
    );

    for (const file of files) {
      await storage.delete(file.storageKey);
    }
    await storage.delete(originalKey);
  });
});

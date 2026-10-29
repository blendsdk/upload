import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { SharpImageProcessor } from '../src/processors.js';
import { LocalUploadStorage } from '../src/storage.js';
import type { UploadSessionRecord } from '../src/types.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('SharpImageProcessor', () => {
  it('converts HEIC through the optional decoder before making variants', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-heic-test-'));
    roots.push(root);
    const storage = new LocalUploadStorage(root);
    const source = path.join(root, 'source.heic');
    await writeFile(source, 'fake-heic');
    const jpeg = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#cccccc' },
    })
      .jpeg()
      .toBuffer();
    const processor = new SharpImageProcessor({
      decode: async () => new Uint8Array(jpeg),
    });
    const session = {
      id: '00000000-0000-4000-8000-000000000001',
      purpose: 'test.image',
      status: 'processing',
      file: { name: 'photo.heic', size: 9, type: 'image/heic' },
      bytesUploaded: 9,
      bytesTotal: 9,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
      context: {},
      constraints: { accept: ['image/heic'], maxSize: 1024, maxFiles: 1, maxPixels: 50_000_000 },
      commitMode: 'immediate',
      contentDisposition: 'inline',
      files: [],
    } satisfies UploadSessionRecord;

    const files = await processor.process({
      session,
      fileId: 'original',
      sourcePath: source,
      detectedMime: 'image/heic',
      extension: '.heic',
      scope: 'test',
      storage,
    });

    expect(files).toHaveLength(2);
    expect(files.every((file) => file.mime === 'image/webp')).toBe(true);
    await expect(storage.stat(files[0]!.storageKey)).resolves.toMatchObject({
      size: expect.any(Number),
    });
  });
});

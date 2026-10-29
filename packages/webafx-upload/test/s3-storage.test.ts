import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createS3UploadStorage } from '../src/s3-storage.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('S3UploadStorage', () => {
  it('builds scoped object keys without loading a network client', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-s3-test-'));
    roots.push(root);
    const storage = await createS3UploadStorage({
      bucket: 'test-bucket',
      prefix: 'uploads',
      localRoot: root,
      clientConfig: { region: 'us-east-1' },
    });
    const key = storage.finalPath('acme', 'file-1', 'display', '.webp');
    expect(key).toMatch(
      /^s3:\/\/test-bucket\/uploads\/[a-f0-9]{16}\/files\/file-1\/display\.webp$/,
    );
    expect(storage.tusDirectory).toBe(path.join(root, 'tus'));
  });
});

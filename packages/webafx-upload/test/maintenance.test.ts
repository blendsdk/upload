import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UploadFinalizer } from '../src/finalizer.js';
import { UploadMaintenance } from '../src/maintenance.js';
import { MemoryUploadStore } from '../src/store.js';
import { LocalUploadStorage } from '../src/storage.js';
import type { UploadSessionRecord } from '../src/types.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('UploadMaintenance', () => {
  it('expires sessions and removes their files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-upload-maint-'));
    roots.push(root);
    const storage = new LocalUploadStorage(root);
    const store = new MemoryUploadStore();
    const id = '9f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e';
    const source = path.join(root, 'source.txt');
    await writeFile(source, 'hello');
    const record: UploadSessionRecord = {
      id,
      purpose: 'test.document',
      status: 'uploaded',
      file: { name: 'note.txt', size: 5, type: 'text/plain' },
      bytesUploaded: 5,
      bytesTotal: 5,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
      context: {},
      constraints: { accept: ['text/plain'], maxSize: 100, maxFiles: 1 },
      commitMode: 'deferred',
      contentDisposition: 'attachment',
      tusUploadId: 'tus-1',
      files: [],
    };
    await store.create(record);
    const finalizer = new UploadFinalizer({
      store,
      storage,
      policies: {
        'test.document': {
          purpose: 'test.document',
          commitMode: 'deferred',
          constraints: record.constraints,
        },
      },
      processors: {},
      resolveUploadPath: async () => source,
    });
    await finalizer.finalize(id);
    const maintenance = new UploadMaintenance(store, finalizer);
    expect(await maintenance.cleanup()).toBe(1);
    expect((await store.get(id))?.status).toBe('expired');
  });

  it('keeps a ready immediate upload after its staging expiry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-upload-ready-'));
    roots.push(root);
    const storage = new LocalUploadStorage(root);
    const store = new MemoryUploadStore();
    const id = 'af14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e';
    const source = path.join(root, 'source.txt');
    await writeFile(source, 'hello');
    const record: UploadSessionRecord = {
      id,
      purpose: 'test.document',
      status: 'uploaded',
      file: { name: 'note.txt', size: 5, type: 'text/plain' },
      bytesUploaded: 5,
      bytesTotal: 5,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
      context: {},
      constraints: { accept: ['text/plain'], maxSize: 100, maxFiles: 1 },
      commitMode: 'immediate',
      contentDisposition: 'attachment',
      tusUploadId: 'tus-1',
      files: [],
    };
    await store.create(record);
    const finalizer = new UploadFinalizer({
      store,
      storage,
      policies: {
        'test.document': {
          purpose: 'test.document',
          commitMode: 'immediate',
          constraints: record.constraints,
        },
      },
      processors: {},
      resolveUploadPath: async () => source,
    });
    await finalizer.finalize(id);
    const maintenance = new UploadMaintenance(store, finalizer);
    expect(await maintenance.cleanup()).toBe(0);
    expect((await store.get(id))?.status).toBe('ready');
  });
});

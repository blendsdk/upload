import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { UploadPolicy } from '@blendsdk/upload-core';
import { UploadFinalizer } from '../src/finalizer.js';
import { MemoryUploadStore } from '../src/store.js';
import { LocalUploadStorage } from '../src/storage.js';
import type { UploadServerOptions, UploadSessionRecord } from '../src/types.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(
  commitMode: UploadPolicy['commitMode'] = 'immediate',
  onCommitted?: UploadServerOptions['onCommitted'],
  scanner?: UploadServerOptions['scanner'],
) {
  const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-upload-'));
  roots.push(root);
  const storage = new LocalUploadStorage(root);
  const store = new MemoryUploadStore();
  const source = path.join(root, 'source.txt');
  const content = 'hello upload';
  await writeFile(source, content);
  const id = '8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e';
  const now = new Date();
  const record: UploadSessionRecord = {
    id,
    purpose: 'test.document',
    status: 'uploaded',
    file: { name: 'note.txt', size: content.length, type: 'text/plain' },
    bytesUploaded: content.length,
    bytesTotal: content.length,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    updatedAt: now.toISOString(),
    context: {},
    constraints: { accept: ['text/plain'], maxSize: 1024, maxFiles: 1 },
    commitMode,
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
        commitMode,
        constraints: record.constraints,
      },
    },
    processors: {},
    resolveUploadPath: async () => source,
    onCommitted,
    scanner,
  });
  return { id, store, storage, finalizer, content };
}

describe('UploadFinalizer', () => {
  it('moves an immediate upload to final storage', async () => {
    const { id, store, storage, finalizer, content } = await fixture('immediate');
    const result = await finalizer.finalize(id);
    expect(result.status).toBe('ready');
    const file = result.files[0]!;
    expect(await readFile(file.storageKey, 'utf8')).toBe(content);
    expect(await store.get(id)).toMatchObject({ status: 'ready' });
    expect(file.storageKey.startsWith(storage.root)).toBe(true);
  });

  it('stages a deferred upload and commits it', async () => {
    const { id, finalizer } = await fixture('deferred');
    const staged = await finalizer.finalize(id);
    expect(staged.status).toBe('staged');
    expect(staged.files[0]!.storageKey).toContain(`${path.sep}staging${path.sep}`);

    const committed = await finalizer.commit(id, { actor_id: 'actor-1' });
    expect(committed.status).toBe('committed');
    expect(committed.files[0]!.storageKey).not.toContain(`${path.sep}staging${path.sep}`);
  });

  it('deletes all stored files', async () => {
    const { id, finalizer, storage } = await fixture('immediate');
    const result = await finalizer.finalize(id);
    await finalizer.delete(id);
    expect(await storage.exists(result.files[0]!.storageKey)).toBe(false);
  });

  it('does not move files twice during concurrent commits', async () => {
    const { id, finalizer, store } = await fixture('deferred');
    await finalizer.finalize(id);
    const results = await Promise.all([
      finalizer.commit(id, undefined),
      finalizer.commit(id, undefined),
    ]);
    expect((await store.get(id))?.status).toBe('committed');
    expect(results.some((result) => result.status === 'committed')).toBe(true);
  });

  it('rejects an infected file before moving it to final storage', async () => {
    const { id, finalizer, store, storage } = await fixture('immediate', undefined, {
      scan: async () => ({ clean: false, signature: 'Eicar-Test-Signature' }),
    });
    await expect(finalizer.finalize(id)).rejects.toMatchObject({ code: 'virus_detected' });
    const session = await store.get(id);
    expect(session?.status).toBe('failed');
    expect(session?.files).toHaveLength(0);
    expect(await storage.exists(path.join(storage.root, 'scopes'))).toBe(false);
  });

  it('returns a failed callback to staged for retry', async () => {
    let fail = true;
    const { id, finalizer, store } = await fixture('deferred', async () => {
      if (fail) {
        throw new Error('attachment failed');
      }
      return { externalId: 'actor-document-1' };
    });
    await finalizer.finalize(id);
    await expect(finalizer.commit(id, undefined)).rejects.toThrow('attachment failed');
    expect((await store.get(id))?.status).toBe('staged');

    fail = false;
    const committed = await finalizer.commit(id, undefined);
    expect(committed.status).toBe('committed');
    expect(committed.result?.externalId).toBe('actor-document-1');
  });
});

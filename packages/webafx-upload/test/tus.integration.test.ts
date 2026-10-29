import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import * as tus from 'tus-js-client';
import { createDocumentPolicy } from '@blendsdk/upload-core';
import { UploadFinalizer } from '../src/finalizer.js';
import { MemoryUploadStore } from '../src/store.js';
import { LocalUploadStorage } from '../src/storage.js';
import { createTusServer } from '../src/tus.js';
import { createUploadToken } from '../src/token.js';
import type { UploadSessionRecord } from '../src/types.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('tus integration', () => {
  it('uploads bytes, marks the session uploaded and finalizes the file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-upload-tus-'));
    roots.push(root);
    const storage = new LocalUploadStorage(root);
    const store = new MemoryUploadStore();
    const secret = 'a-test-secret-that-is-long-enough';
    const id = '7f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e';
    const content = 'hello';
    const policy = createDocumentPolicy('test.document', {
      constraints: { accept: ['text/plain'], maxSize: 1024, maxFiles: 1 },
    });
    const now = new Date();
    const record: UploadSessionRecord = {
      id,
      purpose: policy.purpose,
      status: 'pending',
      file: { name: 'note.txt', size: content.length, type: 'text/plain' },
      bytesUploaded: 0,
      bytesTotal: content.length,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
      updatedAt: now.toISOString(),
      context: {},
      constraints: policy.constraints,
      commitMode: 'immediate',
      contentDisposition: 'attachment',
      ownerId: 'tester',
      files: [],
    };
    await store.create(record);
    const token = await createUploadToken({
      secret,
      sessionId: id,
      purpose: policy.purpose,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const { server, datastore } = createTusServer({
      basePath: '/api/uploads',
      store,
      storageDirectory: storage.tusDirectory,
      tokenSecret: secret,
      maxSize: 1024,
    });
    const app = express();
    app.use('/api/uploads/tus', (req, res) => {
      void server.handle(req, res);
    });
    const httpServer = app.listen(0);
    await new Promise<void>((resolve) => httpServer.once('listening', resolve));
    const port = (httpServer.address() as AddressInfo).port;

    try {
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(Buffer.from(content), {
          endpoint: `http://127.0.0.1:${port}/api/uploads/tus`,
          headers: { Authorization: `Bearer ${token}` },
          metadata: { sessionId: id },
          chunkSize: 2,
          retryDelays: [],
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        });
        upload.start();
      });

      const uploaded = await store.get(id);
      expect(uploaded?.status).toBe('uploaded');

      const secondId = '6f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e';
      await store.create({
        ...record,
        id: secondId,
        status: 'pending',
        tusUploadId: undefined,
      });
      const secondToken = await createUploadToken({
        secret,
        sessionId: secondId,
        purpose: policy.purpose,
        expiresAt: new Date(now.getTime() + 60_000),
      });
      const crossSession = await fetch(
        `http://127.0.0.1:${port}/api/uploads/tus/${uploaded?.tusUploadId}`,
        {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${secondToken}`, 'Tus-Resumable': '1.0.0' },
        },
      );
      expect(crossSession.status).toBe(403);

      const finalizer = new UploadFinalizer({
        store,
        storage,
        policies: { [policy.purpose]: policy },
        processors: {},
        resolveUploadPath: async (session) => {
          const upload = await datastore.getUpload(session.tusUploadId!);
          if (!upload.storage || upload.storage.type !== 'file') {
            throw new Error('missing tus storage');
          }
          return upload.storage.path;
        },
      });
      const result = await finalizer.finalize(id);
      expect(result.status).toBe('ready');
      expect(await readFile(result.files[0]!.storageKey, 'utf8')).toBe(content);
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebApplication } from 'blendsdk/webafx';
import { createDocumentPolicy } from '@blendsdk/upload-core';
import { uploadPlugin } from '../src/plugin.js';

const roots: string[] = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('uploadPlugin', () => {
  it('registers the session API on a WebAFX application', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'blendsdk-upload-api-'));
    roots.push(root);
    const app = new WebApplication({
      PORT: 0,
      ENV_MODE: 'test',
      LOG_LEVEL: 'ERROR',
      BODY_LIMIT: '1mb',
    });
    app.registerService({
      name: 'user',
      type: 'per-request',
      factory: () => ({ id: 'tester' }),
    });
    app.use(
      uploadPlugin({
        tokenSecret: 'a-test-secret-that-is-long-enough',
        basePath: '/api/uploads',
        storageRoot: root,
        cleanupIntervalMs: 0,
        policies: {
          'test.document': createDocumentPolicy('test.document'),
        },
        authorizeSession: () => ({ ownerId: 'tester' }),
      }),
    );

    const shutdown = await app.start();
    cleanups.push(shutdown);

    const created = await request(app.express)
      .post('/api/uploads/sessions')
      .send({
        purpose: 'test.document',
        file: { name: 'cv.pdf', size: 10, type: 'application/pdf' },
        context: { actor_id: 'actor-1' },
      })
      .expect(201);

    expect(created.body.success).toBe(true);
    expect(created.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.body.data.token).toBeTruthy();

    const status = await request(app.express)
      .get(`/api/uploads/sessions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${created.body.data.token}`)
      .expect(200);
    expect(status.body.data.status).toBe('pending');

    const policy = await request(app.express).get('/api/uploads/policy/test.document').expect(200);
    expect(policy.body.data.commitMode).toBe('immediate');
  });
});

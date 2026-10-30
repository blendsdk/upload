import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import pg from 'pg';
import { PostgresUploadStore, UPLOAD_SESSION_SQL, type SqlQuery } from '../src/postgres-store.js';
import { RedisLocker } from '../src/redis-locker.js';
import type { UploadSessionRecord } from '../src/types.js';

const enabled = process.env.INFRA_INTEGRATION === '1';
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://upload:upload@127.0.0.1:5432/upload_test';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const { Pool } = pg;

const pool = new Pool({ connectionString: databaseUrl });
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const query: SqlQuery = async <T>(text: string, values?: unknown[]) => {
  const result = await pool.query(text, values);
  return { rows: result.rows as T[] };
};
const store = new PostgresUploadStore(query);

function record(overrides: Partial<UploadSessionRecord> = {}): UploadSessionRecord {
  const now = new Date();
  return {
    id: randomUUID(),
    scope: 'scope-a',
    ownerId: 'owner-a',
    clientKey: `client-${randomUUID()}`,
    purpose: 'test.document',
    status: 'staged',
    file: { name: 'note.txt', size: 5, type: 'text/plain' },
    bytesUploaded: 5,
    bytesTotal: 5,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    updatedAt: now.toISOString(),
    context: {},
    constraints: { accept: ['text/plain'], maxSize: 100, maxFiles: 1 },
    commitMode: 'immediate',
    contentDisposition: 'attachment',
    files: [
      {
        id: randomUUID(),
        role: 'original',
        name: 'note.txt',
        mime: 'text/plain',
        size: 5,
        storageKey: '/tmp/note.txt',
      },
    ],
    ...overrides,
  };
}

describe.skipIf(!enabled)('Postgres and Redis integration', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
    await pool.query('DROP TABLE IF EXISTS upload_session');
    await pool.query(UPLOAD_SESSION_SQL);
    await redis.ping();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE upload_session');
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS upload_session');
    await pool.end();
    await redis.quit();
  });

  it('persists, updates and finds sessions in Postgres', async () => {
    const session = record();
    await store.create(session);

    await expect(store.get(session.id)).resolves.toMatchObject({
      id: session.id,
      scope: 'scope-a',
      clientKey: session.clientKey,
    });
    await expect(
      store.findByClientKey('scope-a', 'owner-a', session.clientKey!),
    ).resolves.toMatchObject({ id: session.id });
    await expect(store.countActive('scope-a', 'owner-a')).resolves.toBe(1);
    await expect(store.findFile(session.files[0]!.id)).resolves.toMatchObject({
      session: { id: session.id },
      file: { id: session.files[0]!.id },
    });

    await expect(
      store.updateIfStatus(session.id, ['uploaded'], { status: 'processing' }),
    ).resolves.toBeUndefined();
    const claimed = await store.updateIfStatus(session.id, ['staged'], { status: 'processing' });
    expect(claimed?.status).toBe('processing');

    const updated = await store.update(session.id, { status: 'committed', clientKey: undefined });
    expect(updated?.status).toBe('committed');
    expect(updated?.clientKey).toBeUndefined();
    await expect(
      store.findByClientKey('scope-a', 'owner-a', session.clientKey!),
    ).resolves.toBeUndefined();
    await expect(store.countActive('scope-a', 'owner-a')).resolves.toBe(0);

    await store.delete(session.id);
    await expect(store.get(session.id)).resolves.toBeUndefined();
  });

  it('finds expired records and purges only expired records', async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const expired = record({ status: 'uploaded', expiresAt: expiredAt });
    const live = record({ status: 'staged' });
    await store.create(expired);
    await store.create(live);

    await expect(store.listExpired(new Date())).resolves.toEqual([
      expect.objectContaining({ id: expired.id }),
    ]);

    await store.update(expired.id, { status: 'expired' });
    await expect(store.listPurgeable(new Date())).resolves.toEqual([
      expect.objectContaining({ id: expired.id }),
    ]);
  });

  it('enforces the client-key uniqueness index', async () => {
    const first = record({ clientKey: 'unique-key' });
    await store.create(first);
    await expect(store.create(record({ clientKey: 'unique-key' }))).rejects.toThrow();
  });

  it('acquires, times out and releases Redis locks', async () => {
    const prefix = `integration:${randomUUID()}:`;
    const locker = new RedisLocker({
      client: redis,
      keyPrefix: prefix,
      ttlMs: 5_000,
      acquireTimeoutMs: 50,
      retryMs: 5,
    });
    const key = `${prefix}resource`;
    const first = locker.newLock('resource');
    await first.lock(new AbortController().signal, () => undefined);
    expect(await redis.get(key)).toBeTruthy();

    let releaseRequests = 0;
    const second = locker.newLock('resource');
    await expect(
      second.lock(new AbortController().signal, () => {
        releaseRequests += 1;
      }),
    ).rejects.toMatchObject({ status_code: 500 });
    expect(releaseRequests).toBeGreaterThan(0);

    await first.unlock();
    await second.lock(new AbortController().signal, () => undefined);
    await second.unlock();
    expect(await redis.get(key)).toBeNull();
  });

  it('does not release a lock owned by another token', async () => {
    const prefix = `integration:${randomUUID()}:`;
    const locker = new RedisLocker({ client: redis, keyPrefix: prefix });
    const key = `${prefix}resource`;
    const lock = locker.newLock('resource');
    await lock.lock(new AbortController().signal, () => undefined);
    await redis.set(key, 'another-owner', 'PX', 5_000);
    await lock.unlock();
    await expect(redis.get(key)).resolves.toBe('another-owner');
    await redis.del(key);
  });
});

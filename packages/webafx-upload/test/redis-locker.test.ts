import { describe, expect, it } from 'vitest';
import { RedisLocker, type RedisLike } from '../src/redis-locker.js';

class FakeRedis implements RedisLike {
  public readonly values = new Map<string, string>();

  public async set(
    key: string,
    value: string,
    _mode: 'PX',
    _ttl: number,
    _condition: 'NX',
  ): Promise<'OK' | null> {
    if (this.values.has(key)) {
      return null;
    }
    this.values.set(key, value);
    return 'OK';
  }

  public async eval(
    _script: string,
    _numKeys: number,
    key: string,
    token: string,
  ): Promise<unknown> {
    if (this.values.get(key) === token) {
      this.values.delete(key);
      return 1;
    }
    return 0;
  }
}

describe('RedisLocker', () => {
  it('acquires and releases a lock', async () => {
    const client = new FakeRedis();
    const locker = new RedisLocker({ client, acquireTimeoutMs: 50, retryMs: 5 });
    const lock = locker.newLock('upload-1');
    await lock.lock(new AbortController().signal, () => undefined);
    expect(client.values.size).toBe(1);
    await lock.unlock();
    expect(client.values.size).toBe(0);
  });

  it('times out while another holder keeps the lock', async () => {
    const client = new FakeRedis();
    const locker = new RedisLocker({ client, acquireTimeoutMs: 30, retryMs: 5 });
    const first = locker.newLock('upload-1');
    const second = locker.newLock('upload-1');
    await first.lock(new AbortController().signal, () => undefined);
    let released = false;
    await expect(
      second.lock(new AbortController().signal, () => {
        released = true;
      }),
    ).rejects.toMatchObject({ status_code: 500 });
    expect(released).toBe(true);
    await first.unlock();
    await second.lock(new AbortController().signal, () => undefined);
    await second.unlock();
  });
});

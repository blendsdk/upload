import { randomUUID } from 'node:crypto';
import { ERRORS, type Lock, type Locker, type RequestRelease } from '@tus/server';

/** Minimal Redis command surface used by the locker. */
export interface RedisLike {
  set(key: string, value: string, mode: 'PX', ttl: number, condition: 'NX'): Promise<'OK' | null>;
  eval(script: string, numKeys: number, key: string, token: string): Promise<unknown>;
}

/** Options for a Redis-backed tus locker. */
export interface RedisLockerOptions {
  client: RedisLike;
  keyPrefix?: string;
  ttlMs?: number;
  acquireTimeoutMs?: number;
  retryMs?: number;
}

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(ERRORS.ERR_LOCK_TIMEOUT);
      },
      { once: true },
    );
  });
}

/**
 * Redis-backed locker for multi-instance tus deployments.
 *
 * A lock is a short-lived SET NX PX entry. The holder releases it with a
 * compare-and-delete Lua script, so a stale process cannot release a newer
 * lock. A conflicting request asks the current holder to release and retries
 * until the acquire timeout.
 */
export class RedisLocker implements Locker {
  private readonly prefix: string;
  private readonly ttlMs: number;
  private readonly acquireTimeoutMs: number;
  private readonly retryMs: number;

  public constructor(private readonly options: RedisLockerOptions) {
    this.prefix = options.keyPrefix ?? 'tus:lock:';
    this.ttlMs = options.ttlMs ?? 30_000;
    this.acquireTimeoutMs = options.acquireTimeoutMs ?? 30_000;
    this.retryMs = options.retryMs ?? 100;
  }

  public newLock(id: string): Lock {
    return new RedisLock(`${this.prefix}${id}`, this.options.client, {
      ttlMs: this.ttlMs,
      acquireTimeoutMs: this.acquireTimeoutMs,
      retryMs: this.retryMs,
    });
  }
}

class RedisLock implements Lock {
  private token = randomUUID();

  public constructor(
    private readonly key: string,
    private readonly client: RedisLike,
    private readonly options: { ttlMs: number; acquireTimeoutMs: number; retryMs: number },
  ) {}

  public async lock(signal: AbortSignal, requestRelease: RequestRelease): Promise<void> {
    const deadline = Date.now() + this.options.acquireTimeoutMs;
    while (Date.now() < deadline) {
      if (signal.aborted) {
        throw ERRORS.ERR_LOCK_TIMEOUT;
      }
      const result = await this.client.set(this.key, this.token, 'PX', this.options.ttlMs, 'NX');
      if (result === 'OK') {
        return;
      }
      await requestRelease();
      try {
        await delay(this.options.retryMs, signal);
      } catch {
        throw ERRORS.ERR_LOCK_TIMEOUT;
      }
    }
    throw ERRORS.ERR_LOCK_TIMEOUT;
  }

  public async unlock(): Promise<void> {
    await this.client.eval(RELEASE_SCRIPT, 1, this.key, this.token);
  }
}

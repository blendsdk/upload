# Operations

## Expiry

Sessions carry `expiresAt`. `UploadStore.listExpired(now)` returns sessions that should be cleaned up. Run a scheduled job in the application (or a dedicated worker) that:

1. loads expired sessions;
2. deletes their files through `UploadFinalizer.delete`;
3. marks them expired;
4. logs the cleanup count.

The tus `FileStore` also has an expiration period; configure it consistently with `sessionTtlSeconds` and `stagedTtlSeconds`.

## Multi-instance deployments

The default tus locker is in-memory. For more than one instance, provide a shared `Locker` through `tusLocker`:

```ts
import Redis from 'ioredis';
import { RedisLocker, uploadPlugin } from '@blendsdk/webafx-upload';

const redis = new Redis(process.env.REDIS_URL!);
app.use(
  uploadPlugin({
    ...options,
    tusLocker: new RedisLocker({ client: redis, ttlMs: 30_000 }),
  }),
);
```

Use a shared database for `UploadStore`. Local filesystem storage also requires a shared volume or a shared object store.

## Reverse proxy

Disable request buffering for the tus path, set a request body limit at least as large as one chunk, and use timeouts longer than a slow chunk transfer. The default chunk size is 8 MiB. Keep the proxy body limit aligned with the `maxTusSize` policy.

## Observability

The plugin logs session creation, transport creation/finish and finalization failures. Add metrics around session creation, bytes uploaded, finalization latency, failure codes and storage usage. Never log upload tokens or file contents.

## Health

The plugin's health check verifies that the storage root is writable. Extend it with database and scanner checks in the host application.

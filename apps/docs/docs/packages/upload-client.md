# `@blendsdk/upload-client`

Framework-agnostic upload manager.

## `createUploadClient`

```ts
const client = createUploadClient({
  baseUrl: '/api/uploads',
  getHeaders: () => ({ Authorization: `Bearer ${token}` }),
  fetch: window.fetch,
});
```

It calls the session JSON endpoints and unwraps the WebAFX response envelope. It is separate from `blendsdk/api-client` because the upload runtime needs binary tus progress, not JSON-only requests.

## `createUploadManager`

```ts
const manager = createUploadManager({
  client,
  purpose: 'actor.document',
  context: { actor_id },
  concurrency: 2,
  transport: new TusTransport(),
});
```

The manager exposes `addFiles`, `start`, `pause`, `resume`, `retry`, `cancel`, `remove`, `pauseAll`, `cancelAll`, `commit`, `subscribe` and `getState`.

The state snapshot is immutable and designed for `useSyncExternalStore`. Tokens stay in memory; resume metadata is small and contains no secrets.

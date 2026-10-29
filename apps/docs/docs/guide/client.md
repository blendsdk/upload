# Client setup

`@blendsdk/upload-client` is framework-agnostic. It owns validation, the queue, retry, resume and the tus transport.

```ts
import { createUploadClient, createUploadManager } from '@blendsdk/upload-client';

const client = createUploadClient({
  baseUrl: '/api/uploads',
  getHeaders: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
});

const manager = createUploadManager({
  client,
  purpose: 'actor.document',
  context: { actor_id: 'actor-1' },
  concurrency: 2,
  autoStart: true,
});

manager.subscribe(() => render(manager.getState()));
await manager.addFiles(Array.from(fileInput.files ?? []));
```

## File lifecycle

```
queued → creating → uploading → processing → ready
        ↘ paused                 ↘ failed
```

A ready item can be committed with `manager.commit()` when the server policy uses deferred commit.

## Resume and retry

tus handles interrupted bytes. The manager stores a small resume key, never a token or a file blob. Re-select the same file after a reload and the manager reuses the session key and the server offset.

Use `pause`, `resume`, `retry`, `cancel` and `remove` per item. Use `pauseAll`, `cancelAll` and `start` for batch actions.

## Validation

The server policy is authoritative. The client uses the same core validator for immediate feedback and never treats a browser MIME type as proof of content.

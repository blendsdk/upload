# Storage

## Local filesystem

```ts
const storage = new LocalUploadStorage('/srv/uploads');
```

```
/srv/uploads/
  tus/                              # in-progress tus bytes
  scopes/<scope-hash>/
    staging/<session-id>.<ext>      # deferred files
    files/<file-id>/original.<ext>
    files/<file-id>/display.webp
    files/<file-id>/thumb.webp
```

The scope hash is derived from the opaque application scope. A tenant or workspace name never becomes a path component.

## Object storage

`UploadStorage` is the integration boundary. Implement it for S3, R2 or another object store, or use a tus S3 store in a custom deployment. The finalizer only needs `move`, `stat`, `readStream`, `write`, `exists` and `delete`.

## Persistence

`UploadStore` persists sessions and file records. The included `MemoryUploadStore` is for development only. A production adapter should use the application's database and enforce uniqueness on `(scope, owner, clientKey)` for idempotent session creation.

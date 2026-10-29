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

## S3 object storage

```ts
import { createS3UploadStorage, uploadPlugin } from '@blendsdk/webafx-upload';

const storage = await createS3UploadStorage({
  bucket: process.env.S3_BUCKET!,
  prefix: 'blendsdk/upload',
  localRoot: '/srv/upload-staging',
  clientConfig: { region: process.env.AWS_REGION },
});

app.use(uploadPlugin({ ...options, storage }));
```

tus keeps writing to the local `localRoot/tus` staging directory. Finalized originals and variants are uploaded to the bucket; `UploadStorage` remains the integration boundary for other object stores. Install the optional `@aws-sdk/client-s3` peer only when using this adapter.

## Persistence

`UploadStore` persists sessions and file records. The included `MemoryUploadStore` is for development only. A production adapter should use the application's database and enforce uniqueness on `(scope, owner, clientKey)` for idempotent session creation.

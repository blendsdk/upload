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
import { uploadPlugin } from '@blendsdk/webafx-upload';
import { createS3UploadStorage } from '@blendsdk/webafx-upload/s3';

const storage = await createS3UploadStorage({
  bucket: process.env.S3_BUCKET!,
  prefix: 'blendsdk/upload',
  localRoot: '/srv/upload-staging',
  clientConfig: { region: process.env.AWS_REGION },
});

app.use(uploadPlugin({ ...options, storage }));
```

tus keeps writing to the local `localRoot/tus` staging directory. Finalized originals and variants are uploaded to the bucket; `UploadStorage` remains the integration boundary for other object stores. Install the optional `@aws-sdk/client-s3` peer only when using this adapter.

## Local S3-compatible testing

The repository includes `compose.yaml` with Adobe S3Mock. It is a lightweight S3 API emulator built for integration tests, with path-style access and no cloud account:

```bash
pnpm test:s3
```

The command starts S3Mock on `http://127.0.0.1:9090`, runs the storage contract test against bucket `uploads-test`, and leaves the container running. Stop it with:

```bash
pnpm s3:down
```

Override `S3MOCK_PORT` or `S3_BUCKET` when the defaults conflict with your environment. S3Mock is not a full AWS emulator: it is suitable for the adapter contract (move, stat, read, range, write, delete), not for testing AWS-specific IAM, lifecycle or replication behavior. For broader AWS API coverage, use LocalStack; for production, use real S3 or another S3-compatible store.

## Persistence

`UploadStore` persists sessions and file records. The included `MemoryUploadStore` is for development only. A production adapter should use the application's database and enforce uniqueness on `(scope, owner, clientKey)` for idempotent session creation.

# Server setup

Register the plugin after the authentication plugin and before the application controllers. The plugin mounts the tus endpoint and registers the session and file controllers.

```ts
import { uploadPlugin, LocalUploadStorage, MemoryUploadStore } from '@blendsdk/webafx-upload';

app.use(
  uploadPlugin({
    tokenSecret: process.env.UPLOAD_TOKEN_SECRET!,
    basePath: '/api/uploads',
    storage: new LocalUploadStorage('/srv/uploads'),
    store: new MemoryUploadStore(), // use a durable UploadStore in production
    policies,
    authorizeSession,
    authorizeFile,
    onFinalized,
    onCommitted,
    onDeleted,
  }),
);
```

## Routes

| Method                           | Route                    | Purpose                  |
| -------------------------------- | ------------------------ | ------------------------ |
| `GET`                            | `/policy/:purpose`       | Resolve constraints      |
| `POST`                           | `/sessions`              | Create a session         |
| `GET`                            | `/sessions/:id`          | Session status           |
| `POST`                           | `/sessions/:id/finalize` | Finalize uploaded bytes  |
| `POST`                           | `/sessions/:id/commit`   | Commit one staged upload |
| `POST`                           | `/sessions/commit`       | Commit a batch           |
| `DELETE`                         | `/sessions/:id`          | Cancel and delete        |
| `GET`                            | `/files/:fileId`         | Serve a stored file      |
| `POST/HEAD/PATCH/DELETE/OPTIONS` | `/tus`                   | tus transport            |

## Callbacks

`authorizeSession` decides whether the caller may create a session and returns the owner/scope. `authorizeFile` decides whether a caller may read a file. `onFinalized` and `onCommitted` are where the host writes its own domain records; the package owns no application tables.

Callbacks must be idempotent by session/file id. A finalization retry may call `onFinalized` again with the same file ids.

## Storage and persistence

The default `MemoryUploadStore` is for development and tests. Implement the `UploadStore` interface with the application's database for production. The store separates session state from the application's file records.

`LocalUploadStorage` writes tus bytes under `<root>/tus` and finalized files under `<root>/scopes/<scope-hash>/files/...`. The scope hash prevents tenant or workspace names from becoming path components.

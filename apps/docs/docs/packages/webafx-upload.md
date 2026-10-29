# `@blendsdk/webafx-upload`

WebAFX v5 server integration.

## `uploadPlugin`

Registers:

- the session controller at `basePath`;
- the file controller at `${basePath}/files`;
- the tus router at `${basePath}/tus`;
- `upload.options`, `upload.store`, `upload.storage` and `upload.finalizer` services.

The plugin must be installed after the authentication plugin and before controllers are registered. Its priority is 40, which places the tus router before the global CSRF plugin while the JSON controllers are registered afterward and remain protected by it.

## Services

| Service            | Contract                       |
| ------------------ | ------------------------------ |
| `upload.options`   | Resolved `UploadServerOptions` |
| `upload.store`     | `UploadStore`                  |
| `upload.storage`   | `UploadStorage`                |
| `upload.finalizer` | `UploadFinalizer`              |

## Classes and helpers

- `LocalUploadStorage`
- `S3UploadStorage`, `createS3UploadStorage` (`@blendsdk/webafx-upload/s3`)
- `MemoryUploadStore`, `PostgresUploadStore`
- `RedisLocker`
- `ClamAvScanner`, `NoopScanner`
- `HeicConvertDecoder`
- `SharpImageProcessor`
- `UploadFinalizer`
- `UploadSessionController`
- `UploadFileController`
- `createTusServer`
- `createUploadToken`, `verifyUploadToken`

## Server callbacks

`authorizeSession`, `authorizeFile`, `onFinalized`, `onCommitted` and `onDeleted` are the application boundary. The package does not know actor, document, visual or signup tables.

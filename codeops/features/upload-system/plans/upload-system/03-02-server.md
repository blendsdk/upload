# Server Design

## Plugin

`uploadPlugin(options)` validates the token secret, resolves storage and store, creates the tus server and finalizer, registers services and controllers, mounts the tus router and starts the cleanup interval.

Plugin priority is 40. The auth plugin (priority 10) registers the principal service first; the CSRF plugin (priority 50) protects the JSON controllers mounted after plugins; the tus router handles its own token-authenticated protocol requests before CSRF.

## Controllers

- `UploadSessionController`: policy, create, status, finalize, commit one/batch, cancel.
- `UploadFileController`: authenticated streaming with ranges, ETag, disposition and `nosniff`.

## tus

`createTusServer` wraps `@tus/server` and `@tus/file-store`. `onIncomingRequest` verifies the bearer token and loads the session. `onUploadCreate` checks the declared size and records the transport id. `onUploadFinish` marks the session uploaded. Finalization is a separate, retryable call.

## Stores

`MemoryUploadStore` is the test/development implementation. `PostgresUploadStore` stores the full record in JSONB with indexed scope, owner, client key, status and expiry columns; `UPLOAD_SESSION_SQL` is the migration.

## Processors

`SharpImageProcessor` validates dimensions, rotates, strips metadata from derivatives and writes WebP display/thumbnail variants. The processor interface supports future scanners, PDF inspectors and video posters.

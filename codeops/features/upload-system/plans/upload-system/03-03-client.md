# Client Design

`createUploadClient` calls the JSON endpoints and unwraps the WebAFX envelope. It keeps application auth in `getHeaders` and uses the session token only for status/finalize/cancel.

`UploadManager` owns:

- immutable snapshots and `useSyncExternalStore` compatibility;
- bounded concurrency;
- per-file lifecycle and progress;
- pause/resume/retry/cancel/remove;
- session idempotency via `resumeKey`;
- memory-only tokens and small resume metadata;
- transport abstraction, with `TusTransport` as the default.

`TusTransport` maps tus progress, completion and errors into the manager. It uses abort (not termination) for pause, termination for cancel, and retry delays for transient network failures.

The manager never reads a whole file into memory; tus reads slices. Validation reads only metadata.

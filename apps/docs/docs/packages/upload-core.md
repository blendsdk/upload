# `@blendsdk/upload-core`

Shared protocol and validation primitives.

## Exports

- `UPLOAD_PROTOCOL_VERSION`
- `UploadPolicy`, `UploadConstraints`, `UploadSession`, `UploadItemState`, `UploadManagerState`
- `UploadError`, `toUploadError`, `isRetryable`
- `createDocumentPolicy`, `createImagePolicy`
- `validateFileDescriptor`, `validateBatchCount`, `matchesAccept`
- `sanitizeFileName`, `formatBytes`
- Zod schemas for every request and response
- `canTransition`, `isTerminalStatus`

## Policy presets

`createDocumentPolicy(purpose, overrides)` accepts PDF, DOC and DOCX, defaults to immediate commit and serves documents as attachments.

`createImagePolicy(purpose, overrides)` accepts JPEG, PNG and WebP, defaults to deferred commit and adds display/thumbnail processing. HEIC/HEIF requires an explicit host decoder; add it to the accept list only when that decoder is installed.

The package has a `zod` peer dependency. Keep one Zod 4 version in the application.

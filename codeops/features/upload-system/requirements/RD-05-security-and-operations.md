# RD-05: Security, Storage and Operations

> **Status**: Implemented
> **Project**: upload
> **Depends On**: RD-03

## Functional Requirements

- Upload tokens are signed, session-bound, scoped and expiring.
- Session creation and file reads use application authorization callbacks; the default is deny for unauthenticated callers.
- The server never trusts the browser MIME type; file-type detection and image decoding validate content.
- File names are display metadata only; storage keys are generated.
- The scope is hashed before it becomes a path component.
- File responses set MIME type, disposition, cache headers, ETag and `nosniff`; byte ranges are supported.
- Expired sessions can be removed by a maintenance service; the plugin runs cleanup on an interval.
- The Postgres adapter persists the complete session record in JSONB with indexed scope/owner/client key/status/expiry columns.
- The storage and store interfaces allow object storage and durable database adapters.

## Acceptance Criteria

- [x] Token tests cover tampering.
- [x] Finalizer tests cover storage deletion.
- [x] Range parsing and response headers are implemented.
- [x] A maintenance service can expire sessions and delete their files.
- [x] No token, secret or file content is included in normal logs.

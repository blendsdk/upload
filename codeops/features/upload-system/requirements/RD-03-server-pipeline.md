# RD-03: WebAFX Server and tus Pipeline

> **Status**: Implemented
> **Project**: upload
> **Depends On**: RD-01, RD-02

## Functional Requirements

- A WebAFX v5 plugin registers a JSON session API, a file response controller and a tus byte endpoint.
- Session creation returns a session id, short-lived upload token, tus endpoint, chunk size, expiry and constraints.
- The tus server validates the upload token on every request, binds it to the session and rejects mismatched upload ids.
- Tus creation, PATCH, HEAD and termination use the standard tus protocol.
- A finalizer verifies size, computes SHA-256, detects content type and moves the file to local storage.
- Deferred sessions are staged and can be committed later.
- Image policies use a sharp processor for dimension checks, auto-rotation, metadata stripping and display/thumbnail variants.
- The package exposes storage and session-store interfaces.
- `LocalUploadStorage` and `MemoryUploadStore` are included; a PostgreSQL adapter and migration SQL are included.
- The plugin exposes health and shutdown hooks and a cleanup interval.

## Acceptance Criteria

- [x] The server package type-checks and builds against `blendsdk` v5.
- [x] Token tests cover signing, verification and wrong-secret rejection.
- [x] Finalizer tests cover immediate, deferred/commit and delete flows.
- [x] Content type detection and size verification are on the finalization path.
- [x] No application table names are referenced by the package.

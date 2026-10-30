# Release Notes — v0.2.2

**Released**: 2026-10-30

## Fixed

- S3 deferred staging now supports local-to-local moves before the final upload.
- S3-backed images are downloaded to a temporary file before sharp processing.
- Expired session records are purged after a configurable retention window (default 30 days).

## Added

- Private full-stack playground with real WebAFX, tus and Fluent UI.
- Playwright E2E coverage for the playground in CI.

## Changed

- Development and playground tests use BlendSDK `5.68.0`; the published peer range remains `>=5.66.0 <6.0.0`.

## Previous releases

- `v0.2.1`: isolated the optional S3 adapter behind `@blendsdk/webafx-upload/s3`.
- `v0.2.0`: added S3 storage, Redis locking, malware scanning, HEIC decoding, browser E2E and commit concurrency.
- `v0.1.0`: first public release.

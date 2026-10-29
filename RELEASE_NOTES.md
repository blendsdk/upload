# Release Notes

## v0.2.0 — 2026-10-29

### Added

- S3 object-storage adapter with optional AWS SDK peer.
- Redis tus locker for multi-instance deployments.
- ClamAV malware scanner adapter with INSTREAM support.
- HEIC/HEIF decoding through the optional `heic-convert` peer.
- Playwright browser E2E coverage in CI.
- Cross-instance commit claim and retryable callback failures.

### Changed

- `UploadStorage.readStream` is asynchronous so object storage can serve ranges.
- Image variants are encoded to a buffer and written through the storage adapter.
- The release workflow publishes with npm's OIDC trusted-publishing path and pushes `HEAD:main`.
- npm trusted publishing is configured for all four packages.

### Verified

- `pnpm verify`
- 36 unit/integration tests
- Chromium browser E2E
- Package tarball check

## v0.1.0 — 2026-10-29

First public release of the upload package family.

# Findings

## Fixed during implementation

- S3 deferred finalization passed a local staging path to `S3UploadStorage.move`; local-to-local moves are now supported.
- Image processing assumed the original was a local path; S3-backed images are now downloaded to a temporary file before sharp processing.

## Boundaries

- The playground is local-only and uses permissive authorization.
- Live S3 contract coverage is in `test/s3-storage.integration.test.ts`; the playground is a manual reference application.

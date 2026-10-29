# RD-07: Local S3 Contract Test

> **Status**: Implemented
> **Depends On**: upload-hardening/RD-02

## Requirements

- A Docker Compose service provides an S3-compatible endpoint without cloud credentials.
- The service is Adobe S3Mock, pinned to an explicit image version.
- An integration test exercises move, exists, stat, read, range read, write and delete through `S3UploadStorage`.
- The test is skipped in the default unit suite and runs through `pnpm test:s3`.
- CI runs the contract test in a separate job and always removes the container.
- Documentation states that S3Mock is a contract-test target, not a full AWS emulator.

## Acceptance

- [x] `pnpm test:s3` passes against S3Mock.
- [x] The default `pnpm test` remains Docker-free.
- [x] CI has a dedicated S3 integration job.
- [x] The limitations and local commands are documented.

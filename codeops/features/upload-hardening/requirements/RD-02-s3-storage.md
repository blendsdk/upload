# RD-02: S3 Object Storage

> **Status**: Implemented
> **Depends On**: —

## Requirements

- `S3UploadStorage` implements the existing `UploadStorage` contract.
- Local tus staging remains local; finalized files and variants are uploaded to S3.
- The adapter supports move/upload, stat, read stream, write, delete and exists.
- Storage keys are scoped and hashed; bucket and prefix are configurable.
- The AWS SDK is an optional peer loaded dynamically so local installs do not require it.
- The adapter is documented and covered by a fake-client test for key and command behavior.

## Acceptance

- [ ] The server package type-checks without the AWS SDK installed at runtime.
- [ ] `createS3UploadStorage` loads the SDK only when used.
- [ ] The storage adapter passes unit tests with a fake client.

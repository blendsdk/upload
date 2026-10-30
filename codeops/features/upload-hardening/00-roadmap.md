# Roadmap: Upload Hardening

> **Feature-Set**: upload-hardening
> **Status**: Done
> **Created**: 2026-10-29
> **Last Updated**: 2026-10-30
> **Progress**: 9 / 9 (100%)
> **CodeOps Artifact Schema**: 1

## Tracker

| ID    | Title                          | RD                                                        | Plan                                       | Stage | Status |
| ----- | ------------------------------ | --------------------------------------------------------- | ------------------------------------------ | ----- | ------ |
| RD-01 | Browser E2E coverage           | [RD-01](requirements/RD-01-browser-e2e.md)                | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-02 | S3 object storage              | [RD-02](requirements/RD-02-s3-storage.md)                 | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-03 | Redis tus locking              | [RD-03](requirements/RD-03-redis-locking.md)              | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-04 | Malware scanning               | [RD-04](requirements/RD-04-malware-scanning.md)           | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-05 | HEIC decoding                  | [RD-05](requirements/RD-05-heic-decoding.md)              | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-06 | Commit concurrency             | [RD-06](requirements/RD-06-commit-concurrency.md)         | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-07 | Local S3 contract test         | [RD-07](requirements/RD-07-local-s3-test.md)              | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-08 | Expired record retention       | [RD-08](requirements/RD-08-expired-record-retention.md)   | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |
| RD-09 | Postgres and Redis integration | [RD-09](requirements/RD-09-postgres-redis-integration.md) | [plan](plans/upload-hardening/00-index.md) | Done  | ✅     |

## Notes

- Released as `v0.2.0` on 2026-10-29, including S3 storage, Redis locking, malware scanning, HEIC decoding, browser E2E and commit concurrency.
- `v0.2.1` moves the optional S3 adapter to `@blendsdk/webafx-upload/s3`, keeping root types independent of the AWS SDK.
- `v0.2.2` adds expired-record retention deletion and the S3 staging/image fixes.
- Live Postgres store and Redis locker coverage is included in the integration suite.

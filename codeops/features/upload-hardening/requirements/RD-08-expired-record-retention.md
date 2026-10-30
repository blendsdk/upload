# RD-08: Expired Record Retention

> **Status**: Implemented
> **Depends On**: upload-hardening/RD-06

## Requirements

- Expiring a session continues to delete its bytes and mark the session expired.
- Expired session records are deleted after a configurable retention window.
- The default retention window is 30 days.
- `expiredRecordRetentionDays: 0` purges records on the next cleanup.
- `MemoryUploadStore` and `PostgresUploadStore` implement `listPurgeable`.
- Custom stores may omit `listPurgeable`; their expired records are kept.
- Cleanup logging reports both expired and purged counts.

## Acceptance

- [x] A regression test verifies retention-zero record deletion.
- [x] Existing expiry behavior remains intact.
- [x] Operations documentation explains the retention option.

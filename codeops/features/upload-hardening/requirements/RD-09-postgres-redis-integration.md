# RD-09: Postgres and Redis Integration

> **Status**: Implemented
> **Depends On**: upload-hardening/RD-03, upload-hardening/RD-06

## Requirements

- Docker Compose provides Postgres 17 and Redis 7 for local integration tests.
- The Postgres suite applies the real migration SQL and exercises create, get, update, CAS, lookup, count, expiry, purge and delete.
- The Redis suite exercises real lock acquisition, contention timeout, release and token-safe release.
- The suite is opt-in and does not run in the default unit test suite.
- CI runs the suite in a dedicated job and always stops the services.

## Acceptance

- [x] `pnpm test:infra` passes against live Postgres and Redis.
- [x] CI has a Postgres and Redis integration job.
- [x] Default `pnpm test` remains Docker-free.
- [x] Operations documentation includes local commands.

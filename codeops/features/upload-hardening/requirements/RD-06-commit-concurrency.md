# RD-06: Commit Concurrency

> **Status**: Implemented
> **Depends On**: —

## Requirements

- Commit claims a staged session with `UploadStore.updateIfStatus` before moving files.
- A concurrent commit returns the current session instead of moving files twice.
- A callback or processor failure returns the session to `staged` so it can be retried.
- The original files remain recorded after a partial move.
- A test covers concurrent commit and callback retry behavior.

## Acceptance

- [ ] Two concurrent commit calls do not both move the same files.
- [ ] A failed callback leaves the session retryable.
- [ ] Committed files keep stable IDs.

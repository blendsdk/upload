# Findings

An independent read-only review was run on 2026-10-29. It found five critical and fifteen major
findings. The release-blocking items were fixed and covered where practical.

## Fixed

| ID  | Finding                                                           | Resolution                                                                                                                   |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| C1  | Ready immediate files were expired after 24h                      | `listExpired` excludes `ready`/`committed`; regression tests cover ready survival and staged expiry                          |
| C2  | Pause left the transport promise pending and stalled the queue    | Resume now resumes the existing transport handle; pause/resume test added                                                    |
| C3  | tus upload ids were not bound to the session                      | Non-POST requests require the session's transport id; cross-session token test added                                         |
| C4  | Finalizer moved bytes before recording them                       | The original file record is persisted before processing; failed retries reuse the recorded path                              |
| C5  | Release workflow mixed build and publish refs                     | Release job checks out `github.sha`                                                                                          |
| M1  | Postgres idempotency index could duplicate null scopes            | Unique index uses `COALESCE`; client keys are cleared on commit/expire/cancel                                                |
| M2  | Resume key was replaced with a session id                         | Deterministic capped key retained; browser resume store is the UI default                                                    |
| M3  | Resume response lacked status/result and keys could exceed limits | Response carries status/result; key length is capped                                                                         |
| M4  | Ownerless sessions bypassed authorization                         | Session creation requires an owner; file/session access requires exact owner or a valid token                                |
| M5  | SVG could be served inline                                        | SVG/XML/HTML content is rejected; inline disposition is limited to raster images                                             |
| M6  | Read-stream errors could crash the process                        | Stream error handler closes or 404s safely                                                                                   |
| M7  | tus deferred length and size limits were bypassable               | Deferred length is rejected; policy maximum is checked on create; active-session cap added                                   |
| M8  | Abandoned tus data leaked                                         | Cleanup calls tus expiry and removes transport resources; timer failures are caught and guarded                              |
| M9  | Callback external ids were dropped                                | External ids are persisted into the result; token requests pass the principal to callbacks                                   |
| M10 | Finalization was not claimed atomically                           | `UploadStore.updateIfStatus` claims `uploaded`/`failed` before work; multi-instance commit CAS remains a documented deferral |
| M11 | Network failures were terminal                                    | Fetch rejections map to retryable `network_error`; test added                                                                |
| M12 | Cancel during creation could start an upload                      | Cancel is recorded immediately and re-checked after every await                                                              |
| M13 | React manager ignored changed props                               | Manager is recreated from a stable context key when connection props change                                                  |
| M14 | Dropzone keyboard handler was dropped                             | `noKeyboard` removed; nested action button removed from the role=button dropzone                                             |
| M15 | Numeric principal ids failed authorization                        | Principal ids are coerced to strings in both controllers                                                                     |

## Accepted deferrals

- Full browser E2E and Playwright visual coverage.
- A complete rate-limit/quota service; the package enforces an active-session cap and policy size limits, while the host owns per-IP rate limiting.
- Cross-instance commit CAS and a shared finalization lease; finalize is claimed atomically in the store, and multi-instance deployments must use a shared store/locker.
- S3/object storage adapter.
- Redis tus locker adapter.
- Malware scanner adapter.
- HEIC server decoder.
- Retention-based deletion of expired session records; expiry currently clears file bytes and marks the record.

## Resolved after the first release

- Browser E2E, S3 storage, Redis locking, malware scanning, HEIC decoding and cross-instance commit handling were delivered in `v0.2.0`/`v0.2.1`.
- Expired-record retention deletion was delivered with the `upload-hardening` RD-08 work and is part of the next patch release.

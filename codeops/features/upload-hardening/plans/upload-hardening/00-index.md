# Upload Hardening Implementation Plan

> **Feature**: Remaining production hardening for the upload package family
> **Status**: Done
> **Created**: 2026-10-29
> **Implements**: upload-hardening/RD-01 through upload-hardening/RD-08
> **CodeOps Artifact Schema**: 1

## Overview

This plan completes the deferred production capabilities without changing the session protocol or the public package split.

| Phase       | Scope                                       |
| ----------- | ------------------------------------------- |
| E2E         | Playwright smoke against the example app    |
| Storage     | Optional S3 adapter behind `UploadStorage`  |
| Locking     | Redis locker for multi-instance tus         |
| Security    | Optional clamd malware scanner              |
| Media       | Optional HEIC decoder                       |
| Correctness | CAS-protected commit with retryable failure |

## Design decisions

- S3 and HEIC are optional peers loaded dynamically; the default install stays light.
- Redis locking uses a minimal client interface and does not add a runtime dependency.
- The scanner runs on the local tus source before the final move.
- Commit claims `staged` through `updateIfStatus`; callback failure returns it to `staged`.
- E2E uses the existing deterministic demo transport; real tus is covered by server integration tests.

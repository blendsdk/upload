# Findings

The source of this feature is the independent review recorded in `upload-system/plans/upload-system/05-findings.md` plus the explicit remaining-items list.

## Release gates

- Every adapter must keep the default install free of optional heavy dependencies.
- E2E must run against the real component and manager.
- Commit concurrency must be covered by a regression test.
- `pnpm verify` must remain green.

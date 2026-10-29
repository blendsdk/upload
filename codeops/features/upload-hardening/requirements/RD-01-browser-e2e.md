# RD-01: Browser E2E Coverage

> **Status**: Implemented
> **Depends On**: —

## Requirements

- A Playwright suite runs against the Vite example application.
- It selects a file through the real file input, observes progress, and reaches the ready state.
- The suite runs in Chromium in CI and locally via `pnpm test:e2e`.
- The example uses the real Fluent UI component and manager; only the transport is deterministic.

## Acceptance

- [ ] `pnpm test:e2e` passes.
- [ ] CI runs the E2E job.
- [ ] Failure screenshots/traces are retained by Playwright configuration.

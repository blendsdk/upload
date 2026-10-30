# RD-02: Playground Browser E2E

> **Status**: Implemented
> **Depends On**: upload-playground/RD-01

## Requirements

- A Playwright suite starts the full-stack playground automatically.
- It uploads a real PNG through tus, commits the deferred image and downloads it.
- It uploads a real PDF through the immediate document policy and downloads it.
- The suite runs locally with `pnpm test:playground` and in a dedicated CI job.
- The suite cleans up the server and Vite processes after completion.

## Acceptance

- [x] `pnpm test:playground` passes.
- [x] CI has a Playground E2E job.
- [x] The test checks successful file responses, not only UI state.

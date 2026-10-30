# RD-01: Full-Stack Local Playground

> **Status**: Implemented
> **Depends On**: —

## Requirements

- A private `apps/playground` application runs a real WebAFX upload server and a Fluent UI client.
- The client uses the real tus transport and the real session/finalize/commit API, not the demo transport.
- The server exposes deferred image and immediate document policies.
- Local filesystem storage is the default.
- Setting `PLAYGROUND_S3=1` finalizes through the S3 adapter against S3Mock.
- The application documents startup, storage modes, ports and local-only security.
- The workspace build and type-check include the playground.

## Acceptance

- [x] Image upload, finalize and deferred commit work through the browser.
- [x] Document upload and immediate finalization work through the browser.
- [x] A committed S3 image is served through the file controller.
- [x] `pnpm playground` starts server and client.
- [x] Documentation includes local and S3Mock modes.

# Contributing

## Setup

```bash
pnpm install --frozen-lockfile
```

Use Node.js 22 and pnpm 12.8 or newer.

## Before opening a pull request

```bash
pnpm verify
```

This runs Prettier, TypeScript, the package builds, the test suites, the VitePress
build and the package tarball check. A failing gate means the change is not ready.

## Commit style

Use Conventional Commits:

```text
feat(ui): add pause-all control
fix(server): reject mismatched upload tokens
docs(guide): explain deferred commit
```

The release workflow derives the version bump from these messages.

## Package boundaries

- Server code imports public `blendsdk/webafx` subpaths only.
- UI code does not import server, Express, tus or sharp.
- Core and client do not depend on BlendSDK.
- React, Fluent UI, `blendsdk`, Express and Zod remain peer dependencies.

## Documentation

Add or update the relevant page under `apps/docs/docs`. Run `pnpm docs:build` before
opening the pull request.

## CodeOps

Feature work follows the artifacts under `codeops/features/`. Keep the roadmap and
execution plan current, and run the project quality gates before marking a task done.

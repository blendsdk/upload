<!-- CODEOPS-PROJECT:START -->

# BlendSDK Upload project guidance

## Project

- Public pnpm and Turborepo monorepo for resumable uploads built on BlendSDK v5, React 19 and Fluent UI v9.
- Node.js 22 or newer; pnpm 12.8 or newer (`12.11.2` is pinned); TypeScript 7.
- `main` is the integration and documentation branch.

## Structure

- `packages/upload-core/` — shared Zod schemas, protocol types, validation, policies and the session state machine.
- `packages/upload-client/` — framework-agnostic manager, queue, retry, resume and tus transport.
- `packages/webafx-upload/` — WebAFX v5 plugin, session/file controllers, tus server, storage, finalization, Postgres adapter and maintenance.
- `packages/fluentui-upload/` — React 19 / Fluent UI v9 `FileUpload` component.
- `apps/example/` — Vite demo; `apps/docs/` — VitePress user documentation.
- `codeops/` — CodeOps artifacts. Feature work lives under `codeops/features/<feature>/`.

## Commands

- Install exactly from the lockfile: `pnpm install --frozen-lockfile`.
- Full gate: `pnpm verify` (format, type-check, build, tests, docs build, pack check).
- Focused gates: `pnpm type-check`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm docs:build`, `pnpm pack:check`.
- `pnpm test:e2e` builds the workspace, starts the Vite example, and runs Playwright against Chromium. CI runs it as a separate job.
- One package: `pnpm --filter <package-name> <script>`.
- Docs workbench: `pnpm docs:dev`.

## Conventions

- Strict TypeScript. Browser/core packages use `ESNext`/`bundler`; the server uses `NodeNext`.
- `tsc` builds core, client and server. Vite builds the React package and example.
- Public packages export from their root only. Do not add deep imports.
- React, Fluent UI, `blendsdk`, Express and Zod are peer dependencies and must stay external.
- Server code imports public `blendsdk/webafx` subpaths, never private `@blendsdk/*` workspace packages.
- File storage keys are generated; user file names are display metadata only.
- Never log upload tokens, secrets or file contents.
- Conventional Commits are required; the release workflow uses them for `lockstep version --type auto`.
- Documentation comments are required for public and non-trivial internal symbols.
- Never reference plans, requirements or task identifiers in code or doc comments.

## Verification

- Run `pnpm verify` before completing any task or committing. A failing test or docs build means the task is not done.
- Specification tests are the immutable oracle; implementation tests cover internals.
- Browser-specific behaviour not covered by jsdom must be described as a manual check or added as Playwright coverage before claiming it works.

## CodeOps

- Nested layout: `codeops/.codeops.yml`; strict policy in `codeops/codeops.json`.
- Portfolio roadmap: `codeops/00-roadmap.md`; feature artifacts under `codeops/features/upload-system/`.
- Project skills and agents are installed under `.opencode/` by `opencode-codeops@2.2.1`.
- Release: `@blendsdk/lockstep` 1.4.1, exact `next`/`beta` tags, annotated release tags, npm OIDC trusted publishing.

<!-- CODEOPS-PROJECT:END -->

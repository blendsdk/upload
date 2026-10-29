# RD-01: Repository and Toolchain

> **Status**: Implemented
> **Project**: upload
> **Depends On**: —

## Functional Requirements

- The repository is a public pnpm/Turborepo monorepo under `blendsdk/upload`.
- Node 22 and pnpm 12.x are the runtime and package-manager baseline.
- TypeScript 7 is used for type checking and declaration output.
- Vite builds the React component library and the example application.
- `tsc` builds the Node and framework-agnostic packages.
- The four publishable packages are `@blendsdk/upload-core`, `@blendsdk/upload-client`, `@blendsdk/webafx-upload` and `@blendsdk/fluentui-upload`.
- `@blendsdk/webafx-upload` peers on the public `blendsdk` umbrella package, Express 5 and Zod 4.
- `@blendsdk/fluentui-upload` peers on React 19 and Fluent UI v9.
- All packages use lockstep versioning and `@blendsdk/lockstep` 1.4.1.
- `pnpm verify` runs format, type-check, build, tests, docs build and pack checks.

## Acceptance Criteria

- [x] `pnpm install --frozen-lockfile` succeeds.
- [x] `pnpm type-check`, `pnpm build`, `pnpm test` and `pnpm docs:build` succeed.
- [x] `pnpm pack:check` accepts all four tarballs.
- [x] No package imports a private `@blendsdk/*` workspace package.
- [x] No package bundles a peer dependency.

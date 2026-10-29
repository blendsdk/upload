# RD-06: Documentation and Release

> **Status**: Implemented
> **Project**: upload
> **Depends On**: RD-01–RD-05

## Functional Requirements

- A VitePress site documents installation, server, client, React component, policies, storage, security, operations, packages, API and release.
- The site uses base path `/upload/` and deploys to GitHub Pages from `main`.
- The release workflow uses lockstep 1.4.1, Conventional Commit auto-bump, exact `next`/`beta` tags, preflight, changelog and npm OIDC trusted publishing.
- A CI workflow runs the full verification command on every push and pull request.
- The release workflow publishes all four packages topologically.
- GitHub Pages is enabled through a workflow that requests `pages: write` and `id-token: write`.

## Acceptance Criteria

- [x] `pnpm docs:build` succeeds.
- [x] `apps/docs/docs/.vitepress/dist` is produced.
- [x] The Pages workflow uploads that directory and deploys it.
- [x] The release workflow uses annotated tags and pushes them explicitly.
- [x] The CI workflow runs `pnpm verify`.

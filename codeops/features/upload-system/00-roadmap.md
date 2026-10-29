# Roadmap: Upload System

> **Feature-Set**: upload-system
> **Status**: Done
> **Created**: 2026-10-29
> **Last Updated**: 2026-10-29
> **Progress**: 6 / 6 (100%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID    | Title                             | RD                                                      | Plan                                             | Stage | Status | Last Updated | Depends-on / Blocker |
| ----- | --------------------------------- | ------------------------------------------------------- | ------------------------------------------------ | ----- | ------ | ------------ | -------------------- |
| RD-01 | Repository and toolchain          | [RD-01](requirements/RD-01-repository-and-toolchain.md) | [upload-system](plans/upload-system/00-index.md) | Done  | ✅     | 2026-10-29   | —                    |
| RD-02 | Shared protocol and client engine | [RD-02](requirements/RD-02-protocol-and-client.md)      | [upload-system](plans/upload-system/00-index.md) | Done  | ✅     | 2026-10-29   | RD-01                |
| RD-03 | WebAFX server and tus pipeline    | [RD-03](requirements/RD-03-server-pipeline.md)          | [upload-system](plans/upload-system/00-index.md) | Done  | ✅     | 2026-10-29   | RD-01, RD-02         |
| RD-04 | Fluent UI v9 component            | [RD-04](requirements/RD-04-fluentui-component.md)       | [upload-system](plans/upload-system/00-index.md) | Done  | ✅     | 2026-10-29   | RD-02                |
| RD-05 | Security, storage and operations  | [RD-05](requirements/RD-05-security-and-operations.md)  | [upload-system](plans/upload-system/00-index.md) | Done  | ✅     | 2026-10-29   | RD-03                |
| RD-06 | Documentation and release         | [RD-06](requirements/RD-06-docs-and-release.md)         | [upload-system](plans/upload-system/00-index.md) | Done  | ✅     | 2026-10-29   | RD-01–RD-05          |

## Notes

- The project is greenfield; no CastingAppMT compatibility layer or migration is in scope.
- All packages are versioned in lockstep with `@blendsdk/lockstep` 1.4.1.
- The VitePress site deploys from `main` through GitHub Pages.
- `v0.1.0` was published to npm on 2026-10-29; `v0.2.0` followed with the production hardening adapters; `v0.2.1` isolates the optional S3 adapter subpath. Packages: `@blendsdk/upload-core`, `@blendsdk/upload-client`, `@blendsdk/webafx-upload` and `@blendsdk/fluentui-upload`.
- npm trusted publishing is configured for the `release.yml` workflow in `blendsdk/upload` for all four packages.

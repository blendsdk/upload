# Release process

All four packages share one version and are published with `@blendsdk/lockstep` 1.4.1.

## Version

```bash
pnpm lockstep:version:auto
```

`auto` reads Conventional Commits since the last `v*` tag. `--fail-on-no-changes` prevents an empty release. `--no-changelog` is used because the workflow generates the changelog in a separate step. The command refreshes `pnpm-lock.yaml` before committing.

## Changelog

```bash
pnpm lockstep:changelog
```

Writes per-package `CHANGELOG.md` files and the root `RELEASE_NOTES.md`. The generator is best-effort and never blocks a release.

## Publish

```bash
pnpm publish:latest
pnpm publish:next
pnpm publish:beta
```

`next` and `beta` use `--tag-mode exact`; `latest` is published only from `main`. Every publish uses `--preflight`, which dry-runs all four packages before the first real publish.

## Tags

One annotated `vX.Y.Z` tag is created per release. If the workflow uses `--no-git-commit`, it creates the annotated tag explicitly before pushing. The release job uses npm trusted publishing (`id-token: write`), not a long-lived `NPM_TOKEN`.

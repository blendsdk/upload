# Testing Strategy

| Layer  | Coverage                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| Core   | Policy matching, size/count validation, file-name sanitization, formatting, state transitions, schema parsing |
| Client | Queue, progress, ready state, invalid type rejection, commit, resume store                                    |
| Server | Token signing/verification, wrong secret, immediate finalization, deferred staging/commit, deletion           |
| UI     | jsdom render of dropzone and a ready item through a fake client/transport                                     |
| Build  | Type-check, ESM build, declarations, production Vite build, docs build, package tarball inspection            |

## Commands

```bash
pnpm format:check
pnpm type-check
pnpm build
pnpm test
pnpm docs:build
pnpm pack:check
```

`pnpm verify` runs all of them.

## Security checks

- Token tampering is rejected.
- File names never become storage paths.
- Scope hashing prevents traversal.
- File responses set `nosniff`.
- Authorization callbacks are the only application boundary.

## Gaps accepted for the first release

- No browser E2E yet; jsdom covers the component contract.
- No malware scanner is bundled; the processor boundary is ready for one.
- HEIC requires a host decoder; the default sharp build does not include it.

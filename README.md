# BlendSDK Upload

Resumable file uploads for BlendSDK v5, React 19 and Fluent UI v9.

The project is a lockstep-versioned monorepo with four packages:

| Package                     | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `@blendsdk/upload-core`     | Shared schemas, types, validation and protocol constants          |
| `@blendsdk/upload-client`   | Framework-agnostic upload manager, queue, retry and tus transport |
| `@blendsdk/webafx-upload`   | WebAFX v5 session API, tus integration, storage and finalization  |
| `@blendsdk/fluentui-upload` | React 19 / Fluent UI v9 upload component                          |

## Install

```bash
pnpm add @blendsdk/upload-core @blendsdk/upload-client
pnpm add @blendsdk/webafx-upload
pnpm add @blendsdk/fluentui-upload
```

The packages are published at `0.2.1` under the `@blendsdk` scope.

## Requirements

- Node.js 22 or newer
- pnpm 12.8 or newer (`12.11.2` is the pinned version)

## Development

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm build
pnpm test
pnpm docs:build
```

The full verification command is:

```bash
pnpm verify
```

## Documentation

The user documentation is a VitePress site in `apps/docs` and is published to
`https://blendsdk.github.io/upload/`.

## Release

All four packages are versioned in lockstep and published with
`@blendsdk/lockstep`. The release workflow uses exact dist-tags for `next` and
`beta`, publish preflight, and npm trusted publishing.

## License

MIT

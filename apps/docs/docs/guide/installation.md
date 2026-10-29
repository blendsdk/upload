# Installation

## Runtime requirements

| Requirement | Version       |
| ----------- | ------------- |
| Node.js     | 22 or newer   |
| pnpm        | 12.8 or newer |
| BlendSDK    | 5.66 or newer |
| React       | 19            |
| Fluent UI   | 9.75 or newer |
| Zod         | 4.4 or newer  |

## Packages

```bash
pnpm add @blendsdk/upload-core
pnpm add @blendsdk/upload-client
pnpm add @blendsdk/webafx-upload
pnpm add @blendsdk/fluentui-upload
```

`@blendsdk/webafx-upload` imports the public subpaths of the `blendsdk` umbrella package. Do not install or import the private `@blendsdk/webafx` workspace package.

`@blendsdk/upload-client` has no React dependency and can be used by any browser application. `@blendsdk/fluentui-upload` is React-only.

## Peer dependencies

The application provides `blendsdk`, `express`, `zod`, React 19, Fluent UI v9 and the Fluent icons package. The packages must not bundle or duplicate those peers.

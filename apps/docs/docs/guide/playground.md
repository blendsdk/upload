# Full-stack playground

`apps/playground` is a local reference application. It runs the real WebAFX upload plugin, the real tus transport and the real finalization pipeline. It is not the deterministic demo in `apps/example`.

## Start locally

```bash
pnpm playground
```

The command builds the workspace, then starts:

| Process       | URL                     | Purpose                            |
| ------------- | ----------------------- | ---------------------------------- |
| WebAFX server | `http://127.0.0.1:3001` | JSON API, tus and file serving     |
| Vite          | `http://127.0.0.1:5174` | Fluent UI client with `/api` proxy |

Open `http://127.0.0.1:5174`.

## What to try

- Upload an image. Images use deferred commit: the file becomes ready but stays staged until **Commit images** is pressed.
- Upload a PDF or Office document. Documents use immediate commit and become ready after finalization.
- Pause, resume, retry, cancel and remove files.
- Follow a ready file link. The playground serves it through the real file controller.

The default storage is local filesystem under `apps/playground/.data/uploads`. The default authentication is intentionally permissive and is only for a local trusted environment.

## Test against S3Mock

Start the local S3-compatible service, then start the playground in S3 mode:

```bash
pnpm s3:up
PLAYGROUND_S3=1 pnpm playground
```

The server uses `http://127.0.0.1:9090`, bucket `uploads-test` and path-style access. Stop S3Mock with:

```bash
pnpm s3:down
```

You can override `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY` and `S3_SECRET_KEY`. See `apps/playground/.env.example`.

S3Mock is a contract-test target, not a production S3 replacement. For production use real S3 or another S3-compatible store, and replace the playground authorization with the application's authentication.

## Structure

| Path              | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `server/index.ts` | WebAFX application, policies, storage mode and callbacks |
| `src/App.tsx`     | Fluent UI upload client with image and document trays    |
| `vite.config.ts`  | Vite server and `/api` proxy                             |

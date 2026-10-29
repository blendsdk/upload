# Getting started

BlendSDK Upload separates the byte transport from the application workflow:

1. The browser asks the server for an upload policy.
2. The server creates a session and returns a short-lived upload token.
3. The browser sends bytes with tus.
4. The server validates, processes and stores the file.
5. The application attaches the file to its own domain record through a callback.

## Install

```bash
pnpm add @blendsdk/upload-core @blendsdk/upload-client
pnpm add @blendsdk/webafx-upload
pnpm add @blendsdk/fluentui-upload
```

`@blendsdk/webafx-upload` peers on the public `blendsdk` umbrella package, Express 5 and Zod 4. The React package peers on React 19 and Fluent UI v9.

## Minimal server

```ts
import { uploadPlugin, LocalUploadStorage } from '@blendsdk/webafx-upload';
import { createDocumentPolicy, createImagePolicy } from '@blendsdk/upload-core';

app.use(
  uploadPlugin({
    tokenSecret: process.env.UPLOAD_TOKEN_SECRET!,
    basePath: '/api/uploads',
    storage: new LocalUploadStorage('./var/uploads'),
    policies: {
      'actor.document': createDocumentPolicy('actor.document'),
      'actor.visual': createImagePolicy('actor.visual'),
    },
    authorizeSession: async ({ principal, input }) => {
      // Verify that the principal may upload this purpose and context.
      return { ownerId: String(principal?.id ?? '') };
    },
    onFinalized: async ({ session, files }) => {
      // Insert the application's own file/attachment records here.
      return { externalId: files[0]?.id };
    },
  }),
);
```

## Minimal client

```ts
import { createUploadClient, createUploadManager } from '@blendsdk/upload-client';

const client = createUploadClient({
  baseUrl: '/api/uploads',
  getHeaders: () => ({ Authorization: `Bearer ${appToken}` }),
});

const manager = createUploadManager({
  client,
  purpose: 'actor.visual',
  context: { actor_id: 'actor-1' },
  autoStart: true,
});
```

## Minimal React

```tsx
import { FileUpload } from '@blendsdk/fluentui-upload';

<FileUpload
  client={client}
  purpose="actor.visual"
  context={{ actor_id: 'actor-1' }}
  autoStart
  onUploaded={(items) => console.log(items)}
/>;
```

Continue with [installation](/guide/installation), [server setup](/guide/server), [client setup](/guide/client) and the [React component](/guide/react-component).

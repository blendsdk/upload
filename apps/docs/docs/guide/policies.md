# Policies

A policy is data, not a controller subclass. It declares accepted types, size and count limits, commit mode, retention and the processor used after validation.

```ts
import { createDocumentPolicy, createImagePolicy } from '@blendsdk/upload-core';

const policies = {
  'actor.document': createDocumentPolicy('actor.document', {
    constraints: { accept: ['application/pdf'], maxSize: 50 * 1024 * 1024, maxFiles: 10 },
  }),
  'actor.visual': createImagePolicy('actor.visual', {
    constraints: {
      accept: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 25 * 1024 * 1024,
      maxFiles: 20,
      minWidth: 600,
      minHeight: 800,
      maxPixels: 50_000_000,
    },
  }),
};
```

## Commit modes

| Mode        | Behaviour                                                                  |
| ----------- | -------------------------------------------------------------------------- |
| `immediate` | Finalize moves the file to final storage and marks it ready                |
| `deferred`  | Finalize stages the file; commit attaches it and moves it to final storage |

Use deferred commit for dialogs and signup forms so a cancelled form does not leave attached files.

## Processors

`SharpImageProcessor` is the default for policies that accept images. It checks dimensions, auto-rotates, strips metadata from derivatives and writes WebP display and thumbnail variants. Supply a custom `UploadProcessor` for PDF inspection, malware scanning, video posters or other needs.

## HEIC

The prebuilt `sharp` binary does not include HEIC/HEIF decoding because of HEVC licensing. Install the optional `heic-convert` peer and provide a decoder:

```ts
import { HeicConvertDecoder, uploadPlugin } from '@blendsdk/webafx-upload';

app.use(
  uploadPlugin({
    ...options,
    heicDecoder: new HeicConvertDecoder(),
    policies: {
      ...options.policies,
      'actor.visual': createImagePolicy('actor.visual', {
        constraints: {
          ...createImagePolicy('actor.visual').constraints,
          accept: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
        },
      }),
    },
  }),
);
```

Only accept HEIC when the decoder is installed; otherwise reject it with a clear unsupported-type message.

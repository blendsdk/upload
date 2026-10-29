---
layout: home

hero:
  name: BlendSDK Upload
  text: Resumable file uploads for BlendSDK v5
  tagline: React 19, Fluent UI v9, tus and a server-side finalization pipeline.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Packages
      link: /packages/upload-core
    - theme: alt
      text: GitHub
      link: https://github.com/blendsdk/upload

features:
  - title: Resumable by default
    details: tus handles offsets, retries, pause/resume and mobile network changes without base64 chunks.
  - title: Policy driven
    details: Documents, images and future purposes share one session, validation and finalization pipeline.
  - title: Fluent UI v9
    details: A React 19 component with accessible dropzone, file list, progress and per-file recovery.
  - title: WebAFX v5 native
    details: Uses the public blendsdk umbrella package, WebAFX controllers, service container and error envelope.
---

## What is included

| Package                     | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `@blendsdk/upload-core`     | Schemas, types, validation and state rules        |
| `@blendsdk/upload-client`   | Queue, retry, resume and tus transport            |
| `@blendsdk/webafx-upload`   | Session API, tus server, storage and finalization |
| `@blendsdk/fluentui-upload` | React 19 / Fluent UI v9 component                 |

The project is versioned and published in lockstep with `@blendsdk/lockstep`.

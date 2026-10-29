# Architecture

## Package graph

```
@blendsdk/upload-core
  ├── @blendsdk/upload-client ──► tus-js-client
  ├── @blendsdk/webafx-upload ──► blendsdk/webafx, @tus/server, @tus/file-store, file-type, sharp
  └── @blendsdk/fluentui-upload ─► upload-client, React 19, Fluent UI v9
```

The graph is acyclic. Server packages do not import React or Fluent UI. UI packages do not import Express, tus or sharp. Core and client do not depend on BlendSDK.

## Session protocol

```
pending → uploading → uploaded → processing → ready
                                  ↘ staged → committed
        ↘ canceled / expired / failed
```

A session stores the declared file, constraints, context, commit mode, expiry, transport id and result. The upload token is short-lived and session-bound. The byte path uses tus; the JSON path uses WebAFX controllers and the standard envelope.

## Finalization

1. Verify actual size against the declared size.
2. Detect content type by magic bytes.
3. Compute SHA-256.
4. Move the source to the final or staging path.
5. Run the purpose processor.
6. Persist the file records and session result.
7. Invoke the application callback.

## Storage and scope

Storage keys are generated. The opaque scope is hashed before it becomes a directory name. Local layout:

```
<root>/tus
<root>/scopes/<scope-hash>/staging
<root>/scopes/<scope-hash>/files
```

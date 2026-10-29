# Ambiguity Register

| ID    | Decision          | Resolution                                                                  |
| ----- | ----------------- | --------------------------------------------------------------------------- |
| AR-01 | Runtime           | BlendSDK v5, Node 22, pnpm 12.x, React 19, Fluent UI v9                     |
| AR-02 | Scope             | Greenfield package family; no CastingAppMT compatibility or migration       |
| AR-03 | Transport         | tus 1.0 with `@tus/server` and `tus-js-client`                              |
| AR-04 | Package split     | Four packages in one repository                                             |
| AR-05 | Server dependency | Public `blendsdk` umbrella package, not private `@blendsdk/webafx`          |
| AR-06 | Commit mode       | Deferred for image/form uploads; immediate for document/direct uploads      |
| AR-07 | Persistence       | Memory store for tests; PostgreSQL JSONB adapter for production             |
| AR-08 | Storage           | Local filesystem default; object storage behind `UploadStorage`             |
| AR-09 | HEIC              | Not decoded by default; host may add a decoder                              |
| AR-10 | Release           | Lockstep 1.4.1, exact `next`/`beta`, annotated tags, OIDC publishing        |
| AR-11 | Docs              | VitePress at `/upload/`, GitHub Pages from `main`                           |
| AR-12 | UI dependency     | Fluent UI v9 primitives; optional use of the custom component library later |

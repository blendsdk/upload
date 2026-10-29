# Plan Requirements

> **Implements**: upload-system/RD-01–RD-06

This plan adds no requirements beyond the RD set. Planning decisions that the RDs left open:

- **Build split:** `tsc` for core, client and server; Vite plus `tsc` declarations for the React package; Vite for the example.
- **Persistence default:** memory store for tests and examples; PostgreSQL adapter included for production.
- **Storage default:** local filesystem; object storage is an `UploadStorage` adapter.
- **Finalization:** client calls `finalize` after tus success; the server never moves bytes inside the tus finish hook, so a finalize failure is retryable.
- **Deferred commit:** image policies default to deferred; document policies default to immediate.
- **UI ownership:** the component renders the queue and controls, never the host dialog or form commit.
- **Release:** exact tags for `next`/`beta`, annotated `vX.Y.Z` tags, preflight and npm trusted publishing.

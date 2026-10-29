# Plan Ambiguity Register

| ID    | Decision             | Resolution                                                                        |
| ----- | -------------------- | --------------------------------------------------------------------------------- |
| PA-01 | Vite scope           | Vite builds the React library and example; `tsc` builds Node/core packages        |
| PA-02 | Finalization trigger | Client calls `finalize`; tus finish only marks uploaded                           |
| PA-03 | Staging              | Deferred sessions store the original in staging; variants are generated at commit |
| PA-04 | File serving         | Package controller owns range, ETag and disposition; host owns authorization      |
| PA-05 | Cleanup              | Plugin interval plus `UploadMaintenance`; host may run it externally              |
| PA-06 | Release tagging      | Workflow creates annotated tags explicitly when `--no-git-commit` is used         |
| PA-07 | Docs host            | GitHub Pages project site with `base: '/upload/'`                                 |

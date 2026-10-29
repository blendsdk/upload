# Findings

No critical or major findings remain open for the first release.

## Accepted deferrals

- Browser E2E is not included in the first release; the React contract is covered by jsdom and the build verifies the package.
- Malware scanning is a processor integration point, not a bundled dependency.
- HEIC requires a host-provided decoder because the prebuilt sharp binary does not include the codec.
- S3/object storage and Redis locking are interfaces with local/in-memory defaults.

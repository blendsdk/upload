# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through the repository's GitHub Security
Advisories. Do not open a public issue for an unpatched vulnerability.

Include the affected package and version, reproduction steps, impact and any suggested
mitigation. Do not include live upload tokens, secrets or personal file contents.

## Supported versions

The latest `0.x` release receives security fixes. Once `1.0` is released, the latest
major version is supported.

## Security model

- Upload tokens are signed, short-lived, session-bound and scope-bound.
- Session creation and file reads are authorized by the host application.
- The server detects file content with magic bytes and validates image dimensions.
- User file names never become storage paths.
- Documents are served as attachments by default with `X-Content-Type-Options:
nosniff`.
- The host is responsible for adding a malware scanner where its threat model requires
  one.

## Secret handling

`UPLOAD_TOKEN_SECRET` must be provided by the deployment secret store. Do not commit it,
log it, expose it to the browser or reuse an application session secret without review.

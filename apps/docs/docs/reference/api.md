# API overview

## `GET /policy/:purpose`

Returns the effective policy:

```json
{
  "success": true,
  "data": {
    "purpose": "actor.visual",
    "protocolVersion": 1,
    "chunkSize": 8388608,
    "commitMode": "deferred",
    "constraints": {
      "accept": ["image/jpeg", "image/png", "image/webp"],
      "maxSize": 26214400,
      "maxFiles": 20,
      "maxPixels": 50000000
    }
  }
}
```

## `POST /sessions`

```json
{
  "purpose": "actor.visual",
  "file": {
    "name": "portrait.jpg",
    "size": 1048576,
    "type": "image/jpeg",
    "lastModified": 1760000000000
  },
  "context": { "actor_id": "actor-1" },
  "resumeKey": "client-generated-key"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "protocolVersion": 1,
    "id": "8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e",
    "token": "<upload-token>",
    "tusEndpoint": "/api/uploads/tus",
    "chunkSize": 8388608,
    "expiresAt": "2026-10-30T12:00:00.000Z",
    "constraints": { "accept": ["image/jpeg"], "maxSize": 26214400, "maxFiles": 20 }
  }
}
```

## `GET /sessions/:id`

Send the upload token as `Authorization: Bearer <token>` for anonymous sessions, or use application authentication and the session owner. Returns the public session, including `status`, `bytesUploaded`, `bytesTotal`, `error` and `result`.

## `POST /sessions/:id/finalize`

Idempotently validates and processes the completed tus upload. Returns the session in `processing`, `ready`, `staged` or `failed`.

## `POST /sessions/commit`

```json
{
  "ids": ["8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e"],
  "context": { "actor_id": "actor-1" }
}
```

Commits staged sessions after application authentication. Returns `{ results: UploadSession[] }`.

## Errors

WebAFX errors use the standard envelope:

```json
{
  "success": false,
  "error": {
    "code": "file_too_large",
    "message": "The file is larger than 25 MB.",
    "statusCode": 413,
    "details": { "retryability": "terminal" }
  }
}
```

Stable codes include `file_too_large`, `unsupported_type`, `mime_mismatch`, `invalid_content`, `image_too_small`, `image_too_large`, `not_authorized`, `not_found`, `session_expired`, `upload_incomplete`, `processing_failed`, `storage_error` and `internal_error`.

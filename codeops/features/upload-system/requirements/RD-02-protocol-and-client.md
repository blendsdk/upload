# RD-02: Shared Protocol and Client Engine

> **Status**: Implemented
> **Project**: upload
> **Depends On**: RD-01

## Functional Requirements

- A shared package defines the wire types, Zod schemas, error codes, policies, validation and session state machine.
- The client package defines a framework-agnostic upload manager with a bounded queue.
- The manager supports add, start, pause, resume, retry, cancel, remove, commit and aggregate state.
- The transport boundary supports tus and test doubles; the default transport is `tus-js-client`.
- Session creation is idempotent through a client resume key.
- File validation mirrors the server policy before a session is created.
- Progress, failure and ready states are immutable snapshots suitable for `useSyncExternalStore`.
- Tokens stay in memory; resume metadata contains no token and no file blob.
- The client supports concurrent files and per-file recovery.

## Acceptance Criteria

- [x] Core schemas parse valid requests and reject malformed requests.
- [x] The manager uploads a valid file to a ready state with a fake transport.
- [x] Invalid file types fail before session creation.
- [x] Ready sessions can be committed.
- [x] Unit tests cover the state machine, validation, schemas and manager.

# Upload Playground Implementation Plan

> **Feature**: Local full-stack playground
> **Status**: Done
> **Created**: 2026-10-30
> **Implements**: upload-playground/RD-01
> **CodeOps Artifact Schema**: 1

## Overview

Add a private reference application that exercises the real server and client boundaries without touching CastingAppMT.

| Area          | Decision                                                     |
| ------------- | ------------------------------------------------------------ |
| Server        | WebAFX application with `uploadPlugin`                       |
| Client        | React 19 + Fluent UI v9 `FileUpload` and real `TusTransport` |
| Storage       | Local filesystem by default; S3Mock when `PLAYGROUND_S3=1`   |
| Dev transport | Vite proxy from port 5174 to WebAFX on port 3001             |
| Security      | Permissive local-only authorization; not for deployment      |

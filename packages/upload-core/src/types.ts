/**
 * Wire and in-memory types shared by the upload client, server and UI.
 *
 * The protocol version is deliberately independent from the package version:
 * a client can talk to a server from a different release as long as the
 * protocol version and the request schemas still match.
 */
export const UPLOAD_PROTOCOL_VERSION = 1 as const;

/** Lifecycle of one upload session. */
export type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'staged'
  | 'committed'
  | 'failed'
  | 'expired'
  | 'canceled';

/** Stable machine-readable error codes returned by the server and client. */
export type UploadErrorCode =
  | 'invalid_request'
  | 'file_too_large'
  | 'unsupported_type'
  | 'too_many_files'
  | 'empty_file'
  | 'mime_mismatch'
  | 'invalid_content'
  | 'image_too_small'
  | 'image_too_large'
  | 'virus_detected'
  | 'quota_exceeded'
  | 'session_expired'
  | 'not_authorized'
  | 'not_found'
  | 'upload_incomplete'
  | 'processing_failed'
  | 'storage_error'
  | 'network_error'
  | 'canceled'
  | 'internal_error';

/** Whether a failed upload may be retried without user intervention. */
export type UploadRetryability = 'retryable' | 'terminal';

/** One validation or transport error. */
export interface UploadErrorDetail {
  code: UploadErrorCode;
  message: string;
  retryability: UploadRetryability;
  details?: Record<string, unknown>;
}

/** File facts declared by the browser before any bytes are sent. */
export interface UploadFileDescriptor {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
}

/** Constraints resolved by the server for one upload purpose. */
export interface UploadConstraints {
  /** Accepted MIME types or extension patterns, for example `image/png` or `.pdf`. */
  accept: string[];
  maxSize: number;
  maxFiles: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
}

/** Whether a finalized file is attached immediately or waits for a commit. */
export type UploadCommitMode = 'immediate' | 'deferred';

/** Declarative policy for one purpose, such as `actor.document` or `actor.visual`. */
export interface UploadPolicy {
  purpose: string;
  constraints: UploadConstraints;
  commitMode: UploadCommitMode;
  retentionDays?: number;
  contentDisposition?: 'inline' | 'attachment';
  description?: string;
}

/** One stored representation of an uploaded file. */
export interface StoredUploadFile {
  id: string;
  role: 'original' | 'display' | 'thumb' | 'poster' | string;
  name: string;
  mime: string;
  size: number;
  sha256?: string;
  width?: number;
  height?: number;
  url?: string;
}

/** Result returned once a session reaches `ready` or `staged`. */
export interface UploadResult {
  files: StoredUploadFile[];
  externalId?: string;
}

/** Public session state returned by the status endpoint. */
export interface UploadSession {
  id: string;
  scope?: string;
  purpose: string;
  status: UploadStatus;
  file: UploadFileDescriptor;
  bytesUploaded: number;
  bytesTotal: number;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  error?: UploadErrorDetail;
  result?: UploadResult;
}

/** Request body for creating a session. */
export interface CreateUploadSessionRequest {
  purpose: string;
  file: UploadFileDescriptor;
  scope?: string;
  context?: Record<string, unknown>;
  resumeKey?: string;
  grant?: string;
}

/** Response returned after a session is created. */
export interface CreateUploadSessionResponse {
  protocolVersion: number;
  id: string;
  token: string;
  tusEndpoint: string;
  /** Existing tus resource to resume, when the session already created one. */
  uploadUrl?: string;
  /** Current server status when an existing session is reused. */
  status?: UploadSession['status'];
  /** Result when an existing session is already finalized. */
  result?: UploadResult;
  chunkSize: number;
  expiresAt: string;
  constraints: UploadConstraints;
}

/** Request body for committing one or more staged sessions. */
export interface CommitUploadSessionsRequest {
  ids: string[];
  context?: Record<string, unknown>;
}

/** Result of a policy lookup. */
export interface UploadPolicyResponse extends UploadPolicy {
  protocolVersion: number;
  chunkSize: number;
}

/** Client-side lifecycle used by the upload manager. */
export type UploadItemStatus =
  | 'queued'
  | 'validating'
  | 'preparing'
  | 'creating'
  | 'uploading'
  | 'paused'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'canceled';

/** Immutable state for one file in the client queue. */
export interface UploadItemState {
  id: string;
  file: UploadFileDescriptor;
  status: UploadItemStatus;
  bytesUploaded: number;
  bytesTotal: number;
  progress: number;
  attempt: number;
  sessionId?: string;
  result?: UploadResult;
  error?: UploadErrorDetail;
}

/** Aggregate state exposed by the upload manager. */
export interface UploadManagerState {
  items: UploadItemState[];
  isUploading: boolean;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  totalBytes: number;
  uploadedBytes: number;
}

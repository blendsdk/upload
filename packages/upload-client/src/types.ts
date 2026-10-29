import type {
  CommitUploadSessionsRequest,
  CreateUploadSessionRequest,
  CreateUploadSessionResponse,
  UploadFileDescriptor,
  UploadManagerState,
  UploadPolicyResponse,
  UploadSession,
} from '@blendsdk/upload-core';

/** HTTP functions used by the upload client. */
export interface UploadClientOptions {
  /** Base URL of the upload API, for example `/api/uploads`. */
  baseUrl: string;
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Authentication headers for application-authenticated endpoints. */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

/** The JSON API used by the manager and the UI. */
export interface UploadClient {
  getPolicy(purpose: string): Promise<UploadPolicyResponse>;
  createSession(input: CreateUploadSessionRequest): Promise<CreateUploadSessionResponse>;
  getSession(id: string, token?: string): Promise<UploadSession>;
  finalize(id: string, token?: string): Promise<UploadSession>;
  cancel(id: string, token?: string): Promise<void>;
  commit(input: CommitUploadSessionsRequest): Promise<UploadSession[]>;
}

/** The create-session facts the transport needs. */
export interface TransportSession {
  id: string;
  purpose: string;
  token: string;
  tusEndpoint: string;
  chunkSize: number;
}

/** One controllable transport upload. */
export interface UploadTransportHandle {
  readonly promise: Promise<void>;
  pause(): void;
  resume(): void;
  cancel(): void;
}

/** Transport boundary so tests and future direct-to-storage adapters can replace tus. */
export interface UploadTransport {
  start(input: {
    file: File;
    session: TransportSession;
    onProgress: (bytesUploaded: number, bytesTotal: number) => void;
    signal?: AbortSignal;
  }): UploadTransportHandle;
}

/** Persist resume keys across page reloads without storing tokens or blobs. */
export interface UploadResumeStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

/** Options for creating a manager. */
export interface UploadManagerOptions {
  client: UploadClient;
  purpose: string;
  context?: Record<string, unknown>;
  scope?: string;
  concurrency?: number;
  autoStart?: boolean;
  transport?: UploadTransport;
  resumeStore?: UploadResumeStore;
  /** Optional already-resolved policy to avoid the first policy request. */
  policy?: UploadPolicyResponse;
  /** Called whenever the aggregate state changes. */
  onChange?: (state: UploadManagerState) => void;
}

/** Stable client-side fingerprint used for resume and duplicate detection. */
export interface FileFingerprint {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

/** Convert a browser File to the wire descriptor. */
export function toFileDescriptor(file: File): UploadFileDescriptor {
  return {
    name: file.name,
    size: file.size,
    ...(file.type ? { type: file.type } : {}),
    lastModified: file.lastModified,
  };
}

/** Build a stable fingerprint for one file. */
export function fingerprint(file: UploadFileDescriptor): FileFingerprint {
  return {
    name: file.name,
    size: file.size,
    type: file.type ?? '',
    lastModified: file.lastModified ?? 0,
  };
}

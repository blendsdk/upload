import type { Readable } from 'node:stream';
import type { Locker } from '@tus/server';
import type {
  CreateUploadSessionRequest,
  StoredUploadFile,
  UploadConstraints,
  UploadErrorDetail,
  UploadFileDescriptor,
  UploadPolicy,
  UploadSession,
  UploadStatus,
} from '@blendsdk/upload-core';

/** One stored representation, with the private storage key used by the server. */
export interface UploadFileRecord extends StoredUploadFile {
  storageKey: string;
}

/** Server-side session record. */
export interface UploadSessionRecord extends UploadSession {
  status: UploadStatus;
  context: Record<string, unknown>;
  constraints: UploadConstraints;
  commitMode: UploadPolicy['commitMode'];
  contentDisposition: UploadPolicy['contentDisposition'];
  retentionDays?: number;
  ownerId?: string;
  clientKey?: string;
  tokenHash?: string;
  tusUploadId?: string;
  files: UploadFileRecord[];
  updatedAt: string;
}

/** Result of resolving who may create or access a session. */
export interface UploadAccess {
  ownerId?: string;
  scope?: string;
}

/** Context supplied to `authorizeSession`. */
export interface AuthorizeSessionContext {
  principal: unknown;
  input: CreateUploadSessionRequest;
  policy: UploadPolicy;
  request: unknown;
}

/** Context supplied to `authorizeFile`. */
export interface AuthorizeFileContext {
  principal: unknown;
  session: UploadSessionRecord;
  file: UploadFileRecord;
  request: unknown;
}

/** Context supplied to `onFinalized`. */
export interface FinalizedUploadContext {
  session: UploadSessionRecord;
  files: UploadFileRecord[];
  principal?: unknown;
}

/** Context supplied to `onCommitted`. */
export interface CommittedUploadContext extends FinalizedUploadContext {
  context?: Record<string, unknown>;
}

/** Context supplied to `onDeleted`. */
export interface DeletedUploadContext {
  session: UploadSessionRecord;
  principal?: unknown;
}

/** Processor context for one validated source file. */
export interface UploadProcessorContext {
  session: UploadSessionRecord;
  fileId: string;
  sourcePath: string;
  detectedMime: string;
  extension: string;
  scope?: string;
  storage: UploadStorage;
  signal?: AbortSignal;
}

/** A processor turns a validated source file into additional stored variants. */
export interface UploadProcessor {
  process(context: UploadProcessorContext): Promise<UploadFileRecord[]>;
}

/** Storage boundary for local disk now and object storage later. */
export interface UploadStorage {
  /** Directory used by the tus FileStore for in-progress bytes. */
  readonly tusDirectory: string;
  /** Path for an in-progress or deferred file. */
  stagingPath(scope: string | undefined, sessionId: string, extension: string): string;
  /** Path for a finalized file or variant. */
  finalPath(scope: string | undefined, fileId: string, role: string, extension: string): string;
  ensureParent(filePath: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  write(filePath: string, data: Uint8Array): Promise<void>;
  delete(filePath: string): Promise<void>;
  stat(filePath: string): Promise<{ size: number }>;
  readStream(filePath: string, range?: { start: number; end: number }): Readable;
  exists(filePath: string): Promise<boolean>;
}

/** Persistence boundary for upload sessions. */
export interface UploadStore {
  create(record: UploadSessionRecord): Promise<void>;
  get(id: string): Promise<UploadSessionRecord | undefined>;
  update(id: string, patch: Partial<UploadSessionRecord>): Promise<UploadSessionRecord | undefined>;
  updateIfStatus(
    id: string,
    statuses: UploadStatus[],
    patch: Partial<UploadSessionRecord>,
  ): Promise<UploadSessionRecord | undefined>;
  findByClientKey(
    scope: string | undefined,
    ownerId: string | undefined,
    clientKey: string,
  ): Promise<UploadSessionRecord | undefined>;
  countActive(scope: string | undefined, ownerId: string | undefined): Promise<number>;
  findFile(
    fileId: string,
  ): Promise<{ session: UploadSessionRecord; file: UploadFileRecord } | undefined>;
  listExpired(now: Date): Promise<UploadSessionRecord[]>;
  delete(id: string): Promise<void>;
}

/** Minimal structured logger contract. */
export interface UploadLogger {
  info(message: string, details?: Record<string, unknown>): void | Promise<void>;
  warn(message: string, details?: Record<string, unknown>): void | Promise<void>;
  error(message: string, details?: Record<string, unknown>): void | Promise<void>;
  debug?(message: string, details?: Record<string, unknown>): void | Promise<void>;
}

/** Options for the WebAFX upload plugin. */
export interface UploadServerOptions {
  tokenSecret: string;
  policies: Record<string, UploadPolicy>;
  basePath?: string;
  store?: UploadStore;
  storage?: UploadStorage;
  storageRoot?: string;
  chunkSize?: number;
  sessionTtlSeconds?: number;
  stagedTtlSeconds?: number;
  maxTusSize?: number;
  maxActiveSessions?: number;
  cleanupIntervalMs?: number;
  tusLocker?: Locker;
  processors?: Record<string, UploadProcessor>;
  authorizeSession?: (
    context: AuthorizeSessionContext,
  ) => Promise<UploadAccess | false | undefined> | UploadAccess | false | undefined;
  authorizeFile?: (context: AuthorizeFileContext) => Promise<boolean> | boolean;
  onFinalized?: (
    context: FinalizedUploadContext,
  ) => Promise<{ externalId?: string } | void> | { externalId?: string } | void;
  onCommitted?: (
    context: CommittedUploadContext,
  ) => Promise<{ externalId?: string } | void> | { externalId?: string } | void;
  onDeleted?: (context: DeletedUploadContext) => Promise<void> | void;
  logger?: UploadLogger;
}

/** Input used by the finalizer. */
export interface FinalizeOptions {
  principal?: unknown;
}

/** Resolved policy response returned by the server. */
export interface ServerPolicy {
  policy: UploadPolicy;
  chunkSize: number;
}

/** Internal file descriptor used while finalizing. */
export interface DetectedFile {
  descriptor: UploadFileDescriptor;
  detectedMime: string;
  extension: string;
  size: number;
  sha256: string;
}

/** Public error shape returned by the API. */
export interface UploadApiErrorBody {
  code: string;
  message: string;
  retryability: 'retryable' | 'terminal';
  details?: Record<string, unknown>;
}

export type { UploadErrorDetail };

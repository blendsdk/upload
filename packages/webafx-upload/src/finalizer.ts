import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import {
  UploadError,
  sanitizeFileName,
  toUploadError,
  type UploadPolicy,
  type UploadStatus,
} from '@blendsdk/upload-core';
import type {
  CommittedUploadContext,
  DeletedUploadContext,
  FinalizedUploadContext,
  UploadFileRecord,
  UploadLogger,
  UploadProcessor,
  UploadServerOptions,
  UploadSessionRecord,
  UploadStorage,
  UploadStore,
} from './types.js';

export interface UploadFinalizerOptions {
  store: UploadStore;
  storage: UploadStorage;
  policies: Record<string, UploadPolicy>;
  processors: Record<string, UploadProcessor>;
  resolveUploadPath: (session: UploadSessionRecord) => Promise<string>;
  onFinalized?: UploadServerOptions['onFinalized'];
  onCommitted?: UploadServerOptions['onCommitted'];
  onDeleted?: UploadServerOptions['onDeleted'];
  logger?: UploadLogger;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.docx',
  'application/x-cfb': '.doc',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

function extensionFor(mime: string, fallbackName: string): string {
  const known = MIME_EXTENSIONS[mime];
  if (known) {
    return known;
  }
  return path.extname(fallbackName).toLowerCase() || '.bin';
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

function asStatus(value: string): UploadStatus {
  return value as UploadStatus;
}

/**
 * Validate, process and place completed tus uploads.
 *
 * Finalization is idempotent at the session level: a status claim prevents two
 * concurrent finalizers from moving the same file, and callbacks receive the
 * same file IDs on retry.
 */
export class UploadFinalizer {
  private readonly inFlight = new Set<string>();

  public constructor(private readonly options: UploadFinalizerOptions) {}

  public async finalize(sessionId: string, principal?: unknown): Promise<UploadSessionRecord> {
    if (this.inFlight.has(sessionId)) {
      const current = await this.options.store.get(sessionId);
      if (!current) {
        throw new UploadError('not_found', 'The upload session does not exist.');
      }
      return current;
    }

    const session = await this.options.store.get(sessionId);
    if (!session) {
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    if (
      session.status === 'ready' ||
      session.status === 'staged' ||
      session.status === 'committed'
    ) {
      return session;
    }
    if (session.status === 'failed' && session.files.length > 0) {
      if (this.options.onFinalized) {
        await this.options.onFinalized({ session, files: session.files, principal });
      }
      const status: UploadStatus = session.commitMode === 'deferred' ? 'staged' : 'ready';
      return (
        (await this.options.store.update(sessionId, {
          status,
          error: undefined,
          completedAt: new Date().toISOString(),
        })) ?? session
      );
    }
    if (session.status !== 'uploaded' && session.status !== 'failed') {
      throw new UploadError('upload_incomplete', 'The upload has not finished yet.', 'retryable');
    }
    if (!session.tusUploadId) {
      throw new UploadError(
        'upload_incomplete',
        'The upload has no transport record.',
        'retryable',
      );
    }

    this.inFlight.add(sessionId);
    try {
      await this.options.store.update(sessionId, { status: 'processing' });
      const sourcePath = await this.options.resolveUploadPath(session);
      const sourceStat = await stat(sourcePath);
      if (sourceStat.size !== session.file.size) {
        throw new UploadError(
          'upload_incomplete',
          `The server received ${sourceStat.size} bytes, expected ${session.file.size}.`,
          'retryable',
        );
      }

      const detected = await fileTypeFromFile(sourcePath);
      const declaredMime = (session.file.type ?? '').toLowerCase();
      const detectedMime = detected?.mime ?? (declaredMime || 'application/octet-stream');
      if (declaredMime && detected && detected.mime !== declaredMime) {
        const toleratedDocx =
          declaredMime ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
          detected.mime === 'application/zip';
        const toleratedDoc =
          declaredMime === 'application/msword' && detected.mime === 'application/x-cfb';
        if (!toleratedDocx && !toleratedDoc) {
          throw new UploadError(
            'mime_mismatch',
            'The file content does not match its declared type.',
          );
        }
      }

      const sha256 = await sha256File(sourcePath);
      const extension = extensionFor(detectedMime, session.file.name);
      const originalId = randomUUID();
      const isDeferred = session.commitMode === 'deferred';
      const originalPath = isDeferred
        ? this.options.storage.stagingPath(session.scope, session.id, extension)
        : this.options.storage.finalPath(session.scope, originalId, 'original', extension);
      await this.options.storage.move(sourcePath, originalPath);

      const original: UploadFileRecord = {
        id: originalId,
        role: 'original',
        name: sanitizeFileName(session.file.name),
        mime: detectedMime,
        size: sourceStat.size,
        sha256,
        storageKey: originalPath,
      };

      const files: UploadFileRecord[] = [original];
      if (!isDeferred) {
        const processor = this.options.processors[session.purpose];
        if (processor) {
          files.push(
            ...(await processor.process({
              session,
              fileId: originalId,
              sourcePath: originalPath,
              detectedMime,
              extension,
              scope: session.scope,
              storage: this.options.storage,
            })),
          );
        }
      }

      const status: UploadStatus = isDeferred ? 'staged' : 'ready';
      const updated = await this.options.store.update(sessionId, {
        status,
        files,
        completedAt: new Date().toISOString(),
        result: {
          files: files.map(({ storageKey: _storageKey, ...file }) => file),
        },
        bytesUploaded: session.file.size,
      });

      if (!updated) {
        throw new UploadError('internal_error', 'The session disappeared during finalization.');
      }

      if (this.options.onFinalized) {
        await this.options.onFinalized({
          session: updated,
          files,
          principal,
        } satisfies FinalizedUploadContext);
      }

      return updated;
    } catch (error) {
      const detail = toUploadError(error, 'processing_failed').toDetail();
      await this.options.store.update(sessionId, {
        status: 'failed',
        error: detail,
      });
      await this.options.logger?.error('Upload finalization failed', {
        sessionId,
        code: detail.code,
      });
      throw error instanceof UploadError ? error : toUploadError(error, 'processing_failed');
    } finally {
      this.inFlight.delete(sessionId);
    }
  }

  public async commit(
    sessionId: string,
    context: Record<string, unknown> | undefined,
    principal?: unknown,
  ): Promise<UploadSessionRecord> {
    const session = await this.options.store.get(sessionId);
    if (!session) {
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    if (session.status === 'committed' || session.status === 'ready') {
      return session;
    }
    if (session.status !== 'staged') {
      throw new UploadError('invalid_request', 'Only staged uploads can be committed.');
    }

    const files: UploadFileRecord[] = [];
    for (const file of session.files) {
      if (!file.storageKey.includes(`${path.sep}staging${path.sep}`)) {
        files.push(file);
        continue;
      }
      const extension = extensionFor(file.mime, file.name);
      const finalKey = this.options.storage.finalPath(session.scope, file.id, file.role, extension);
      await this.options.storage.move(file.storageKey, finalKey);
      files.push({ ...file, storageKey: finalKey });
    }

    const processor = this.options.processors[session.purpose];
    if (processor && !files.some((file) => file.role !== 'original')) {
      const original = files.find((file) => file.role === 'original');
      if (original) {
        files.push(
          ...(await processor.process({
            session,
            fileId: original.id,
            sourcePath: original.storageKey,
            detectedMime: original.mime,
            extension: extensionFor(original.mime, original.name),
            scope: session.scope,
            storage: this.options.storage,
          })),
        );
      }
    }

    const updated = await this.options.store.update(sessionId, {
      status: 'committed',
      files,
      completedAt: new Date().toISOString(),
      result: {
        files: files.map(({ storageKey: _storageKey, ...file }) => file),
      },
    });
    if (!updated) {
      throw new UploadError('internal_error', 'The session disappeared during commit.');
    }

    if (this.options.onCommitted) {
      await this.options.onCommitted({
        session: updated,
        files,
        context,
        principal,
      } satisfies CommittedUploadContext);
    }
    return updated;
  }

  public async expire(sessionId: string): Promise<void> {
    const session = await this.options.store.get(sessionId);
    if (!session) {
      return;
    }
    for (const file of session.files) {
      await this.options.storage.delete(file.storageKey);
    }
    await this.options.store.update(sessionId, {
      status: 'expired',
      files: [],
      result: undefined,
      error: {
        code: 'session_expired',
        message: 'The upload session expired.',
        retryability: 'terminal',
      },
    });
  }

  public async delete(sessionId: string, principal?: unknown): Promise<void> {
    const session = await this.options.store.get(sessionId);
    if (!session) {
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    for (const file of session.files) {
      await this.options.storage.delete(file.storageKey);
    }
    await this.options.store.update(sessionId, {
      status: 'canceled',
      files: [],
      result: undefined,
      error: undefined,
    });
    if (this.options.onDeleted) {
      await this.options.onDeleted({ session, principal } satisfies DeletedUploadContext);
    }
  }

  /** Status helper used by controllers and tests. */
  public isFinalizing(sessionId: string): boolean {
    return this.inFlight.has(sessionId);
  }

  /** Exported for callers that need the canonical status parser. */
  public parseStatus(value: string): UploadStatus {
    return asStatus(value);
  }
}

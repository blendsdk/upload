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
  removeUpload?: (session: UploadSessionRecord) => Promise<void>;
  scanner?: UploadServerOptions['scanner'];
  onFinalized?: UploadServerOptions['onFinalized'];
  onCommitted?: UploadServerOptions['onCommitted'];
  onDeleted?: UploadServerOptions['onDeleted'];
  logger?: UploadLogger;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
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

    let session = await this.options.store.get(sessionId);
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
      const original = session.files.find((file) => file.role === 'original');
      if (!original) {
        throw new UploadError('processing_failed', 'The failed session has no original file.');
      }
      let files = [...session.files];
      if (session.commitMode === 'immediate') {
        const processor = this.options.processors[session.purpose];
        if (processor && !files.some((file) => file.role !== 'original')) {
          files = [
            ...files,
            ...(await processor.process({
              session,
              fileId: original.id,
              sourcePath: original.storageKey,
              detectedMime: original.mime,
              extension: extensionFor(original.mime, original.name),
              scope: session.scope,
              storage: this.options.storage,
            })),
          ];
        }
      }
      const status: UploadStatus = session.commitMode === 'deferred' ? 'staged' : 'ready';
      const updated = await this.options.store.update(sessionId, {
        status,
        files,
        error: undefined,
        completedAt: new Date().toISOString(),
        result: {
          files: files.map(({ storageKey: _storageKey, ...file }) => file),
        },
      });
      if (!updated) {
        throw new UploadError(
          'internal_error',
          'The session disappeared during finalization retry.',
        );
      }
      if (this.options.onFinalized) {
        await this.options.onFinalized({ session: updated, files, principal });
      }
      return updated;
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

    const claimed = await this.options.store.updateIfStatus(sessionId, ['uploaded', 'failed'], {
      status: 'processing',
    });
    if (!claimed) {
      const current = await this.options.store.get(sessionId);
      if (current) {
        return current;
      }
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    session = claimed;

    this.inFlight.add(sessionId);
    try {
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
      if (
        detectedMime === 'image/svg+xml' ||
        detectedMime === 'text/html' ||
        detectedMime === 'application/xhtml+xml' ||
        detectedMime === 'application/xml' ||
        detectedMime === 'text/xml'
      ) {
        throw new UploadError(
          'invalid_content',
          'Executable or script-bearing document types are not accepted.',
        );
      }
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

      const effectiveMime =
        detectedMime === 'application/zip' &&
        declaredMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ? declaredMime
          : detectedMime;

      if (this.options.scanner) {
        let scan;
        try {
          scan = await this.options.scanner.scan(sourcePath);
        } catch (error) {
          throw new UploadError(
            'processing_failed',
            'The security scan could not be completed.',
            'retryable',
            { scanError: error instanceof Error ? error.message : String(error) },
          );
        }
        if (!scan.clean) {
          await this.options.storage.delete(sourcePath);
          throw new UploadError(
            'virus_detected',
            'The file failed the security scan.',
            'terminal',
            { signature: scan.signature },
          );
        }
      }

      const sha256 = await sha256File(sourcePath);
      const extension = extensionFor(effectiveMime, session.file.name);
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
        mime: effectiveMime,
        size: sourceStat.size,
        sha256,
        storageKey: originalPath,
      };

      const files: UploadFileRecord[] = [original];
      // Persist the moved original before a processor can fail, so a retry
      // knows where the bytes live instead of resolving the old tus path again.
      await this.options.store.update(sessionId, { files });
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
        const callbackResult = await this.options.onFinalized({
          session: updated,
          files,
          principal,
        } satisfies FinalizedUploadContext);
        if (callbackResult?.externalId) {
          const withExternalId = await this.options.store.update(sessionId, {
            result: { ...(updated.result ?? { files: [] }), externalId: callbackResult.externalId },
          });
          if (withExternalId) {
            return withExternalId;
          }
        }
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
    let session = await this.options.store.get(sessionId);
    if (!session) {
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    if (session.status === 'committed' || session.status === 'ready') {
      return session;
    }
    if (session.status !== 'staged') {
      throw new UploadError('invalid_request', 'Only staged uploads can be committed.');
    }

    const claimed = await this.options.store.updateIfStatus(sessionId, ['staged'], {
      status: 'processing',
    });
    if (!claimed) {
      const current = await this.options.store.get(sessionId);
      if (current) {
        return current;
      }
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    session = claimed;

    const files: UploadFileRecord[] = [];
    try {
      for (const file of session.files) {
        if (!file.storageKey.includes(`${path.sep}staging${path.sep}`)) {
          files.push(file);
          continue;
        }
        const extension = extensionFor(file.mime, file.name);
        const finalKey = this.options.storage.finalPath(
          session.scope,
          file.id,
          file.role,
          extension,
        );
        await this.options.storage.move(file.storageKey, finalKey);
        files.push({ ...file, storageKey: finalKey });
      }

      await this.options.store.update(sessionId, { files });
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

      let externalId: string | undefined;
      if (this.options.onCommitted) {
        const callbackResult = await this.options.onCommitted({
          session,
          files,
          context,
          principal,
        } satisfies CommittedUploadContext);
        externalId = callbackResult?.externalId;
      }

      const updated = await this.options.store.update(sessionId, {
        status: 'committed',
        files,
        clientKey: undefined,
        completedAt: new Date().toISOString(),
        result: {
          files: files.map(({ storageKey: _storageKey, ...file }) => file),
          ...(externalId ? { externalId } : {}),
        },
      });
      if (!updated) {
        throw new UploadError('internal_error', 'The session disappeared during commit.');
      }
      return updated;
    } catch (error) {
      await this.options.store.update(sessionId, { status: 'staged', files });
      throw error instanceof UploadError ? error : toUploadError(error, 'processing_failed');
    }
  }

  public async expire(sessionId: string): Promise<void> {
    const session = await this.options.store.get(sessionId);
    if (!session) {
      return;
    }
    for (const file of session.files) {
      await this.options.storage.delete(file.storageKey);
    }
    await this.options.removeUpload?.(session);
    await this.options.store.update(sessionId, {
      status: 'expired',
      files: [],
      clientKey: undefined,
      tusUploadId: undefined,
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
    await this.options.removeUpload?.(session);
    await this.options.store.update(sessionId, {
      status: 'canceled',
      files: [],
      clientKey: undefined,
      tusUploadId: undefined,
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

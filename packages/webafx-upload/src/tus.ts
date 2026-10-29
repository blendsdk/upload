import { FileStore } from '@tus/file-store';
import { MemoryLocker, Server, type Upload } from '@tus/server';
import { readBearerToken, verifyUploadToken } from './token.js';
import type {
  UploadLogger,
  UploadServerOptions,
  UploadSessionRecord,
  UploadStore,
} from './types.js';

export interface TusServerOptions {
  basePath: string;
  store: UploadStore;
  storageDirectory: string;
  tokenSecret: string;
  maxSize?: number;
  expirationMs?: number;
  locker?: UploadServerOptions['tusLocker'];
  logger?: UploadLogger;
}

function tusError(statusCode: number, code: string, message: string): never {
  throw {
    status_code: statusCode,
    body: JSON.stringify({ success: false, error: { code, message } }),
  };
}

/**
 * Create the tus protocol server used by the upload plugin.
 *
 * The token is the only authentication on the byte path. Session creation
 * remains an application-authenticated JSON route, so a browser cookie is
 * never required for a long PATCH request and CSRF does not apply to chunks.
 */
export function createTusServer(options: TusServerOptions): {
  server: Server;
  datastore: FileStore;
} {
  const datastore = new FileStore({
    directory: options.storageDirectory,
    expirationPeriodInMilliseconds: options.expirationMs ?? 24 * 60 * 60 * 1000,
  });
  const sessions = new WeakMap<object, UploadSessionRecord>();
  const logger = options.logger;

  const server = new Server({
    path: `${options.basePath}/tus`,
    datastore,
    relativeLocation: true,
    respectForwardedHeaders: true,
    maxSize: options.maxSize ?? 2 * 1024 * 1024 * 1024,
    locker: options.locker ?? new MemoryLocker(),
    allowedCredentials: false,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Tus-Resumable',
      'Upload-Length',
      'Upload-Metadata',
      'Upload-Offset',
    ],
    exposedHeaders: [
      'Location',
      'Tus-Resumable',
      'Tus-Version',
      'Tus-Extension',
      'Tus-Max-Size',
      'Upload-Offset',
      'Upload-Length',
      'Upload-Expires',
    ],

    onIncomingRequest: async (request, uploadId) => {
      if (request.method === 'OPTIONS') {
        return;
      }
      const token = readBearerToken(request);
      if (!token) {
        tusError(401, 'not_authorized', 'An upload token is required.');
      }
      let claims;
      try {
        claims = await verifyUploadToken(token, options.tokenSecret);
      } catch {
        tusError(401, 'not_authorized', 'The upload token is invalid or expired.');
      }
      const session = await options.store.get(claims.sid);
      if (!session) {
        tusError(404, 'not_found', 'The upload session does not exist.');
      }
      if (uploadId && session.tusUploadId && uploadId !== session.tusUploadId) {
        tusError(403, 'not_authorized', 'The upload token does not match this upload.');
      }
      if (session.status === 'expired' || session.status === 'canceled') {
        tusError(410, 'session_expired', 'The upload session is no longer available.');
      }
      if (session.status === 'committed' || session.status === 'ready') {
        tusError(409, 'upload_incomplete', 'The upload is already complete.');
      }
      if (Date.parse(session.expiresAt) <= Date.now()) {
        await options.store.update(session.id, {
          status: 'expired',
          error: {
            code: 'session_expired',
            message: 'The upload session expired.',
            retryability: 'terminal',
          },
        });
        tusError(410, 'session_expired', 'The upload session expired.');
      }
      sessions.set(request, session);
    },

    onUploadCreate: async (request, upload: Upload) => {
      const session = sessions.get(request);
      if (!session) {
        tusError(401, 'not_authorized', 'The upload session was not resolved.');
      }
      if (session.status !== 'pending' && session.status !== 'uploading') {
        tusError(409, 'upload_incomplete', 'This upload session cannot accept bytes.');
      }
      if (upload.size !== undefined && upload.size !== session.file.size) {
        tusError(400, 'invalid_request', 'The tus upload length does not match the session.');
      }
      await options.store.update(session.id, {
        status: 'uploading',
        tusUploadId: upload.id,
        bytesUploaded: upload.offset,
        bytesTotal: upload.size ?? session.file.size,
      });
      await logger?.info('Upload transport created', {
        sessionId: session.id,
        uploadId: upload.id,
      });
      return {};
    },

    onUploadFinish: async (request, upload: Upload) => {
      const session = sessions.get(request);
      if (!session) {
        return {};
      }
      await options.store.update(session.id, {
        status: 'uploaded',
        tusUploadId: upload.id,
        bytesUploaded: upload.offset,
        bytesTotal: upload.size ?? session.file.size,
        error: undefined,
      });
      await logger?.info('Upload transport finished', {
        sessionId: session.id,
        uploadId: upload.id,
      });
      return {};
    },

    onResponseError: async (_request, error) => {
      const detail = error as { status_code?: number; body?: string };
      await logger?.warn('Upload transport error', {
        statusCode: detail.status_code,
        body: detail.body,
      });
      return undefined;
    },
  });

  return { server, datastore };
}

import { UploadError } from '@blendsdk/upload-core';
import * as tus from 'tus-js-client';
import type { TransportSession, UploadTransport, UploadTransportHandle } from './types.js';

/**
 * Browser tus transport.
 *
 * The transport owns only the byte stream. Session creation, validation,
 * finalization and commit remain in the manager so a future direct-to-storage
 * adapter can implement the same boundary.
 */
export class TusTransport implements UploadTransport {
  public start(input: {
    file: File;
    session: TransportSession;
    onProgress: (bytesUploaded: number, bytesTotal: number) => void;
    signal?: AbortSignal;
  }): UploadTransportHandle {
    let paused = false;
    let canceled = false;
    let settled = false;

    let resolvePromise!: () => void;
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const finish = (error?: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise();
      }
    };

    const upload = new tus.Upload(input.file, {
      endpoint: input.session.tusEndpoint,
      ...(input.session.uploadUrl ? { uploadUrl: input.session.uploadUrl } : {}),
      chunkSize: input.session.chunkSize,
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000, 20_000],
      headers: { Authorization: `Bearer ${input.session.token}` },
      metadata: {
        sessionId: input.session.id,
        purpose: input.session.purpose,
        filename: input.file.name,
        filetype: input.file.type || 'application/octet-stream',
      },
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: false,
      onProgress: (bytesUploaded, bytesTotal) => {
        input.onProgress(bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        finish();
      },
      onError: (error) => {
        if (paused || canceled) {
          return;
        }
        finish(new UploadError('network_error', error.message, 'retryable'));
      },
    });

    const onAbort = (): void => {
      canceled = true;
      upload.abort(true);
      finish();
    };
    input.signal?.addEventListener('abort', onAbort, { once: true });

    const handle: UploadTransportHandle = {
      promise,
      pause: () => {
        paused = true;
        upload.abort();
      },
      resume: () => {
        paused = false;
        upload.start();
      },
      cancel: () => {
        canceled = true;
        upload.abort(true);
        finish();
      },
    };

    upload.start();
    return handle;
  }
}

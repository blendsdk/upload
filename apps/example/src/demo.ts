import type {
  CreateUploadSessionResponse,
  UploadPolicyResponse,
  UploadSession,
} from '@blendsdk/upload-core';
import type { UploadClient, UploadTransport, UploadTransportHandle } from '@blendsdk/upload-client';

export const demoPolicy: UploadPolicyResponse = {
  purpose: 'demo.image',
  protocolVersion: 1,
  chunkSize: 8 * 1024 * 1024,
  commitMode: 'deferred',
  contentDisposition: 'inline',
  constraints: {
    accept: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 25 * 1024 * 1024,
    maxFiles: 10,
    maxPixels: 50_000_000,
  },
};

function readySession(id: string): UploadSession {
  return {
    id,
    purpose: demoPolicy.purpose,
    status: 'ready',
    file: { name: 'demo.jpg', size: 1, type: 'image/jpeg' },
    bytesUploaded: 1,
    bytesTotal: 1,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    result: {
      files: [{ id: 'demo-file', role: 'original', name: 'demo.jpg', mime: 'image/jpeg', size: 1 }],
    },
  };
}

export function createDemoClient(): UploadClient {
  let sequence = 0;
  return {
    getPolicy: async () => demoPolicy,
    createSession: async (): Promise<CreateUploadSessionResponse> => {
      sequence += 1;
      return {
        protocolVersion: 1,
        id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
        token: 'demo-token',
        tusEndpoint: '/demo/tus',
        chunkSize: demoPolicy.chunkSize,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        constraints: demoPolicy.constraints,
      };
    },
    getSession: async (id) => readySession(id),
    finalize: async (id) => readySession(id),
    cancel: async () => undefined,
    commit: async () => [],
  };
}

/** A deterministic fake transport so the demo works without a server. */
export class DemoTransport implements UploadTransport {
  public start(input: {
    file: File;
    onProgress: (bytesUploaded: number, bytesTotal: number) => void;
  }): UploadTransportHandle {
    let uploaded = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let resolvePromise!: () => void;
    let rejectPromise!: (reason: unknown) => void;
    let paused = false;
    let canceled = false;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const tick = (): void => {
      if (paused || canceled) {
        return;
      }
      uploaded = Math.min(
        input.file.size,
        uploaded + Math.max(1, Math.floor(input.file.size / 20)),
      );
      input.onProgress(uploaded, input.file.size);
      if (uploaded >= input.file.size) {
        if (timer) {
          clearInterval(timer);
        }
        resolvePromise();
      }
    };

    timer = setInterval(tick, 120);
    return {
      promise,
      pause: () => {
        paused = true;
      },
      resume: () => {
        paused = false;
      },
      cancel: () => {
        canceled = true;
        if (timer) {
          clearInterval(timer);
        }
        rejectPromise(new Error('canceled'));
      },
    };
  }
}

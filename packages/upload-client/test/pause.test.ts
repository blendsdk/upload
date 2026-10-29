import { describe, expect, it } from 'vitest';
import type {
  CreateUploadSessionResponse,
  UploadPolicyResponse,
  UploadSession,
} from '@blendsdk/upload-core';
import {
  MemoryResumeStore,
  UploadManager,
  type UploadClient,
  type UploadTransport,
  type UploadTransportHandle,
} from '../src/index.js';

const policy: UploadPolicyResponse = {
  purpose: 'test',
  protocolVersion: 1,
  chunkSize: 1024,
  commitMode: 'immediate',
  constraints: { accept: ['text/plain'], maxSize: 1024, maxFiles: 2 },
};

function session(id: string): UploadSession {
  return {
    id,
    purpose: 'test',
    status: 'ready',
    file: { name: 'a.txt', size: 4, type: 'text/plain' },
    bytesUploaded: 4,
    bytesTotal: 4,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    result: { files: [] },
  };
}

function client(): UploadClient {
  return {
    getPolicy: async () => policy,
    createSession: async (): Promise<CreateUploadSessionResponse> => ({
      protocolVersion: 1,
      id: '00000000-0000-4000-8000-000000000001',
      token: 'token',
      tusEndpoint: '/api/uploads/tus',
      chunkSize: 1024,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      constraints: policy.constraints,
    }),
    getSession: async (id: string) => session(id),
    finalize: async (id: string) => session(id),
    cancel: async () => undefined,
    commit: async () => [],
  };
}

class PausableTransport implements UploadTransport {
  public start(input: {
    file: File;
    onProgress: (bytesUploaded: number, bytesTotal: number) => void;
  }): UploadTransportHandle {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    input.onProgress(1, input.file.size);
    return {
      promise,
      pause: () => undefined,
      resume: () => {
        input.onProgress(input.file.size, input.file.size);
        resolve();
      },
      cancel: () => resolve(),
    };
  }
}

describe('UploadManager pause/resume', () => {
  it('resumes a paused transport without starting a second upload', async () => {
    const manager = new UploadManager({
      client: client(),
      purpose: 'test',
      policy,
      transport: new PausableTransport(),
      resumeStore: new MemoryResumeStore(),
    });
    await manager.addFiles([
      { name: 'a.txt', size: 4, type: 'text/plain', lastModified: 1 } as File,
    ]);
    const started = manager.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const id = manager.getState().items[0]!.id;
    manager.pause(id);
    expect(manager.getState().items[0]?.status).toBe('paused');

    manager.resume(id);
    await started;
    expect(manager.getState().items[0]?.status).toBe('ready');
  });
});

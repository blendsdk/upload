import { describe, expect, it } from 'vitest';
import type {
  CreateUploadSessionRequest,
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

function file(name: string, size = 4, type = 'text/plain'): File {
  return { name, size, type, lastModified: 1 } as File;
}

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
    result: {
      files: [{ id: 'file-1', role: 'original', name: 'a.txt', mime: 'text/plain', size: 4 }],
    },
  };
}

function client(overrides: Partial<UploadClient> = {}): UploadClient {
  let sequence = 0;
  return {
    getPolicy: async () => policy,
    createSession: async (
      _input: CreateUploadSessionRequest,
    ): Promise<CreateUploadSessionResponse> => {
      sequence += 1;
      return {
        protocolVersion: 1,
        id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
        token: 'token',
        tusEndpoint: '/api/uploads/tus',
        chunkSize: 1024,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        constraints: policy.constraints,
      };
    },
    getSession: async (id: string) => session(id),
    finalize: async (id: string) => session(id),
    cancel: async () => undefined,
    commit: async () => [session('00000000-0000-4000-8000-000000000001')],
    ...overrides,
  };
}

class ImmediateTransport implements UploadTransport {
  public start(input: {
    file: File;
    onProgress: (bytesUploaded: number, bytesTotal: number) => void;
  }): UploadTransportHandle {
    const promise = Promise.resolve().then(() => {
      input.onProgress(input.file.size, input.file.size);
    });
    return { promise, pause: () => undefined, resume: () => undefined, cancel: () => undefined };
  }
}

describe('UploadManager', () => {
  it('uploads a valid file through session creation and finalization', async () => {
    const manager = new UploadManager({
      client: client(),
      purpose: 'test',
      policy,
      transport: new ImmediateTransport(),
      resumeStore: new MemoryResumeStore(),
      concurrency: 2,
    });

    await manager.addFiles([file('a.txt')]);
    await manager.start();

    expect(manager.getState().items[0]?.status).toBe('ready');
    expect(manager.getState().completedCount).toBe(1);
  });

  it('rejects an invalid type without creating a session', async () => {
    let created = false;
    const manager = new UploadManager({
      client: client({
        createSession: async () => {
          created = true;
          throw new Error('should not be called');
        },
      }),
      purpose: 'test',
      policy,
      transport: new ImmediateTransport(),
      resumeStore: new MemoryResumeStore(),
    });

    await manager.addFiles([file('a.png', 4, 'image/png')]);
    expect(manager.getState().items[0]?.status).toBe('failed');
    expect(manager.getState().items[0]?.error?.code).toBe('unsupported_type');
    expect(created).toBe(false);
  });

  it('commits ready sessions', async () => {
    const manager = new UploadManager({
      client: client(),
      purpose: 'test',
      policy,
      transport: new ImmediateTransport(),
      resumeStore: new MemoryResumeStore(),
    });
    await manager.addFiles([file('a.txt')]);
    await manager.start();
    const sessions = await manager.commit();
    expect(sessions).toHaveLength(1);
  });
});

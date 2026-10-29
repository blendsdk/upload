import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  CreateUploadSessionRequest,
  CreateUploadSessionResponse,
  UploadPolicyResponse,
  UploadSession,
} from '@blendsdk/upload-core';
import {
  createUploadManager,
  type UploadClient,
  type UploadTransport,
  type UploadTransportHandle,
} from '@blendsdk/upload-client';
import { FileUpload } from '../src/index.js';

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
    result: {
      files: [{ id: 'file-1', role: 'original', name: 'a.txt', mime: 'text/plain', size: 4 }],
    },
  };
}

function client(): UploadClient {
  return {
    getPolicy: async () => policy,
    createSession: async (
      _input: CreateUploadSessionRequest,
    ): Promise<CreateUploadSessionResponse> => ({
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
    commit: async () => [session('00000000-0000-4000-8000-000000000001')],
  };
}

class ImmediateTransport implements UploadTransport {
  public start(input: {
    file: File;
    onProgress: (bytesUploaded: number, bytesTotal: number) => void;
  }): UploadTransportHandle {
    const promise = Promise.resolve().then(() =>
      input.onProgress(input.file.size, input.file.size),
    );
    return { promise, pause: () => undefined, resume: () => undefined, cancel: () => undefined };
  }
}

describe('FileUpload', () => {
  it('renders the dropzone and a ready file', async () => {
    const manager = createUploadManager({
      client: client(),
      purpose: 'test',
      policy,
      transport: new ImmediateTransport(),
    });

    render(<FileUpload manager={manager} client={client()} purpose="test" />);

    expect(screen.getByText('Drag files here, or browse')).toBeInTheDocument();

    await act(async () => {
      await manager.addFiles([new File(['test'], 'a.txt', { type: 'text/plain' })]);
      await manager.start();
    });

    expect(await screen.findByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
  });
});

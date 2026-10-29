import {
  UploadError,
  type CommitUploadSessionsRequest,
  type CreateUploadSessionRequest,
  type CreateUploadSessionResponse,
  type UploadErrorCode,
  type UploadPolicyResponse,
  type UploadSession,
} from '@blendsdk/upload-core';
import type { UploadClient, UploadClientOptions } from './types.js';

interface ErrorEnvelope {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isEnvelope(value: unknown): value is { success: true; data: unknown } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as { success?: unknown }).success === true &&
    'data' in (value as Record<string, unknown>),
  );
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Create the JSON client used by the upload manager.
 *
 * Authentication is deliberately supplied by the host through `getHeaders`.
 * The short-lived upload token returned by `createSession` is used only for
 * the session status, finalize and cancel calls, never for application-wide
 * endpoints such as commit.
 */
export function createUploadClient(options: UploadClientOptions): UploadClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('No fetch implementation is available.');
  }

  async function headers(token?: string): Promise<Record<string, string>> {
    const appHeaders = (await options.getHeaders?.()) ?? {};
    return {
      Accept: 'application/json',
      ...appHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(joinUrl(baseUrl, path), {
        ...init,
        headers: {
          ...(await headers(token)),
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      throw new UploadError(
        'network_error',
        error instanceof Error ? error.message : 'The network request failed.',
        'retryable',
      );
    }

    const body = await readBody(response);

    if (!response.ok) {
      const envelope = body as ErrorEnvelope | undefined;
      const error = envelope?.error;
      throw new UploadError(
        (error?.code as UploadErrorCode | undefined) ?? 'internal_error',
        error?.message ?? `Upload request failed with status ${response.status}.`,
        (error?.details?.retryability as 'retryable' | 'terminal' | undefined) ?? 'terminal',
        error?.details,
      );
    }

    return (isEnvelope(body) ? body.data : body) as T;
  }

  return {
    async getPolicy(purpose: string): Promise<UploadPolicyResponse> {
      return request<UploadPolicyResponse>(`policy/${encodeURIComponent(purpose)}`, {
        method: 'GET',
      });
    },

    async createSession(input: CreateUploadSessionRequest): Promise<CreateUploadSessionResponse> {
      return request<CreateUploadSessionResponse>('sessions', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
    },

    async getSession(id: string, token?: string): Promise<UploadSession> {
      return request<UploadSession>(`sessions/${encodeURIComponent(id)}`, { method: 'GET' }, token);
    },

    async finalize(id: string, token?: string): Promise<UploadSession> {
      return request<UploadSession>(
        `sessions/${encodeURIComponent(id)}/finalize`,
        { method: 'POST' },
        token,
      );
    },

    async cancel(id: string, token?: string): Promise<void> {
      await request<unknown>(`sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
    },

    async commit(input: CommitUploadSessionsRequest): Promise<UploadSession[]> {
      const result = await request<{ results: UploadSession[] }>('sessions/commit', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
      return result.results;
    },
  };
}

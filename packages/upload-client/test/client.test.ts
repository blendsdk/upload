import { describe, expect, it } from 'vitest';
import { createUploadClient } from '../src/client.js';

describe('upload HTTP client', () => {
  it('maps a fetch rejection to a retryable network error', async () => {
    const client = createUploadClient({
      baseUrl: '/api/uploads',
      fetch: async () => {
        throw new Error('offline');
      },
    });
    await expect(client.getPolicy('test')).rejects.toMatchObject({
      code: 'network_error',
      retryability: 'retryable',
    });
  });
});

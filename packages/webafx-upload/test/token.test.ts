import { describe, expect, it } from 'vitest';
import { createUploadToken, verifyUploadToken } from '../src/token.js';

describe('upload token', () => {
  it('issues and verifies a session-bound token', async () => {
    const token = await createUploadToken({
      secret: 'a-secret-that-is-long-enough',
      sessionId: '8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e',
      purpose: 'actor.visual',
      scope: 'acme',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const claims = await verifyUploadToken(token, 'a-secret-that-is-long-enough');
    expect(claims.sid).toBe('8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e');
    expect(claims.scope).toBe('acme');
  });

  it('rejects a token signed with another secret', async () => {
    const token = await createUploadToken({
      secret: 'a-secret-that-is-long-enough',
      sessionId: '8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e',
      purpose: 'actor.visual',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyUploadToken(token, 'another-secret-that-is-long')).rejects.toMatchObject({
      code: 'not_authorized',
    });
  });
});

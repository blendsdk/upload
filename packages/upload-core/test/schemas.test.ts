import { describe, expect, it } from 'vitest';
import { createUploadSessionRequestSchema, uploadSessionSchema } from '../src/index.js';

const sessionId = '8f14e45f-ceea-4f6a-9f7a-0f2a1b3c4d5e';

describe('upload schemas', () => {
  it('accepts a minimal session request', () => {
    const parsed = createUploadSessionRequestSchema.parse({
      purpose: 'actor.visual',
      file: { name: 'portrait.jpg', size: 1024, type: 'image/jpeg' },
    });
    expect(parsed.purpose).toBe('actor.visual');
  });

  it('rejects a missing file name', () => {
    expect(() =>
      createUploadSessionRequestSchema.parse({
        purpose: 'actor.visual',
        file: { name: '', size: 10 },
      }),
    ).toThrow();
  });

  it('validates a public session response', () => {
    const parsed = uploadSessionSchema.parse({
      id: sessionId,
      purpose: 'actor.visual',
      status: 'uploading',
      file: { name: 'portrait.jpg', size: 1024, type: 'image/jpeg' },
      bytesUploaded: 512,
      bytesTotal: 1024,
      createdAt: '2026-10-29T12:00:00.000Z',
      expiresAt: '2026-10-30T12:00:00.000Z',
    });
    expect(parsed.bytesUploaded).toBe(512);
  });
});

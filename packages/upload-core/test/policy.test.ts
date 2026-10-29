import { describe, expect, it } from 'vitest';
import {
  createDocumentPolicy,
  createImagePolicy,
  formatBytes,
  matchesAccept,
  sanitizeFileName,
  validateBatchCount,
  validateFileDescriptor,
} from '../src/index.js';

describe('upload policy', () => {
  it('accepts an image by MIME type', () => {
    expect(matchesAccept({ name: 'actor.heic', size: 10, type: 'image/heic' }, ['image/*'])).toBe(
      true,
    );
  });

  it('falls back to the extension when the MIME type is missing', () => {
    expect(matchesAccept({ name: 'cv.PDF', size: 10 }, ['.pdf'])).toBe(true);
  });

  it('rejects an empty file', () => {
    const issues = validateFileDescriptor(
      { name: 'empty.pdf', size: 0, type: 'application/pdf' },
      createDocumentPolicy('actor.document').constraints,
    );
    expect(issues.map((issue) => issue.code)).toContain('empty_file');
  });

  it('rejects a file above the policy maximum', () => {
    const policy = createImagePolicy('actor.visual');
    const issues = validateFileDescriptor(
      { name: 'large.jpg', size: policy.constraints.maxSize + 1, type: 'image/jpeg' },
      policy.constraints,
    );
    expect(issues.map((issue) => issue.code)).toContain('file_too_large');
  });

  it('enforces the batch file count', () => {
    const policy = createImagePolicy('actor.visual');
    expect(validateBatchCount(policy.constraints.maxFiles + 1, policy.constraints)[0]?.code).toBe(
      'too_many_files',
    );
  });

  it('sanitizes path separators and control characters', () => {
    expect(sanitizeFileName('../actor\u0000 photo.jpg')).toBe('.._actor photo.jpg');
  });

  it('formats byte sizes for users', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
});

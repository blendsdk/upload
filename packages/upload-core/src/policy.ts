import type {
  UploadConstraints,
  UploadErrorCode,
  UploadFileDescriptor,
  UploadPolicy,
} from './types.js';

/** Default tus chunk size: large enough for throughput, small enough for mobile recovery. */
export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

/** Default maximum size for an image upload. */
export const DEFAULT_IMAGE_MAX_SIZE = 25 * 1024 * 1024;

/** Default maximum size for a document upload. */
export const DEFAULT_DOCUMENT_MAX_SIZE = 100 * 1024 * 1024;

/** Default maximum number of files in one batch. */
export const DEFAULT_MAX_FILES = 20;

/** MIME types accepted by the built-in image preset. */
export const IMAGE_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** MIME types accepted by the built-in document preset. */
export const DOCUMENT_ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

/** Default constraints used when a policy leaves a field undefined. */
export const DEFAULT_CONSTRAINTS: UploadConstraints = {
  accept: [...IMAGE_ACCEPT, ...DOCUMENT_ACCEPT],
  maxSize: DEFAULT_DOCUMENT_MAX_SIZE,
  maxFiles: DEFAULT_MAX_FILES,
};

/**
 * Build the standard document policy.
 *
 * Documents are finalized immediately by default and served as attachments so
 * a browser never executes untrusted PDF or Office content inline. Callers can
 * override the defaults for their own purpose.
 */
export function createDocumentPolicy(
  purpose: string,
  overrides: Partial<UploadPolicy> = {},
): UploadPolicy {
  const { constraints: overrideConstraints, ...rest } = overrides;
  return {
    purpose,
    commitMode: 'immediate',
    contentDisposition: 'attachment',
    ...rest,
    constraints: {
      accept: [...DOCUMENT_ACCEPT],
      maxSize: DEFAULT_DOCUMENT_MAX_SIZE,
      maxFiles: 10,
      ...(overrideConstraints ?? {}),
    },
  };
}

/**
 * Build the standard image policy.
 *
 * Images use deferred commit because they are normally uploaded inside a form:
 * the form decides whether the uploaded file is attached or discarded.
 */
export function createImagePolicy(
  purpose: string,
  overrides: Partial<UploadPolicy> = {},
): UploadPolicy {
  const { constraints: overrideConstraints, ...rest } = overrides;
  return {
    purpose,
    commitMode: 'deferred',
    contentDisposition: 'inline',
    retentionDays: 7,
    ...rest,
    constraints: {
      accept: [...IMAGE_ACCEPT],
      maxSize: DEFAULT_IMAGE_MAX_SIZE,
      maxFiles: DEFAULT_MAX_FILES,
      maxPixels: 50_000_000,
      ...(overrideConstraints ?? {}),
    },
  };
}

/** Return the lower-case extension, including the dot, or an empty string. */
export function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index < 0 ? '' : fileName.slice(index).toLowerCase();
}

/** True when the declared MIME type is an image type. */
export function isImageMime(mime: string | undefined): boolean {
  return Boolean(mime && mime.toLowerCase().startsWith('image/'));
}

/**
 * Check whether a file descriptor matches the policy allowlist.
 *
 * Matching is intentionally permissive only at the pattern level: the server
 * still performs magic-byte detection. A client-declared MIME type is a UX
 * hint, never proof of content.
 */
export function matchesAccept(file: UploadFileDescriptor, accept: readonly string[]): boolean {
  if (accept.length === 0) {
    return true;
  }

  const mime = (file.type ?? '').toLowerCase();
  const extension = getExtension(file.name);

  return accept.some((raw) => {
    const entry = raw.toLowerCase();
    if (entry === '*/*' || entry === '*') {
      return true;
    }
    if (entry.startsWith('.')) {
      return extension === entry;
    }
    if (entry.endsWith('/*')) {
      return mime.startsWith(entry.slice(0, -1));
    }
    return mime === entry;
  });
}

/** One validation problem found before a session is created. */
export interface UploadValidationIssue {
  code: UploadErrorCode;
  message: string;
  field?: string;
}

/** Validate one declared file against the policy constraints. */
export function validateFileDescriptor(
  file: UploadFileDescriptor,
  constraints: UploadConstraints,
): UploadValidationIssue[] {
  const issues: UploadValidationIssue[] = [];

  if (file.size <= 0) {
    issues.push({ code: 'empty_file', message: 'The file is empty.', field: 'size' });
  }
  if (constraints.maxSize > 0 && file.size > constraints.maxSize) {
    issues.push({
      code: 'file_too_large',
      message: `The file is larger than ${formatBytes(constraints.maxSize)}.`,
      field: 'size',
    });
  }
  if (!matchesAccept(file, constraints.accept)) {
    issues.push({
      code: 'unsupported_type',
      message: 'This file type is not accepted.',
      field: 'type',
    });
  }

  return issues;
}

/** Validate the number of files in a batch. */
export function validateBatchCount(
  count: number,
  constraints: UploadConstraints,
): UploadValidationIssue[] {
  if (count > constraints.maxFiles) {
    return [
      {
        code: 'too_many_files',
        message: `You can upload at most ${constraints.maxFiles} files at once.`,
        field: 'files',
      },
    ];
  }
  return [];
}

/**
 * Sanitize a user-provided file name for display and storage metadata.
 *
 * The stored object key is always generated by the server; this value is only
 * the human-readable name. Control characters and path separators are removed
 * so the name cannot be interpreted as a path or a header value.
 */
export function sanitizeFileName(fileName: string): string {
  const normalized = fileName.normalize('NFKC');
  const cleaned = normalized
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'file').slice(0, 255);
}

/** Human-readable byte size for UI and error messages. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const display =
    value >= 10 || exponent === 0 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

import type { UploadErrorCode, UploadErrorDetail, UploadRetryability } from './types.js';

/**
 * Error type shared by the client and server.
 *
 * The server serializes this shape into the standard WebAFX error envelope;
 * the client rehydrates it so callers can branch on stable codes instead of
 * parsing human-readable messages.
 */
export class UploadError extends Error {
  public readonly code: UploadErrorCode;
  public readonly retryability: UploadRetryability;
  public readonly details?: Record<string, unknown>;

  public constructor(
    code: UploadErrorCode,
    message: string,
    retryability: UploadRetryability = 'terminal',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.retryability = retryability;
    this.details = details;
  }

  /** Convert to the wire representation. */
  public toDetail(): UploadErrorDetail {
    return {
      code: this.code,
      message: this.message,
      retryability: this.retryability,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  /** Rehydrate an error from a server response. */
  public static fromDetail(detail: UploadErrorDetail): UploadError {
    return new UploadError(detail.code, detail.message, detail.retryability, detail.details);
  }
}

/** True when the error is safe to retry. */
export function isRetryable(error: unknown): boolean {
  return error instanceof UploadError && error.retryability === 'retryable';
}

/** Normalize an unknown thrown value into an `UploadError`. */
export function toUploadError(
  error: unknown,
  fallbackCode: UploadErrorCode = 'internal_error',
): UploadError {
  if (error instanceof UploadError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new UploadError(fallbackCode, message, 'terminal');
}

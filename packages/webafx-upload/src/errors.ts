import { ApiError } from 'blendsdk/webafx';
import { UploadError, type UploadErrorCode, type UploadRetryability } from '@blendsdk/upload-core';

/** API error carrying a stable upload error code. */
export class UploadApiError extends ApiError {
  public constructor(
    code: UploadErrorCode | string,
    statusCode: number,
    message: string,
    retryability: UploadRetryability = 'terminal',
    details?: Record<string, unknown>,
  ) {
    super(statusCode, code, message, { retryability, ...(details ?? {}) });
    this.name = 'UploadApiError';
  }
}

/** Convert internal upload errors into the WebAFX error envelope. */
export function toApiError(error: unknown): UploadApiError {
  if (error instanceof UploadApiError) {
    return error;
  }
  if (error instanceof UploadError) {
    const status =
      error.code === 'not_authorized'
        ? 401
        : error.code === 'not_found'
          ? 404
          : error.code === 'session_expired'
            ? 410
            : error.code === 'file_too_large'
              ? 413
              : error.code === 'unsupported_type' || error.code === 'mime_mismatch'
                ? 415
                : error.code === 'quota_exceeded'
                  ? 429
                  : error.retryability === 'retryable'
                    ? 503
                    : 400;
    return new UploadApiError(error.code, status, error.message, error.retryability, error.details);
  }
  const message = error instanceof Error ? error.message : 'Upload request failed.';
  return new UploadApiError('internal_error', 500, message);
}

import type { FileUploadStrings } from './FileUpload.types.js';

/** English defaults. Blank overrides fall back to these values. */
export const DEFAULT_STRINGS: FileUploadStrings = {
  dropTitle: 'Drag files here, or browse',
  dropHint: 'Upload documents and images. You can resume interrupted uploads.',
  browse: 'Browse files',
  takePhoto: 'Take photo',
  addFiles: 'Add files',
  startUpload: 'Start upload',
  pauseAll: 'Pause all',
  resumeAll: 'Resume all',
  cancel: 'Cancel',
  cancelAll: 'Cancel all',
  remove: 'Remove',
  retry: 'Retry',
  pause: 'Pause',
  resume: 'Resume',
  queued: 'Queued',
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
  canceled: 'Canceled',
  paused: 'Paused',
  noFiles: 'No files selected yet.',
  uploadComplete: 'All files uploaded.',
  uploadFailed: 'Some files could not be uploaded.',
  fileTooLarge: 'This file is too large.',
  unsupportedType: 'This file type is not supported.',
  networkError: 'The connection was interrupted. You can retry.',
  sessionExpired: 'The upload session expired. Please add the file again.',
  retryable: 'You can retry this upload.',
};

/** Merge user overrides over the defaults; blank values never win. */
export function resolveStrings(overrides?: Partial<FileUploadStrings>): FileUploadStrings {
  const resolved = { ...DEFAULT_STRINGS };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value === 'string' && value.trim().length > 0) {
      resolved[key as keyof FileUploadStrings] = value;
    }
  }
  return resolved;
}

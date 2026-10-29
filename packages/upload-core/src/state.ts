import type { UploadStatus } from './types.js';

const TRANSITIONS: Record<UploadStatus, readonly UploadStatus[]> = {
  pending: ['uploading', 'canceled', 'expired', 'failed'],
  uploading: ['uploaded', 'canceled', 'expired', 'failed'],
  uploaded: ['processing', 'canceled', 'expired', 'failed'],
  processing: ['ready', 'staged', 'failed', 'expired'],
  ready: ['committed', 'expired'],
  staged: ['committed', 'expired', 'failed'],
  committed: ['expired'],
  failed: ['processing', 'expired'],
  expired: [],
  canceled: [],
};

/** Return true when a session may move from `from` to `to`. */
export function canTransition(from: UploadStatus, to: UploadStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Return true when the status is terminal. */
export function isTerminalStatus(status: UploadStatus): boolean {
  return status === 'committed' || status === 'expired' || status === 'canceled';
}

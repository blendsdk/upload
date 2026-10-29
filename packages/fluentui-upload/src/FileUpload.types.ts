import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { UploadClient, UploadManager, UploadResumeStore } from '@blendsdk/upload-client';
import type { UploadErrorDetail, UploadItemState, UploadManagerState } from '@blendsdk/upload-core';

/** Visible strings. English defaults are merged key by key. */
export interface FileUploadStrings {
  dropTitle: string;
  dropHint: string;
  browse: string;
  takePhoto: string;
  addFiles: string;
  startUpload: string;
  pauseAll: string;
  resumeAll: string;
  cancel: string;
  cancelAll: string;
  remove: string;
  retry: string;
  pause: string;
  resume: string;
  queued: string;
  uploading: string;
  processing: string;
  ready: string;
  failed: string;
  canceled: string;
  paused: string;
  noFiles: string;
  uploadComplete: string;
  uploadFailed: string;
  fileTooLarge: string;
  unsupportedType: string;
  networkError: string;
  sessionExpired: string;
  retryable: string;
}

/** Public FileUpload props. */
export interface FileUploadProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'onChange' | 'onError' | 'children'
> {
  /** JSON upload client. */
  client: UploadClient;
  /** Server policy purpose, for example `actor.visual`. */
  purpose: string;
  /** Opaque business context sent once per session. */
  context?: Record<string, unknown>;
  /** Opaque application scope. */
  scope?: string;
  /** Optional externally owned manager for app-level upload trays. */
  manager?: UploadManager;
  /** Optional persistence for resume keys; defaults to localStorage in browsers. */
  resumeStore?: UploadResumeStore;
  /** Client-side picker hint; the server policy remains authoritative. */
  accept?: string[];
  /** Client-side hint; the server policy remains authoritative. */
  maxFiles?: number;
  /** Client-side hint; the server policy remains authoritative. */
  maxSize?: number;
  multiple?: boolean;
  autoStart?: boolean;
  disabled?: boolean;
  strings?: Partial<FileUploadStrings>;
  /** Called with the current ready items whenever a file becomes ready. */
  onUploaded?: (items: UploadItemState[]) => void;
  /** Called when an item fails. */
  onError?: (error: UploadErrorDetail, item: UploadItemState) => void;
  /** Called when the user removes an already stored item. */
  onRemoveUploaded?: (item: UploadItemState) => void | Promise<void>;
  /** Optional custom empty state. */
  emptyState?: ReactNode;
  /** Optional custom item renderer. */
  renderItem?: (item: UploadItemState, actions: FileUploadItemActions) => ReactNode;
}

/** Actions supplied to a custom item renderer. */
export interface FileUploadItemActions {
  pause(): void;
  resume(): void;
  retry(): void;
  remove(): void;
  cancel(): void;
}

/** State returned by the FileUpload hook. */
export interface FileUploadRootActions {
  openPicker(): void;
  start(): void;
  pauseAll(): void;
  resumeAll(): void;
  cancelAll(): void;
}

export interface FileUploadState {
  manager: UploadManager;
  managerState: UploadManagerState;
  strings: FileUploadStrings;
  classes: Record<string, string>;
  isDragActive: boolean;
  rootProps: Record<string, unknown>;
  inputProps: Record<string, unknown>;
  actions: FileUploadRootActions;
  onItemAction(item: UploadItemState): FileUploadItemActions;
}

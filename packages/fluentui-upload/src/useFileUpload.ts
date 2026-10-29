import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { createUploadManager, LocalStorageResumeStore } from '@blendsdk/upload-client';
import type { UploadItemState } from '@blendsdk/upload-core';
import type {
  FileUploadItemActions,
  FileUploadProps,
  FileUploadState,
} from './FileUpload.types.js';
import { resolveStrings } from './strings.js';
import { useFileUploadStyles } from './useFileUploadStyles.styles.js';

function itemActions(
  manager: FileUploadState['manager'],
  item: UploadItemState,
): FileUploadItemActions {
  return {
    pause: () => manager.pause(item.id),
    resume: () => manager.resume(item.id),
    retry: () => manager.retry(item.id),
    remove: () => {
      void manager.remove(item.id);
    },
    cancel: () => {
      void manager.cancel(item.id);
    },
  };
}

/** Bind a manager to React and expose dropzone and item actions. */
export function useFileUpload(props: FileUploadProps): FileUploadState {
  const styles = useFileUploadStyles();
  const contextKey = useMemo(() => {
    try {
      return JSON.stringify(props.context ?? {});
    } catch {
      return '';
    }
  }, [props.context]);
  const manager = useMemo(
    () =>
      props.manager ??
      createUploadManager({
        client: props.client,
        purpose: props.purpose,
        context: props.context,
        scope: props.scope,
        autoStart: props.autoStart ?? false,
        resumeStore:
          props.resumeStore ??
          (typeof localStorage !== 'undefined' ? new LocalStorageResumeStore() : undefined),
      }),
    [
      props.manager,
      props.client,
      props.purpose,
      props.scope,
      contextKey,
      props.autoStart,
      props.resumeStore,
    ],
  );
  const managerState = useSyncExternalStore(manager.subscribe, manager.getState, manager.getState);
  const strings = useMemo(() => resolveStrings(props.strings), [props.strings]);
  const notifiedReady = useRef<string>('');
  const notifiedFailed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ready = managerState.items.filter((item) => item.status === 'ready');
    const key = ready.map((item) => item.id).join('|');
    if (key && key !== notifiedReady.current) {
      notifiedReady.current = key;
      props.onUploaded?.(ready);
    }
  }, [managerState.items, props.onUploaded]);

  useEffect(() => {
    for (const item of managerState.items) {
      if (item.status !== 'failed') {
        notifiedFailed.current.delete(item.id);
        continue;
      }
      if (item.error && !notifiedFailed.current.has(item.id)) {
        notifiedFailed.current.add(item.id);
        props.onError?.(item.error, item);
      }
    }
  }, [managerState.items, props.onError]);

  const acceptString = (props.accept ?? ['*/*']).join(',');
  const multiple = props.multiple ?? true;
  const dropzone = useDropzone({
    onDrop: (accepted) => {
      void manager.addFiles(accepted);
    },
    disabled: props.disabled,
    multiple,
    ...(props.maxFiles ? { maxFiles: props.maxFiles } : {}),
    noClick: true,
  });

  const rootProps = dropzone.getRootProps({
    onClick: () => {
      if (!props.disabled) {
        dropzone.open();
      }
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (props.disabled) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        dropzone.open();
      }
    },
    role: 'button',
    tabIndex: props.disabled ? -1 : 0,
    'aria-disabled': props.disabled || undefined,
  }) as Record<string, unknown>;

  const inputProps = dropzone.getInputProps({
    accept: acceptString,
    multiple,
  }) as Record<string, unknown>;

  return {
    manager,
    managerState,
    strings,
    classes: styles,
    isDragActive: dropzone.isDragActive,
    rootProps,
    inputProps,
    actions: {
      openPicker: dropzone.open,
      start: () => {
        void manager.start();
      },
      pauseAll: () => manager.pauseAll(),
      resumeAll: () => {
        for (const item of managerState.items) {
          if (item.status === 'paused') {
            manager.resume(item.id);
          }
        }
      },
      cancelAll: () => {
        void manager.cancelAll();
      },
    },
    onItemAction: (item) => itemActions(manager, item),
  };
}

import type { ForwardedRef, ReactElement } from 'react';
import {
  Button,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Text,
  mergeClasses,
} from '@fluentui/react-components';
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowUpload24Regular,
  CheckmarkCircle24Filled,
  Dismiss24Regular,
  Document24Regular,
  DocumentPdf24Regular,
  ErrorCircle24Filled,
  Image24Regular,
  Pause24Regular,
  Play24Regular,
  Stop24Regular,
} from '@fluentui/react-icons';
import { formatBytes, type UploadItemState } from '@blendsdk/upload-core';
import type { FileUploadProps, FileUploadState } from './FileUpload.types.js';

function statusText(item: UploadItemState, state: FileUploadState): string {
  const { strings } = state;
  switch (item.status) {
    case 'queued':
      return strings.queued;
    case 'creating':
    case 'uploading':
      return `${strings.uploading} ${Math.round(item.progress * 100)}%`;
    case 'processing':
      return strings.processing;
    case 'ready':
      return strings.ready;
    case 'paused':
      return strings.paused;
    case 'canceled':
      return strings.canceled;
    case 'failed':
      return item.error?.message ?? strings.failed;
    default:
      return strings.queued;
  }
}

function fileIcon(item: UploadItemState): ReactElement {
  if (item.file.type?.startsWith('image/')) {
    return <Image24Regular />;
  }
  if (item.file.type === 'application/pdf' || item.file.name.toLowerCase().endsWith('.pdf')) {
    return <DocumentPdf24Regular />;
  }
  return <Document24Regular />;
}

function ItemStatusIcon(item: UploadItemState): ReactElement | null {
  if (item.status === 'ready') {
    return <CheckmarkCircle24Filled aria-hidden />;
  }
  if (item.status === 'failed') {
    return <ErrorCircle24Filled aria-hidden />;
  }
  if (item.status === 'uploading' || item.status === 'processing' || item.status === 'creating') {
    return <Spinner size="extra-small" aria-hidden />;
  }
  return null;
}

function defaultItem(
  item: UploadItemState,
  state: FileUploadState,
  props: FileUploadProps,
): ReactElement {
  const actions = state.onItemAction(item);
  const remove = async (): Promise<void> => {
    if (item.status === 'ready' && props.onRemoveUploaded) {
      await props.onRemoveUploaded(item);
    }
    await state.manager.remove(item.id);
  };

  return (
    <div className={state.classes.item} key={item.id}>
      <div className={state.classes.icon} aria-hidden>
        {fileIcon(item)}
      </div>
      <div className={state.classes.itemMain}>
        <Text className={state.classes.itemName} title={item.file.name}>
          {item.file.name}
        </Text>
        <Text className={state.classes.itemMeta}>
          {formatBytes(item.file.size)} · {statusText(item, state)}
        </Text>
        {(item.status === 'uploading' || item.status === 'processing') && (
          <ProgressBar
            className={state.classes.progress}
            value={item.status === 'processing' ? undefined : item.progress * 100}
            max={100}
            thickness="medium"
            aria-label={`${item.file.name} ${state.strings.uploading}`}
          />
        )}
        {item.status === 'failed' && item.error && (
          <MessageBar intent="error" className={state.classes.error}>
            <MessageBarBody>{item.error.message}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <div className={state.classes.itemActions}>
        <span className={state.classes.itemStatus}>{ItemStatusIcon(item)}</span>
        {(item.status === 'uploading' || item.status === 'processing') && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Pause24Regular />}
            aria-label={`${state.strings.pause} ${item.file.name}`}
            onClick={actions.pause}
          />
        )}
        {item.status === 'paused' && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Play24Regular />}
            aria-label={`${state.strings.resume} ${item.file.name}`}
            onClick={actions.resume}
          />
        )}
        {item.status === 'failed' && item.error?.retryability === 'retryable' && (
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowClockwise24Regular />}
            aria-label={`${state.strings.retry} ${item.file.name}`}
            onClick={actions.retry}
          />
        )}
        {item.status === 'uploading' && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Stop24Regular />}
            aria-label={`${state.strings.cancelAll} ${item.file.name}`}
            onClick={actions.cancel}
          />
        )}
        <Button
          appearance="subtle"
          size="small"
          icon={<Dismiss24Regular />}
          aria-label={`${state.strings.remove} ${item.file.name}`}
          onClick={() => {
            void remove();
          }}
        />
      </div>
    </div>
  );
}

/** Pure render function for the upload component. */
export function renderFileUpload(
  state: FileUploadState,
  props: FileUploadProps,
  ref?: ForwardedRef<HTMLDivElement>,
): ReactElement {
  const { managerState, strings, classes } = state;
  const hasItems = managerState.items.length > 0;
  const hasQueued = managerState.items.some((item) => item.status === 'queued');
  const hasActive = managerState.items.some(
    (item) =>
      item.status === 'uploading' || item.status === 'processing' || item.status === 'creating',
  );
  const hasPaused = managerState.items.some((item) => item.status === 'paused');
  const allReady =
    hasItems &&
    managerState.items.every((item) => item.status === 'ready' || item.status === 'canceled');
  const hasFailed = managerState.failedCount > 0;

  return (
    <div ref={ref} className={mergeClasses(classes.root, props.className)} style={props.style}>
      <div
        {...state.rootProps}
        className={mergeClasses(
          classes.dropzone,
          state.isDragActive && classes.dropzoneActive,
          props.disabled && classes.dropzoneDisabled,
        )}
        aria-label={strings.dropTitle}
      >
        <input {...state.inputProps} className={classes.hiddenInput} tabIndex={-1} />
        <ArrowUpload24Regular className={classes.dropzoneIcon} aria-hidden />
        <Text className={classes.dropzoneTitle}>{strings.dropTitle}</Text>
        <Text className={classes.dropzoneHint}>{strings.dropHint}</Text>
        <Button
          appearance="primary"
          disabled={props.disabled}
          onClick={(event) => {
            event.stopPropagation();
            state.actions.openPicker();
          }}
        >
          {strings.browse}
        </Button>
      </div>

      <div className={classes.toolbar}>
        <Button
          appearance="secondary"
          icon={<Add24Regular />}
          disabled={props.disabled}
          onClick={state.actions.openPicker}
        >
          {strings.addFiles}
        </Button>
        {hasQueued && (
          <Button appearance="primary" disabled={props.disabled} onClick={state.actions.start}>
            {strings.startUpload}
          </Button>
        )}
        {hasActive && (
          <Button appearance="secondary" onClick={state.actions.pauseAll}>
            {strings.pauseAll}
          </Button>
        )}
        {hasPaused && (
          <Button appearance="secondary" onClick={state.actions.resumeAll}>
            {strings.resumeAll}
          </Button>
        )}
        {hasItems && (
          <Button appearance="subtle" onClick={state.actions.cancelAll}>
            {strings.cancelAll}
          </Button>
        )}
      </div>

      {hasItems && (
        <div className={classes.summary} aria-live="polite">
          <Text>
            {managerState.completedCount} / {managerState.items.length}
          </Text>
          <div style={{ flex: 1 }}>
            <ProgressBar
              value={managerState.uploadedBytes}
              max={Math.max(managerState.totalBytes, 1)}
              thickness="medium"
              aria-label={strings.uploading}
            />
          </div>
          <Text>{formatBytes(managerState.uploadedBytes)}</Text>
        </div>
      )}

      {allReady && <MessageBar intent="success">{strings.uploadComplete}</MessageBar>}
      {hasFailed && <MessageBar intent="error">{strings.uploadFailed}</MessageBar>}

      <div className={classes.list} role="list">
        {managerState.items.length === 0
          ? props.emptyState || <div className={classes.empty}>{strings.noFiles}</div>
          : managerState.items.map((item) =>
              props.renderItem ? (
                <div key={item.id} role="listitem">
                  {props.renderItem(item, state.onItemAction(item))}
                </div>
              ) : (
                <div key={item.id} role="listitem">
                  {defaultItem(item, state, props)}
                </div>
              ),
            )}
      </div>
    </div>
  );
}

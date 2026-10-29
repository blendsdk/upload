import * as React from 'react';
import type { ForwardedRef, ReactElement } from 'react';
import type { FileUploadProps } from './FileUpload.types.js';
import { renderFileUpload } from './renderFileUpload.js';
import { useFileUpload } from './useFileUpload.js';

/**
 * Resumable file upload component for React 19 and Fluent UI v9.
 *
 * The component is policy-driven: the server resolves accepted types, size
 * limits and processing rules for the requested purpose, while the component
 * supplies the queue, progress, retry and accessibility affordances. Pass an
 * app-level `manager` when uploads should outlive the component or be shown in
 * a global upload tray.
 *
 * @example
 * ```tsx
 * <FileUpload
 *     client={uploadClient}
 *     purpose="actor.visual"
 *     context={{ actor_id }}
 *     autoStart
 *     onUploaded={items => setStagedFiles(items)}
 * />
 * ```
 */
function FileUploadInner(props: FileUploadProps, ref: ForwardedRef<HTMLDivElement>): ReactElement {
  const state = useFileUpload(props);
  return renderFileUpload(state, props, ref);
}

const ForwardedFileUpload = React.forwardRef(FileUploadInner);
ForwardedFileUpload.displayName = 'FileUpload';

/** Public upload component. */
export const FileUpload = ForwardedFileUpload;

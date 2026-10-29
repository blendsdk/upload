# RD-04: Fluent UI v9 Component

> **Status**: Implemented
> **Project**: upload
> **Depends On**: RD-02

## Functional Requirements

- The UI package provides a React 19 `FileUpload` component and a `useFileUpload` hook.
- The dropzone supports click, drag/drop, keyboard activation and the native mobile picker.
- The file list shows name, size, status, progress and per-file actions.
- The component supports pause, resume, retry, cancel and remove.
- A batch summary shows completed/total files and aggregate progress.
- Success and failure states use Fluent UI MessageBar; processing uses Spinner.
- The component is policy-driven and treats client-side limits as hints.
- Strings are localizable; blank overrides fall back to English defaults.
- The component supports an externally owned manager, custom item rendering and a custom empty state.
- Styles use Griffel tokens and are responsive at narrow widths.

## Acceptance Criteria

- [x] The component renders the dropzone and a ready file in a jsdom test.
- [x] The package builds as per-module ESM with React and Fluent UI external.
- [x] Declarations are emitted for the public surface.
- [x] The component does not render its own dialog or own commit semantics.

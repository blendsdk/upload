# `@blendsdk/fluentui-upload`

React 19 + Fluent UI v9 component.

```tsx
<FileUpload client={client} purpose="actor.visual" context={{ actor_id }} autoStart />
```

## Exports

- `FileUpload`
- `useFileUpload`
- `useFileUploadStyles`
- `DEFAULT_STRINGS`, `resolveStrings`
- `FileUploadProps`, `FileUploadStrings`, `FileUploadState`, `FileUploadItemActions`

## Behaviour

The component renders a keyboard-operable dropzone, a file list with per-file progress and actions, a batch summary, success/error messages and an empty state. It uses Fluent UI tokens and Griffel, respects React 19, and does not render its own dialog. The host owns dialogs, forms and commit semantics.

`renderItem` and `emptyState` allow custom composition without forking the component.

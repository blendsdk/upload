# React component

```tsx
import { FileUpload } from '@blendsdk/fluentui-upload';

<FileUpload
  client={client}
  purpose="actor.visual"
  context={{ actor_id }}
  accept={['image/jpeg', 'image/png', 'image/webp']}
  maxFiles={10}
  autoStart
  onUploaded={(items) => setStaged(items)}
  onError={(error, item) => report(error, item)}
/>;
```

## Props

| Prop                            | Description                   |
| ------------------------------- | ----------------------------- |
| `client`                        | Required JSON client          |
| `purpose`                       | Required policy purpose       |
| `context`                       | Business context sent once    |
| `manager`                       | Optional app-level manager    |
| `accept`, `maxFiles`, `maxSize` | UX hints; server policy wins  |
| `autoStart`                     | Start after files are added   |
| `strings`                       | Localized strings             |
| `onUploaded`                    | Ready items                   |
| `onError`                       | Per-item failures             |
| `onRemoveUploaded`              | Delete an already stored item |
| `renderItem`                    | Custom item renderer          |
| `emptyState`                    | Custom empty state            |

## Accessibility and mobile

The dropzone is a keyboard-operable button. File rows expose progress, status text and labelled actions. Errors use an alert region. The layout is responsive, touch targets remain large, and the native file picker is used on mobile. Pass a localized `strings` object for production copy.

## Deferred commit

Image policies default to deferred commit. The component returns ready items; the form saves their session/file ids and calls `manager.commit()` or the server's batch commit route when the form is submitted. Cancelling the form should cancel the staged sessions.

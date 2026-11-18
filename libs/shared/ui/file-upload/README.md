# File upload

Accessible file selection and upload control with a compact `simple`
mode and a preview-rich `dropzone` mode. It supports direct multipart uploads,
custom programmatic upload handlers, drag and drop, validation, image previews,
per-file progress, cancellation, retry, and multiple files.

## Direct endpoint upload

Each file is sent in its own `POST` multipart request. This keeps progress,
retry, and failure state independent for every file.

```ts
import { FileUpload } from '@ui/file-upload';
```

```html
<lib-file-upload
  uploadUrl="/api/files"
  fieldName="file"
  mode="dropzone"
  heading="Upload documents"
  description="Add images or PDF documents."
  accept="image/*,.pdf"
  [multiple]="true"
  [maxFileSize]="10 * 1024 * 1024"
  [maxFiles]="5"
/>
```

Use `headers`, `formData`, and `withCredentials` when the endpoint needs extra
request data. Do not set the multipart `Content-Type` header manually; the
browser adds the required boundary.

## Programmatic upload

A custom handler takes precedence over `uploadUrl`. It receives one file, an
abort signal, and a progress reporter. Throw or reject with a friendly `Error`
message to show it on that file's row.

```ts
import type { FileUploadHandler } from '@ui/file-upload';

readonly uploadFile: FileUploadHandler = async ({
  file,
  signal,
  reportProgress,
}) => {
  return this.storage.upload(file, { signal, onProgress: reportProgress });
};
```

```html
<lib-file-upload [uploadHandler]="uploadFile" [multiple]="true" [autoUpload]="false" />
```

The component also exposes `choose()`, `addFiles()`, `upload()`, `retry()`,
`cancel()`, `remove()`, and `clear()` for imperative workflows. `value` is a
model of the selected `File[]`, so `[(value)]` and Signal Forms `[formField]`
work without an adapter.

## Modes

- `dropzone` (default) renders the drop target, optional heading and
  description, chooser, validation guidance, previews, status, and queue
  actions.
- `simple` renders the same bordered surface with only the file chooser aligned
  to the left. Queue state remains available through `items` and events for a
  consumer-rendered workflow.

## Events

- `filesAdded` and `filesRejected`
- `uploadSuccess` and `uploadError` (once per file)
- `fileRemoved` and `filesCleared`
- `touch` for Signal Forms interaction state

`filesRejected` provides stable `type`, `size`, `count`, and `duplicate` codes.
Built-in interface text and errors ship in Greek and English through the
`fileUpload` Transloco scope.

## Validation and Signal Forms

Two kinds of message share one `role="alert"` block:

- **Selection rejections** the component raises itself — `accept`, `maxFileSize`,
  `maxFiles`, duplicates. `maxFileSize` and `maxFiles` treat zero, and any value
  that is not a positive finite number, as unlimited.
- **Schema errors** from `[formField]`, received through the auto-bound
  `errors`/`touched` inputs. They surface only once the field is touched or
  focus has left it, so a pre-filled invalid value never accuses the user of a
  mistake they have not made.

Only a consumer `Error`'s own `message` is rendered verbatim — it is the one
string the component cannot translate. Anything else falls back to a
translated key, so an unknown throw never prints English over the user's
locale.

`required` renders as a translated word in the hint line rather than as
`aria-required`, which ARIA does not allow on the chooser button's role. Submit
through Signal Forms' `submit()`, which marks the form touched so the message
surfaces.

## Accessibility

- The `<input type="file">` is hidden from the a11y tree; the real `<button>`
  chooser is the focusable control, and it carries `aria-invalid` and the
  `aria-describedby` pointing at the message block. A consumer's own
  `ariaDescribedby` is kept and the control's ids appended, never replaced.
- Set `ariaLabel` or `ariaLabelledby` to name the whole control; the host
  becomes a `role="group"` only when one is supplied.
- Per-file status is plain visible text. The queue is announced once, through a
  single summarised `role="status"` region — a live region per row talked over
  itself the moment more than one file moved.
- Every row action is a real button with a file-specific accessible name, and
  all of them except cancel are disabled while the control is.
- Queue rows animate in only after the first paint, so a pre-filled `value`
  does not animate itself into view on load.

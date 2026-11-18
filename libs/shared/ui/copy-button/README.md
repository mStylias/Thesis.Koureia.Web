# @ui/copy-button

Copies a value to the clipboard. The button reads "Copied" for two seconds, and a status
region announces the result, so the button keeps its name.

```ts
import { CopyButton } from '@ui/copy-button';
```

```html
<lib-copy-button [value]="member.email" [label]="'Copy email'" />
```

## Why the label is sized to the longer word

"Copy" and "Copied" have different widths. The label reserves the width of both, so a
press does not move what sits beside the button.

## API

| Input   | Type     | Notes                                                            |
| ------- | -------- | ---------------------------------------------------------------- |
| `value` | `string` | Required. The text that goes to the clipboard.                   |
| `label` | `string` | Required. The accessible name. Start it with the visible "Copy". |

`COPIED_MS` is how long "Copied" stays.

## Copy

Scope `copyButton`: `copy`, `copied`, `failed`. Each key is overridable through
`@util/ui-copy`.

## Accessibility

- The button keeps its accessible name while the label changes.
- A `role="status"` region announces "Copied" or the failure.
- A refused clipboard (no secure context, or the user said no) announces the failure and
  copies nothing.

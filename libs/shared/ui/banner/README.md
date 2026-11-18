# shared-ui-banner

A message in a tinted box, inline with the page: a fact to read, a confirmation, a
warning or an error. Import from `@ui/banner`.

```html
<lib-banner>You can add the appointment to your calendar through the email we sent you.</lib-banner>

<lib-banner tone="error" role="alert">The appointment did not save.</lib-banner>
```

## Why the banner sets no role

A banner that is part of the page from the start is ordinary content, and a live
role would announce it on every load. A banner that appears after an action must be
announced, and only the consumer knows which case it is. So the consumer adds
`role="status"` (polite) or `role="alert"` (urgent) on the host.

## Why not a toast

A toast reports an action and goes away. A banner stays with the content it is
about, so the reader can find it again.

## API

| Input     | Type                                          | Default  | Description                                            |
| --------- | --------------------------------------------- | -------- | ------------------------------------------------------ |
| `tone`    | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | The meaning. Sets the tint, the edge and the icon.     |
| `heading` | `string`                                      | `''`     | A bold first line over the message. Empty shows none.  |
| `icon`    | `LucideIconInput \| null`                     | `null`   | Replaces the tone's icon, such as `LucideShieldCheck`. |

The message is the projected content. It can hold paragraphs, lists, links and
inline markup. Mark a button or link `libBannerAction` to place it in the action
slot at the end of the box. The slot wraps under the message when the box is
narrow.

```html
<lib-banner tone="error" role="alert">
  The staff could not be loaded.
  <button libButton libBannerAction size="sm" variant="outlined" severity="secondary">Retry</button>
</lib-banner>
```

## Accessibility

- Each tone has its own icon, so the color is never the only signal. The icon is
  `aria-hidden`: the message text must carry the meaning.
- In forced-colors mode the tint goes away, and the border keeps the box.
- The text is `--text-primary` on the `--*-bg` tint, and the icon is `--*-text`.
  Both are AA in each theme.

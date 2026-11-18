# shared-ui-dialog

The declarative dialog of the design system, built on the native
`<dialog>` element. Import from `@ui/dialog`.

```html
<lib-dialog [(visible)]="open" header="Edit profile" maximizable>
  ...content...
  <ng-template libDialogFooter>...actions...</ng-template>
</lib-dialog>
```

For a yes/no prompt, reach for
[`@ui/confirmation-dialog`](../confirmation-dialog/README.md) instead —
it is opened imperatively and resolves with the user's answer.

## Why the native `<dialog>`

`showModal()` gives the platform's own focus containment, background inertness,
`Escape` handling, focus restoration on close, and top-layer stacking that no
`z-index` can lose. A `div[role=dialog]` has to reimplement all of it. The
element also has a genuine non-modal mode (`show()`), so `[modal]="false"` is a
real presentation rather than a modal with the backdrop hidden — the page stays
interactive and there is no focus trap.

The trade-off is that the platform close is immediate, which would cut the exit
transition. So `visible` going false starts a `data-closing` phase, and the real
`close()` — and the `closed` output — happen after `DIALOG_CLOSE_DELAY`.
Reopening inside that window aborts the teardown, and the aborted close's reason
does not leak into the next one.

## Why free dragging is not the only way to move it

`draggable` enables pointer dragging from the header, clamped so the surface can
never leave the viewport. A pointer-only affordance is not accessible, so the
same flag adds a **position chooser**: a real disclosure button opening a
keyboard-navigable grid of the nine semantic positions. Choosing one clears any
free-drag offset, so the two never fight. Free dragging composes through the
separate CSS `translate` property, leaving the placement `transform`s untouched.

## Why sizes and heights are token-backed

`size` and `maxHeight` map to `--dialog-size-*` and `--dialog-height-*`, so the
scale is shared with the rest of the system rather than re-picked per dialog.
Every size stays clamped to the dynamic viewport with token gutters, and the
content region scrolls independently while the header and footer stay pinned.

## API

- `visible`: two-way `boolean` (default `false`) — the only way to open or close
- `position`: two-way `DialogPosition` — `center` (default), the four edges and
  the four corners. Written by the position chooser
- `size`: `sm` | `md` (default) | `lg` | `xl`
- `maxHeight`: `sm` | `md` | `lg` | `viewport` (default)
- `header`: text for the built-in heading
- `modal` (default `true`), `closable` (default `true`), `dismissible`
  (default `false`), `closeOnEscape` (default `true`)
- `draggable`, `maximizable`, `fullScreen` — all default `false`
- `maximized`: two-way `boolean` for the user-controlled maximize state
- `ariaLabel`, `ariaLabelledBy`, `ariaDescribedBy`
- `(opened)`, `(closed)`: `DialogClosedEvent` with `reason` —
  `programmatic` | `close-button` | `escape` | `backdrop`
- `(dragEnded)`: `{ x, y }` offset, once per completed drag
- `close()`, `maximize()`, `restore()`, `moveTo(position)`

Content directives:

- `[libDialogHeader]` on projected content — a custom heading beside the tools
- `<ng-template libDialogFooter>` — a footer pinned outside the scrolling body
- `<ng-template libDialogHeadless let-dialog>` — replaces **all** built-in
  chrome; the context exposes `maximized`, `fullScreen`, `close()`,
  `maximize()`, `restore()` and `moveTo()`

## Accessibility

- Modal focus containment, background inertness, `Escape`, focus restoration and
  top-layer stacking all come from the native element.
- The built-in or projected heading names the dialog through `aria-labelledby`;
  `ariaLabel` and `ariaLabelledBy` override it, and `ariaLabelledBy` wins over
  `ariaLabel` when both are given.
- `ariaDescribedBy` is opt-in. Long or structured bodies are deliberately not
  forced into it — a screen reader would read the whole body as one string.
- The maximize control keeps a **stable** name and carries its state on
  `aria-pressed`; a name that flipped between "Maximize" and "Restore" would be
  re-announced while the button held focus. Only the icon swaps.
- The position chooser is a `role="group"` of `aria-pressed` buttons with
  arrow-key navigation and `Escape` to dismiss. `Escape` there stops at the
  chooser — it does not also close a non-modal dialog.
- Every tool is a real `<button type="button">` with a translated name; the
  icons inside them are `aria-hidden` decoration.
- The selected position carries `aria-pressed` as well as a tint, so it never
  rests on colour alone, and a `forced-colors` block re-states it.
- Backdrop-click dismissal is a pointer-only shortcut layered on top of
  `Escape` and the close button; it is never the only way out.
- Control labels ship in Greek and English through the `dialog` Transloco scope.
- Motion is CSS-driven, so the base layer collapses it under
  `prefers-reduced-motion` with no per-component query.

## Running unit tests

Run `nx test shared-ui-dialog` to execute the unit tests.

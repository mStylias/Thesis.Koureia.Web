# shared-ui-textarea

The multi-line text input of the design system, applied as an attribute
on a native `<textarea>` — native semantics, IME, and Signal Forms bind directly
to the element. Import from `@ui/textarea`.

```html
<textarea libTextarea placeholder="Notes"></textarea>
<textarea libTextarea size="sm" invalid></textarea>

<!-- Signal Forms: binds to the real textarea, nothing extra needed -->
<textarea libTextarea [formField]="form.notes"></textarea>
```

## Why the host is the native textarea

Same reasoning as [`input-text`](../input-text/README.md): with an attribute
selector the host _is_ the control, so IME behaviour, `<form>` participation,
`disabled` and `readonly` are native and there is nothing to keep in sync. The
cost is that there is no DOM of its own to render an error message in — a
consumer supplies one and points `aria-describedby` at it.

## Why `autoResize` earns each measurement

The fit has to survive programmatic writes (a Signal Forms bind or reset changes
`value`, which is a DOM property and not reactive state), so it runs from an
`afterEveryRender` hook rather than `(input)` alone. That hook fires on **every**
change-detection pass in the application, and a measurement is not free:
collapsing the box to read `scrollHeight` forces layout, and the two style writes
it takes feed the Storybook host's `style` `MutationObserver` straight into a
resize → write → grow → resize loop.

So the last fit's content and width are cached and the whole measurement is
skipped while neither has moved. The height written back is
`scrollHeight + border`: `scrollHeight` stops at the border while the box is
`border-box`, so writing it bare left the control two hairlines short and clipped
the last line — with the scrollbar that would have revealed it hidden by
auto-sizing.

## API

- `size`: `sm` | `md` (default) | `lg` — matches the InputText, Button, and
  Select sizes
- `invalid`: error border, also reflected as `aria-invalid`; with Signal Forms
  bind it to the field state, e.g.
  `[invalid]="form.notes().touched() && form.notes().invalid()"`
- `resize`: `vertical` (default) | `none` | `both` — maps to the CSS `resize`
  property
- `autoResize`: grows the control to fit its content, hiding the scrollbar and
  the manual resize handle; also re-fits after programmatic writes (Signal Forms
  binding/reset) so pre-filled values size on load
- `disabled`, `readonly`, `rows`, `placeholder`, …: the native attributes —
  nothing custom

```html
<textarea libTextarea autoResize rows="2" placeholder="Grows as you type"></textarea>
```

Float/IFTA labels (`@ui/form-field`) compose directly; give the textarea
`placeholder=" "` so the label can detect a value, and the control consumes
`--field-pad-top` for the `in`/IFTA variants.

## Accessibility

- **Always give the textarea an accessible name** — associate a `<label for>`
  (see the label wrappers) or, failing that, an `aria-label`. A `placeholder` is
  not a label: it disappears on input and can fail contrast.
- `invalid` sets `aria-invalid="true"` on the element itself. The control renders
  no message, so pair it with one referenced by `aria-describedby`.
- Because the host is the native element, the requirement semantic is the
  consumer's own attribute — use **`aria-required`**, not the native `required`,
  which blocks the submit event outright and raises an OS-locale bubble over your
  translated message.
- `readonly` keeps the value readable and focusable but withholds the hover
  border, since hover promises an edit.
- Focus is the 2px accent border (`border-color` + a 1px `box-shadow`), replacing
  the global focus glow so the indicator stays clearly visible (WCAG 2.4.7).
- A `forced-colors` block re-states the resting border and the focus ring, which
  a forced palette would otherwise drop along with the box-shadow.

## Running unit tests

Run `nx test shared-ui-textarea` to execute the unit tests.

# shared-ui-checkbox

The checkbox of the design system: a native `<input type="checkbox">` with a drawn box and an animated check. Import from `@ui/checkbox`.

```html
<!-- Projected content becomes the label and the click target -->
<lib-checkbox [(value)]="remember">Remember me</lib-checkbox>

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-checkbox [formField]="signUpForm.terms">Accept the terms</lib-checkbox>

<!-- Parent of a partially-selected group -->
<lib-checkbox [value]="allSelected()" [indeterminate]="someSelected()"> Select all </lib-checkbox>
```

## Why the native input stays in the DOM

A `<div role="checkbox">` has to reimplement focus, `Space` toggling, form
participation, the `mixed` state and the label association, and gets one of
them subtly wrong. Here the real input is stretched invisibly over the whole
label — a generous hit area — and every state is driven from it in CSS
(`:checked`, `:indeterminate`, `:focus-visible`). The box and check are
`aria-hidden` decoration, so the input remains the single source of state.

Because the input is wrapped in the `<label>`, projected content names the
control with no `for`/`id` wiring.

## API

- `value`: two-way `boolean` (default `false`)
- `indeterminate`: mixed state for a group parent — display only, see below
- `size`: `sm` | `md` (default) | `lg` — the box tracks `--icon-size-*`, so it lines up with Lucide icons and text
- `disabled`, `invalid`, `required` — all bound automatically by `[formField]`
- `inputId`, `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `(touch)`: marks the field touched for Signal Forms once focus leaves
- `focus(options?)`: focuses the native input

### `indeterminate` is display only

The consumer owns the group logic: `indeterminate` renders the mixed dash and
`value` renders the check, and the component never derives one from the other.
The browser clears the `indeterminate` DOM property on click, so the component
restores it after each change — a click that leaves the group still partially
selected keeps rendering as mixed.

## Accessibility

- Native role, focus behaviour and `Space` toggling; the mixed state is
  reported as `aria-checked="mixed"` by the platform.
- With no projected label, set `ariaLabel` (or `ariaLabelledby`) to give the
  control an accessible name.
- `required` is exposed as **`aria-required`**, never the native attribute:
  the native one blocks the submit event outright and raises an OS-locale
  bubble over the form's own translated message. Submit through Signal Forms'
  `submit()`, which marks the form touched so errors surface.
- `invalid` sets `aria-invalid="true"` on the input itself, not on a wrapper.
- Focus is a 2px `--focus-ring` lifted off the box by a surface-coloured gap,
  so it stays visible when the box is filled with the accent.
- A `forced-colors` block re-states the checked fill and the focus ring, which
  a forced palette would otherwise drop along with the box-shadow.

## Running unit tests

Run `nx test shared-ui-checkbox` to execute the unit tests.

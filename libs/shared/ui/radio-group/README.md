# shared-ui-radio-group

The single-choice radio group of the design system. Import `RadioGroup`
from `@ui/radio-group`.

```html
<!-- Two-way binding; `null` is the "nothing selected" sentinel -->
<lib-radio-group [(value)]="plan" [options]="plans" ariaLabel="Plan" />

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-radio-group [formField]="planForm.plan" [options]="plans" variant="card" />
```

## Why a native `<input type="radio">` per option

A `<div role="radio">` group has to reimplement roving focus, arrow-key
navigation, single selection, `Space` activation and form participation, and
gets one of them subtly wrong. Here every option is a real radio sharing one
group `name`, stretched invisibly over its whole `<label>` for a generous hit
area; the browser drives selection and focus, and `:checked` / `:focus-visible`
paint the circle and dot alongside it. The drawn control is `aria-hidden`
decoration, so the input remains the single source of state.

`name` is generated per instance when unset, so two groups on one page never
share a selection by accident.

## Why `value` is `T | null`, not `T | undefined`

Signal Forms builds no child field for an `undefined` value, so a model that
started `undefined` would break `[formField]` outright. `null` is the empty
sentinel instead, and an unselected group is a valid starting state.

## API

- `options`: `RadioOption<T>[]` — `label`, `value`, optional `description` and
  `disabled`; values are compared by reference (`===`)
- `value`: two-way `T | null` (default `null`)
- `variant`: `classic` (default, dot + label row) | `card` (the whole bordered
  tile is the option)
- `size`: `sm` | `md` (default) | `lg` — the circle tracks `--icon-size-*`, so it
  lines up with Lucide icons and text
- `orientation`: `vertical` (default) | `horizontal`
- `disabled`, `invalid`, `required` — all bound automatically by `[formField]`
- `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `(touch)`: marks the field touched for Signal Forms once focus leaves **the
  group** — arrow-key hops between the radios do not count
- `focus(options?)`: focuses the selected radio, or the first enabled one

## Accessibility

- The host is a `role="radiogroup"`; name it with `ariaLabel` or
  `ariaLabelledby`. Each radio takes its name from its wrapping `<label>`, and
  an option `description` is read as part of that name.
- `required` is exposed as **`aria-required`** on the group, never the native
  attribute: the native one blocks the submit event outright and raises an
  OS-locale bubble over the form's own translated message. Submit through
  Signal Forms' `submit()`, which marks the form touched so errors surface.
- `invalid` sets `aria-invalid="true"` on the group and on each radio.
- `ariaDescribedby` is passed through untouched — the group renders no error
  text of its own, so point it at yours.
- Focus is a 2px `--focus-ring` lifted off the circle by a surface-coloured gap,
  so it stays visible against a filled control.
- A `forced-colors` block re-states the selected dot, the selected card and the
  focus ring, which a forced palette would otherwise drop along with the
  box-shadows.

## Running unit tests

Run `nx test shared-ui-radio-group`.

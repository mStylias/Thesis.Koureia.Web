# shared-ui-switch

The switch of the design system, for a boolean setting that applies
immediately: a native `<input type="checkbox">` with `role="switch"` and a drawn
track and thumb. Import from `@ui/switch`.

```html
<!-- Projected content becomes the label and the click target -->
<lib-switch [(value)]="reminders">Appointment reminders</lib-switch>

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-switch [formField]="settingsForm.marketing">Marketing messages</lib-switch>
```

## Why a native checkbox with `role="switch"`

A `<div role="switch">` has to reimplement focus, `Space` toggling, form
participation and the label association, and gets one of them subtly wrong. Here
the real input is stretched invisibly over the whole label — a generous hit area
— and every state is driven from it in CSS (`:checked`, `:focus-visible`). The
track and thumb are `aria-hidden` decoration, so the input remains the single
source of state. `role="switch"` only swaps the announced semantics from
checked/unchecked to on/off.

Because the input is wrapped in the `<label>`, projected content names the
control with no `for`/`id` wiring.

## Switch or checkbox?

A switch applies its change **immediately** — it is a setting, not an answer. If
the value only takes effect when the form is submitted, use
[`lib-checkbox`](../checkbox/README.md) instead. The two share their size scale,
their focus ring and their host-attribute contract, so swapping one for the other
is a template change only.

## API

- `value`: two-way `boolean` (default `false`)
- `size`: `sm` | `md` (default) | `lg` — the track tracks `--icon-size-*`, so it
  lines up with Lucide icons and text
- `disabled`, `invalid`, `required` — all bound automatically by `[formField]`
- `inputId`, `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `(touch)`: marks the field touched for Signal Forms once focus leaves
- `focus(options?)`: focuses the native input

Signal Forms: implements `FormValueControl<boolean>`, so it binds directly with
`[formField]="settingsForm.reminders"`.

## Accessibility

- Native role, focus behaviour and `Space` toggling; `role="switch"` reports the
  state as on/off.
- With no projected label, set `ariaLabel` (or `ariaLabelledby`) to give the
  control an accessible name.
- `required` is exposed as **`aria-required`**, never the native attribute: the
  native one blocks the submit event outright and raises an OS-locale bubble
  over the form's own translated message. Submit through Signal Forms'
  `submit()`, which marks the form touched so errors surface.
- `invalid` sets `aria-invalid="true"` on the input itself, not on a wrapper;
  `ariaDescribedby` is passed through untouched for your own hint or error text.
- Focus is a 2px `--focus-ring` lifted off the track by a surface-coloured gap,
  so it stays visible when the track is filled with the accent.
- The on state is carried by the thumb **position** as well as the track fill,
  so it never rests on colour alone. A `forced-colors` block re-states the fill,
  the thumb and the focus ring, which a forced palette would otherwise drop
  along with the box-shadow.
- Motion is one short transform transition; the base layer collapses it globally
  under `prefers-reduced-motion`, so there is no per-component query.

## Running unit tests

Run `nx test shared-ui-switch` to execute the unit tests.

# shared-ui-multi-select

The multi-value select of the design system, built on the headless
`@angular/aria` combobox + listbox pattern. Selection is explicit — clicking or
Enter toggles options and the dropdown stays open until Escape, Tab, or an
outside click. Import from `@ui/multi-select`.

```html
<lib-multi-select
  [options]="services"
  [(value)]="selectedServices"
  display="chip"
  placeholder="Select services"
  ariaLabel="Services"
/>

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-multi-select [formField]="bookingForm.services" [options]="services" />
```

## Reading from a data source

Bind `source` instead of `options` to read from a `DataSource<TItem>`
(`@ui/data-source`). `options` wins when both are bound, so adding a source can
never make an already-populated control fetch.

```html
<lib-multi-select
  [source]="roles"
  key="id"
  [displayWith]="roleName"
  [(value)]="roleIds"
  display="chip"
  ariaLabel="Roles"
/>
```

`value` then holds the items' declared keys rather than the items, `byKeys`
restores chips for selections no page has loaded, typing queries the source
(debounced, aborting the superseded request) and the panel pages as it scrolls.
`lib-select`'s section on each of those applies here unchanged.

Two things are this control's own.

**A selection the current query filtered out stays selected.** The listbox only
ever answers about the options it rendered — and it _rewrites_ the value it was
given to drop anything else. So the control hands it only the values it can see
and carries the rest across itself. Without that, searching would empty the
selection the user had just made.

**Values the source cannot display are counted, not dropped.** One note beside
the chips reports how many, rather than a chip each; the ids stay in `value`
because the form still has to save them back.

## Why the × affordances are `aria-hidden` and pointer-only

`role="combobox"` is role-restricted: a nested `<button>` inside the trigger
breaks its ARIA contract and trips `aria-required-children`. So the chip and
clear ×s are decorative `<svg>`s that only respond to a pointer, and the
keyboard path is the one the pattern already provides — toggle an option off in
the list, or press `Delete`/`Backspace` on the closed trigger to clear.

Because they never reach the accessibility tree, their labels are **`title`
tooltips, not `aria-label`s** (same conclusion as the tabs library reached). An
`aria-label` on an `aria-hidden` element is dead markup.

## Why chips animate in JS

A leaving chip fades out _in place_ first; only then does its slot collapse,
with the survivors sliding into it. The FLIP measurements have to bracket the
exact moment Angular removes the element, which CSS cannot express — so the
enter animation is CSS and the leave/slide is driven from `(animate.leave)`.
Reduced motion and missing Web Animations support (SSR, jsdom) short-circuit the
whole path.

## API

- `options`: `SelectOption<T, TItem>[]` from `@ui/select`
- `value`: two-way `T[]`; empty array while nothing is selected
- `display`: `comma` (default, joined labels) | `chip` (removable chips)
- `maxWidth`: any CSS length; chips wrap inside it, a label wider than it
  truncates, and past three rows the rest fold into a "+N" chip
- `size`, `placeholder`, `showClear`, `loading` — same semantics as `lib-select`
- `disabled`, `invalid`, `required` — all bound automatically by `[formField]`
- `source`: `DataSource<TItem>` — remote options; see above
- `key`: `KeySpec<TItem>` — required with `source`
- `displayWith`: `(item: TItem) => string`, `optionDisabled`: `(item: TItem) => boolean`
- `pageSize` (default 20), `debounceMs` (default 250) — source path only
- `loadErrorMessage`, `unavailableMessage`, `searchHint` — fall back to the
  `multiSelect` scope
- `(resolutionFailed)`: bound values were kept but could not be displayed
- `reload()`: re-runs the active source query
- `inputId`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `emptyMessage`, `clearAriaLabel`, `removeChipAriaLabel` — all fall back to the
  lib's `multiSelect` Transloco scope (el/en) when left empty
- `(touch)`: marks the field touched for Signal Forms once focus leaves
- `focus(options?)`: focuses the trigger
- Custom option rows via the same `<ng-template libSelectOption let-option>`
  directive as `lib-select`

Signal Forms: implements `FormValueControl<T[]>`, so it binds directly with
`[formField]="form.services"`.

Float/IFTA labels: sets the `data-filled` host attribute and consumes
`--field-pad-top`, so it composes with `libFloatLabel` / `libIftaLabel` from
`@ui/form-field`.

## Accessibility

- Give the trigger an accessible name via `ariaLabel`, `ariaLabelledby`, or an
  external `<label for>` targeting `inputId`.
- The popup is a `role="listbox"` with `aria-multiselectable`; focus stays on
  the trigger and moves through `aria-activedescendant`.
- `required` is exposed as **`aria-required`**, never the native attribute: the
  native one blocks the submit event outright and raises an OS-locale bubble
  over the form's own translated message. Submit through Signal Forms'
  `submit()`.
- `ariaDescribedby` is passed through untouched — the control renders no error
  text of its own.
- A **disabled** control withholds both × affordances _and_ ignores the
  `Delete`/`Backspace` shortcut. The pattern disables through `aria-disabled`,
  so the trigger keeps DOM focus and would otherwise still be editable from the
  keyboard.
- The active-option ring only renders during keyboard interaction (the host
  mirrors `:focus-visible` through `data-modality`).
- With a `source` bound, the panel's search row is presentational: focus stays
  on the trigger and the row only displays what was typed, so the combobox keeps
  a single tab stop and its `aria-activedescendant`.
- A `forced-colors` block re-states the focus ring, the active option and the
  selected row, which a forced palette would otherwise drop along with the
  box-shadows.

## Running unit tests

Run `nx test shared-ui-multi-select` to execute the unit tests.

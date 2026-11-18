# Number input

The number field of the design system. While focused you edit a plain
number; on blur the value commits (clamped to `min`/`max`) and renders formatted
through `Intl.NumberFormat`. Implements Signal Forms
`FormValueControl<number | null>`, and `null` means empty.

```html
<lib-input-number [(value)]="price" mode="currency" currency="EUR" locale="el-GR" />
<lib-input-number [(value)]="minutes" suffix=" min" [min]="0" [step]="5" showButtons />
```

## Why the display and the edit text differ

Grouping separators, a currency symbol, and literal `prefix`/`suffix` text are
all useful to read and all noise to edit — a caret landing between `1.234` and
`,5` has no good behaviour. So the field shows the formatted string while
blurred and the plain number while focused, and commits only on blur. `parse`
strips whatever the formatter added, which is also what makes pasting a
formatted number work.

## Formatting

- `mode`: `decimal` (default) | `currency` (with `currency`, an ISO 4217 code,
  default `EUR`)
- `locale`: BCP 47 tag, defaults to `LOCALE_ID`; parsing accepts the locale's
  decimal separator (e.g. `12,5` for el-GR)
- `useGrouping` (default on), `minFractionDigits`, `maxFractionDigits`
- `prefix` / `suffix`: literal text around the formatted value (e.g. ` min`)
- `valueFormatter`: optional formatter that replaces the `Intl.NumberFormat`
  result while keeping `prefix` and `suffix`

## Stepping

- `min` / `max` / `step`: commits clamp, and the buttons and arrow keys step and
  disable at the bounds. A `step` of `0`, a negative, or a non-numeric value
  falls back to `1` rather than freezing the spinner or writing `NaN`.
- `showButtons` + `buttonLayout`: `stacked` (chevrons at the right edge) |
  `horizontal` (− and + flanking). The buttons are pointer-only (`aria-hidden`,
  `tabindex="-1"`) because the arrow keys already cover stepping for the
  keyboard, and they keep focus in the input.

## Signal Forms

`[formField]="form.price"` binds `value`, `disabled`, `invalid`, `touched`,
`required` and `errors` automatically, and blur marks the field touched. The
control renders the first error itself once the field is touched or blurred —
`required`, `min` and `max` get translated messages, anything else falls back to
a generic one, and a validator's own `message` always wins.

### Why `null`, not `undefined`

Signal Forms reads a model member typed `number | undefined` as optional, and its field
tree as one that may not exist, so `[formField]` cannot bind it. An empty number field is
`null` in the model: `signal<{ price: number | null }>({ price: null })`. A consumer that
keeps `undefined` for empty, as the datagrid's filters do, converts at the binding:
`(valueChange)="onValue($event ?? undefined)"`.

## Disabled and read-only

`disabled` removes the control from operation. `readonly` keeps the value
readable and focusable but withholds every affordance that would change it: no
clear button, no step buttons, and no commit of typed text. Both are re-checked
inside each handler, so a click that lands after the state flips cannot slip
through.

## API

`value`, `mode`, `currency`, `locale`, `useGrouping`, `minFractionDigits`,
`maxFractionDigits`, `min`, `max`, `step`, `prefix`, `suffix`, `valueFormatter`, `showButtons`,
`buttonLayout`, `placeholder`, `size` (`sm|md|lg`), `disabled`, `readonly`,
`invalid`, `frameless`, `touched`, `required`, `errors`, `showClear`,
`inputId`, `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`,
`clearAriaLabel`, `(touch)`, and a public `focus(options?)`.

`frameless` hides the border, background and focus ring so a parent can draw
one frame around a group — an amount beside a currency select, an editor beside
an operation chooser. Two frames a hairline apart read as two controls. The
**leading** inline padding goes too, since the parent's frame supplies that
inset; the trailing padding stays so the step and clear buttons are held off the
frame. The validation message floats over the control instead of sitting under
it, so a rejected value never re-flows the row it lives in — the host must not
clip it or out-rank it in the stacking order. (`@ui/date-picker` floats the same
message in an overlay, because a data grid's viewport clips it whatever the
stacking order says.) The `invalid` border goes too: the frame paints the error
state, since a red hairline around the inner field alone draws a box inside a
frame that stays neutral.

## Accessibility

- The inner input is a `role="spinbutton"` with `aria-valuenow`/`min`/`max` and
  `aria-valuetext` carrying the formatted value; ArrowUp/Down step by `step` and
  Home/End jump to the bounds. `inputmode="decimal"` raises the numeric keyboard
  on touch devices.
- Required is exposed as `aria-required`, never the native attribute, so the
  browser cannot block `submit()` with an untranslated bubble.
- `ariaDescribedby` is composed with the control's own error id, never
  overwritten.
- Copy comes from the `inputNumber` Transloco scope (Greek first, English
  fallback); `ariaLabel` and `clearAriaLabel` override it when set.
- The error message is a `role="alert"` and appears only once the field is
  touched or blurred, so a pre-filled invalid value never accuses the user of a
  mistake they have not made — and the invalid state is never carried by the
  border colour alone.

## Composing

Float/IFTA labels: sets `data-filled` and consumes `--field-pad-top`, so it
composes with `libFloatLabel` / `libIftaLabel` from `@ui/form-field`.

## Running unit tests

Run `nx test shared-ui-input-number` to execute the unit tests.

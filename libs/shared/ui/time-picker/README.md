# Time picker

Accessible appointment-time control built on Angular Aria. It implements
Signal Forms `FormValueControl<string>` and writes canonical 24-hour `HH:mm`
values (`''` while empty).

## Dropdown mode

The default editable combobox offers interval suggestions while preserving the
ability to type an exact time. Common input such as `9`, `930`, and `9:30` is
normalized on commit.

```html
<lib-time-picker
  [(value)]="appointmentTime"
  [interval]="30"
  min="09:00"
  max="18:00"
  ariaLabel="Appointment time"
/>
```

## Inline mode

`inline` is the visible-slot presentation (a clearer name than “layout”). It is
an ARIA listbox with arrow-key navigation. Excluded slots can remain visible and
disabled or be removed.

```html
<lib-time-picker
  mode="inline"
  [interval]="30"
  [excludedRanges]="[{ start: '13:00', end: '14:00' }]"
  [excludedTimes]="['10:30']"
  excludedDisplay="disabled"
/>
```

Ranges are half-open: `{ start: '13:00', end: '14:00' }` excludes `13:00` and
`13:30`, but not `14:00`. Overnight ranges are supported.

## Exact valid values and Signal Forms

Use `validTimes` when the backend is authoritative. The interval is ignored for
slot generation and only the supplied values are selectable. Apply the same
constraints to `validateTime` so programmatic model writes are validated too.

```ts
const constraints = {
  min: '09:00',
  max: '18:00',
  validTimes: ['09:00', '09:30', '11:00'],
} as const;

readonly bookingForm = form(this.model, (booking) => {
  required(booking.time);
  validateTime(booking.time, constraints);
});
```

```html
<lib-time-picker
  [formField]="bookingForm.time"
  [min]="constraints.min"
  [max]="constraints.max"
  [validTimes]="constraints.validTimes"
/>
```

## Why typed text that cannot be honoured empties the model

Text is committed on blur, on Enter, and never mid-keystroke. If it does not
parse, or names an unavailable time, the canonical value is emptied and the
typed text stays on screen with the matching message (`timeFormat` versus
`timeUnavailable`) — so a consumer never reads a value the field is not
showing.

## Disabled and read-only

`disabled` removes the control from the form and from operation. `readonly`
keeps the slots readable and focusable but withholds every affordance that
would change the value: no clear button, no dropdown, no selectable slot, and
no commit of typed text. Both are re-checked inside each handler, so a click
that lands after the state flips cannot slip through.

## Accessibility

- Dropdown mode is an `@angular/aria` combobox — the input owns
  `role="combobox"`, `aria-expanded` and the active-descendant wiring; the
  chevron is a pointer-only affordance (`aria-hidden`, `tabindex="-1"`), never
  the only way to open the list.
- Required is exposed as `aria-required`, never the native attribute, so the
  browser cannot block `submit()` with an untranslated bubble.
- `ariaDescribedby` is composed with the control's own error id, never
  overwritten.
- `clearAriaLabel` overrides the translated name of the clear button.
- The error message is a `role="alert"` and appears once the field is touched
  or blurred — a pre-filled invalid value never accuses the user up front.

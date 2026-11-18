# Date picker

Editable, locale-aware appointment-date control. It implements Signal Forms
`FormValueControl<string>` and always writes canonical Gregorian `YYYY-MM-DD`
values (`''` while empty), regardless of the displayed regional format.

```html
<lib-date-picker
  [(value)]="appointmentDate"
  locale="el-GR"
  [min]="today"
  [excludedWeekdays]="[7]"
  ariaLabel="Ημερομηνία ραντεβού"
/>
```

With `locale="el-GR"`, `2026-07-13` is presented and accepted as
`13/07/2026`. When `locale` is omitted the browser's first configured language
is used after hydration, with Angular's locale as the SSR fallback.

Both `dropdown` and `inline` modes keep the text field editable. Once a typed
date is complete and valid, the model and visible calendar update immediately.
Partial or unavailable text leaves the canonical model empty and is announced
as an error after blur or Enter.

Inline mode can render only the calendar with `[showInput]="false"`. This option
does not hide dropdown mode's editable trigger.

```html
<lib-date-picker mode="inline" [showInput]="false" [(value)]="appointmentDate" />
```

## Availability and Signal Forms

`validDates` makes a backend-provided list authoritative: an empty list allows
no date, and only leaving it unset means no limit. Exact dates,
inclusive ranges, and recurring ISO weekdays can also be excluded. Apply the
same constraints to `validateDate` so programmatic writes are validated.

```ts
const constraints = {
  min: '2026-07-01',
  max: '2026-08-31',
  excludedWeekdays: [7],
  excludedRanges: [{ start: '2026-08-10', end: '2026-08-16' }],
} as const;

readonly bookingForm = form(this.model, (booking) => {
  required(booking.date);
  validateDate(booking.date, constraints);
});
```

```html
<lib-date-picker
  [formField]="bookingForm.date"
  [min]="constraints.min"
  [max]="constraints.max"
  [excludedWeekdays]="constraints.excludedWeekdays"
  [excludedRanges]="constraints.excludedRanges"
/>
```

## How full each day is

`availability` tints the selectable days of the shown month by the free share of
their capacity, `0` to `1`. Above 50% takes the strongest accent step, 20% to
50% the middle one, and below 20% the faintest. A day with no entry, or at `0`,
stays plain. The selection fill wins over a tint. A legend shows under the grid
while any day has a level. Build the map with `availabilityFromCapacity` from
per-day free and total counts, and page it with `visibleMonthChange`.

```html
<lib-date-picker
  [validDates]="availableDays()"
  [availability]="dayAvailability()"
  (visibleMonthChange)="month.set($event)"
/>
```

## The field is typed into first

The text input is the primary way in, so nothing opens the calendar except the
toggle button and `ArrowDown`. Clicking or typing in the input leaves it shut —
a calendar that springs open on focus or on every keystroke covers whatever the
user was reading and takes the field away mid-entry, which matters most where
the picker is small, as in a data grid's filter row.

The field carries one adornment by default, the toggle, and it draws a calendar.
There is no decorative calendar beside the value: a second glyph said nothing
while costing a field's worth of width.

`showClear` adds a second adornment, and only while there is a date to clear.
It is opt-in because the input is editable text — selecting it and deleting
already empties the field — so most forms do not need the width. A filter bar is
where it earns its place: clearing is frequent and deliberate there, and the
fields beside it clear the same way. `clearAriaLabel` overrides the translated
name. Both `disabled` and `readonly` withhold the button, and `clear()`
re-checks them, so a click that lands after the state flips cannot edit the
value.

## Disabled and read-only

`disabled` removes the control from the form and from operation. `readonly`
keeps the calendar readable and focusable but withholds every affordance that
would change the value: no selectable day and no "today" shortcut. Both are
re-checked inside each handler, so a click that lands after the state flips
cannot slip through.

## Composed into a parent's frame

`frameless` hides the field's border, background and focus ring so a parent can
draw one frame around a group — a date beside an operation chooser, a bound
beside its opposite. The parent then owns the resting border and the
`:focus-within` ring; two frames a hairline apart read as two controls. The
**leading** inline padding goes too, since the parent's frame supplies that
inset; the trailing padding stays so the toggle is held off the frame. The
validation message floats over the control instead of sitting under it, so a
mistyped date never re-flows the row it lives in. The `invalid` border goes too:
a red hairline around the inner field alone draws a box inside a frame that
stays neutral, so the frame must paint the error state instead.

The message rides in an overlay, above the frame and aligned to its leading
edge, flipping below it when there is no room. It has to: a composed picker
sits inside whatever its host scrolls, and a scroll container clips everything
drawn outside it — a data grid's viewport cut the top line off a two-line
message, which no z-index can fix. Mark the frame with **`data-field-frame`**
and the message anchors to that edge rather than to the picker, which starts
after whatever the frame holds before it. Without the attribute it anchors to
the picker's own field.

## Accessibility

- The calendar is an `@angular/aria` grid: arrow keys move by day, Home/End by
  week, PageUp/PageDown by month (Shift by year), and the focused month is
  announced through the heading.
- Required is exposed as `aria-required`, never the native attribute, so the
  browser cannot block `submit()` with an untranslated bubble.
- `ariaDescribedby` is composed with the control's own error id, never
  overwritten.
- Unavailable days keep `aria-disabled` and a strike-through, so availability
  is never carried by colour alone — including under forced colours.
- A tinted day adds its level to its accessible name (`…, few free times`). The
  legend is `aria-hidden`, because it repeats that text. Under forced colours the
  tint becomes an underline that grows with the level.

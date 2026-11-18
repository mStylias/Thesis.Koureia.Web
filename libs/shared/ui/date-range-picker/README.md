# @ui/date-range-picker

Two dates that bound a range. A "from" and a "to" field take typed dates, and a calendar panel
offers presets and a two-month calendar.

```ts
import { DateRangePicker, DATE_RANGE_PRESETS, type DateRangeValue } from '@ui/date-range-picker';
```

```html
<lib-date-range-picker [(value)]="range" [presets]="presets" [maxDays]="731" />
```

The value is `{ preset, from, to }`. `from` and `to` are canonical `YYYY-MM-DD`, both inclusive,
and empty strings mean no range. `preset` is the id of the preset that produced the dates, or
`null` for picked or typed dates. A consumer can store the id and resolve it again later with
`resolveDateRangePreset`, so a saved "last 30 days" moves with time.

## Behavior

- **Typed dates** use the locale's numeric format. They commit on Enter, or when focus leaves the
  control and its panel. Moving between the two fields is not leaving.
- **Refused text empties the value and stays on screen** with its message: not a date, outside
  `minDate`/`maxDate`, end before start, or longer than `maxDays`. A form then never submits the
  range the user replaced. A value set by the consumer replaces the text and clears the message.
- **The panel edits a draft.** The first click sets one end. The second sets the other, in
  either order. **Apply** writes the draft. Cancel, Escape and a click outside discard it.
- **A drag picks a range too.** Press on one day and release on another, with a mouse, pen or
  finger. A press and release on one day stays a click. A finger dragged across the days selects
  instead of scrolling the page.
- **The month heading opens a month grid** with year arrows. A month picked there shows in the
  column whose heading opened it. A first click still waiting for its second survives the jump,
  so a range can span years. Escape leaves the grid before it closes the panel.
- **A preset applies at once** and closes the panel. A preset that the limits refuse is disabled.
- After the first click, the days past `maxDays` are disabled.
- The panel shows two months, with the value's last month in the last column. Below 42rem it shows
  one month, and the presets wrap above it.

## Why not `@angular/aria/grid`

`@ui/date-picker` uses `ngGrid`, which handles one month. A range moves between two months, and a
day in one month must be reachable by arrow from the other. Each month is a `role="grid"` table,
and one roving tab stop (`focusedDate`) spans both. The keyboard handler moves it and turns the
months when it leaves them.

## Why the neighbouring month's days are blank

With two months side by side, the last days of the first month's grid are the first days of the
second. Shown twice, one date would have two cells, two tab stops and two `data-date` targets.
Only the month that owns a day renders it.

## Why `minDate` and `maxDate`, not `min` and `max`

Signal Forms binds a field's own `min` and `max` state to control inputs with those names, typed as
the field's value. On this control that is a `DateRangeValue`, so inputs named `min` and `max` fail
to compile under `[formField]`.

## API

| Input                                      | Default     | Notes                                                       |
| ------------------------------------------ | ----------- | ----------------------------------------------------------- |
| `value`                                    | empty range | `model<DateRangeValue>`                                     |
| `presets`                                  | `[]`        | `DATE_RANGE_PRESETS`, or your own `{ id, label?, resolve }` |
| `minDate`, `maxDate`                       | none        | Inclusive                                                   |
| `maxDays`                                  | none        | Both ends counted                                           |
| `today`                                    | local today | For tests and stories. Presets count from it                |
| `locale`                                   | browser     | BCP 47                                                      |
| `firstDayOfWeek`                           | `auto`      | ISO weekday, or the locale's                                |
| `size`                                     | `md`        | `sm`, `md`, `lg`                                            |
| `disabled`, `readonly`                     | `false`     | Read-only opens the panel but offers no edit                |
| `invalid`, `touched`, `required`, `errors` | —           | Signal Forms                                                |
| `inputId`                                  | generated   | The "from" field                                            |
| `ariaLabel`, `ariaLabelledby`              | translated  | Names the group of both fields                              |
| `fromAriaLabel`, `toAriaLabel`             | translated  | Names each field                                            |
| `ariaDescribedby`                          | —           | The control appends its error id                            |

Output: `touch`, once focus leaves the control and its panel. Method: `focus()`.

A built-in preset's label is `dateRangePicker.presets.<id>`. A custom preset gives `label`.

`validateDateRange(path, { min, max, maxDays })` gives the same rules to a Signal Form.
It passes an empty range: pair it with the form's own required rule.

## Accessibility

- The two fields sit in a named `role="group"`. Each has its own name.
- The panel is a `role="dialog"`. Each month is a `role="grid"` named by its heading, with
  `aria-multiselectable`. Every day in the range is `aria-selected`.
- Arrows move by day and week, PageUp and PageDown by month (Shift by year), Home and End to the
  week's ends. Enter or Space picks.
- In the month grid, arrows move by month and row, across years at the edges. Escape returns to
  the days, with focus on the heading that opened the grid.
- The summary line is `aria-live="polite"`. It changes only on a click, so it is not chatty.
- The range, its ends, today and the preset in force keep their marks under forced colors.
- Every string can be replaced through `@util/ui-copy`. The customer pages have singular overrides
  for the strings that address the reader.

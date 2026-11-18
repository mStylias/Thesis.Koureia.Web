# shared-ui-calendar

A calendar of timed events: day, week, month, year and agenda views, a toolbar,
and a side panel the host fills. Import from `@ui/calendar`.

The component knows events, resources, badges, hours and slots. It never knows
what those stand for: the host maps its records to `CalendarEvent`, supplies the
copy that names them, and receives intents back (`rangeChange`, `eventOpen`,
`slotCreate`). Every request belongs to the host.

```ts
import {
  Calendar,
  CalendarFilterActionsSlot,
  CalendarFiltersSlot,
  CalendarViewsSlot,
  type CalendarEvent,
  type CalendarRange,
} from '@ui/calendar';
```

```html
<lib-calendar
  [events]="events()"
  [resources]="resources()"
  [hours]="hours()"
  [dayCounts]="dayCounts()"
  [timezone]="timezone"
  [loading]="loading()"
  [filtersActive]="activeFilters()"
  createLabel="New booking"
  [(view)]="view"
  [(anchor)]="anchor"
  [(panel)]="panel"
  (rangeChange)="load($event)"
  (eventOpen)="open($event)"
  (slotCreate)="create($event)"
  (refresh)="reload()"
>
  <lib-saved-views libCalendarViews [controller]="views" />
  <my-filters libCalendarFilters />
  @if (activeFilters() > 0) {
  <button libCalendarFilterActions libButton variant="text" (click)="clear()">Clear all</button>
  }
</lib-calendar>
```

## `lib-calendar`

The facade: a toolbar, a side panel and the five views. Each view is also
exported on its own, below, for a screen that draws one view without the rest.

| Kind   | Name                                                                                | Notes                                                                                          |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| input  | `events`, `resources`, `hours`, `dayCounts`                                         | the host's data, already filtered                                                              |
| input  | `timezone`, `locale`, `firstDayOfWeek`                                              | `locale` defaults to the active Transloco language                                             |
| input  | `loading`, `refreshing`                                                             | a thin bar over the view; a spinning, blocked refresh button                                   |
| input  | `createLabel`, `dayColumnsLabel`                                                    | host copy; generic fallbacks in the `calendar` scope                                           |
| input  | `resourceLabel`                                                                     | the host's noun for a resource, spoken before its name in every event name: "Barber: Nikos P." |
| input  | `filtersActive: number`                                                             | a count on the Filters button                                                                  |
| model  | `view`, `anchor`, `timeScale`, `dayColumns`, `showTime`, `panel`, `selectedEventId` | an empty `anchor` means today in `timezone`; `showTime` is off by default                      |
| output | `rangeChange(CalendarRange)`                                                        | on the first render and whenever the view or the anchor moves the dates                        |
| output | `eventOpen(CalendarEvent)`                                                          | one click on an event                                                                          |
| output | `slotCreate(CalendarSlot \| null)`                                                  | a double click on empty space; `null` from the create button                                   |
| output | `refresh()`                                                                         |                                                                                                |
| slot   | `[libCalendarViews]`                                                                | saved views, between the toolbar's two separators                                              |
| slot   | `[libCalendarFilters]`                                                              | the body of the filters panel; no Filters button without it                                    |
| slot   | `[libCalendarFilterActions]`                                                        | the footer of the filters panel                                                                |
| read   | `layout()`, `panelOverlay()`                                                        | what the toolbar draws, and whether the panel overlays                                         |

The toolbar folds by the calendar's own width, never the window's, because the
push panel narrows the calendar without moving the window. What does not fit
moves to a "more" panel in one fixed order: the view buttons become a select,
then refresh, settings, Filters, the saved views and the view select leave the
bar, then Today loses its word, and create goes last. A `lib-saved-views` left
at `layout="auto"` reads the calendar's `SAVED_VIEWS_HEADROOM` and turns compact
as the bar folds.

Below `PANEL_OVERLAY_MAX_WIDTH` the side panel slides over the calendar instead
of pushing it, and a panel open at the crossing closes. A host that persists the
panel skips an open made while `panelOverlay()` is set.

### Why the facade provides no translation scope

A `viewProviders` entry is meant to stay out of projected content, but a
multi provider in it still reaches content that the host wraps in `@if`. The
`calendar` scope there would make every `transloco` pipe in the host's filters
look its keys up in the wrong scope. The toolbar, the side panel and the views
provide the scope themselves; the facade has no copy of its own.

### Why the view switcher is buttons, not tabs

A tab must own a panel, and `@angular/aria` reports every `ngTab` without an
`ngTabPanel` as a violation. The views are drawn outside the toolbar, so the
switcher is a group of toggle buttons with `aria-pressed`.

### Why the overflow is a panel, not a menu

The folded view select and saved views stay real controls, and `role="menu"`
admits menu items only. The datagrid's toolbar folds the same way.

### Why the side panel is never modal

A modal `<dialog>` paints in the top layer, above every CDK overlay, so a list
the host's filters open would draw behind it. The panel is `show()`n in both
modes, which also lets one drawer change between push and overlay in place.

## `lib-calendar-toolbar`, `lib-calendar-side-panel`, `lib-calendar-settings`

The facade's parts, exported for a host that composes its own shell. The
toolbar takes a `layout` from `toolbarLayout(width)` and emits `navigate`
(`'today' | 'previous' | 'next'`), `dateSelect`, `refresh` and `create`. The
side panel wraps `lib-drawer` and cross-fades between the host's filters and
the settings. The settings hold the time scale (5, 10, 30 or 60 minutes), whether
tiles show their times, and, in day view only, the per-resource columns switch.

## Vocabulary

| Type               | What it is                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `CalendarEvent`    | One timed entry on one day: `date`, `start`, `end`, `title`, `subtitle?`, `resourceId?`, `badge?`, `muted?`. |
| `CalendarResource` | What events belong to: a column in per-resource day view and one of six swatches everywhere.                 |
| `CalendarHours`    | The open hours of one weekday. A weekday with no entry is closed.                                            |
| `CalendarBadge`    | A short state on a tile, text first and a semantic tone second.                                              |
| `CalendarRange`    | The dates a view draws, end exclusive, with the view that asked.                                             |
| `CalendarSlot`     | A place the user pointed at: a date, a time in it, a column's resource.                                      |
| `CalendarColumn`   | One column of the time grid: a `date`, and a `resourceId` in per-resource mode.                              |

Dates are `YYYY-MM-DD` and times `HH:mm`, local to the host's time zone. The
calendar never converts an instant except to read "now" through `zoneClock`.

## `lib-calendar-time-grid`

Day, week and per-resource day are one component parameterised by `columns`.
Day is one column, week seven, per-resource day one per resource on one date.

| Kind   | Name                                 | Notes                                                      |
| ------ | ------------------------------------ | ---------------------------------------------------------- |
| input  | `columns: readonly CalendarColumn[]` | required                                                   |
| input  | `events`, `resources`, `hours`       | the host's data, already filtered                          |
| input  | `timeScale: 5 \| 10 \| 30 \| 60`     | minutes per row                                            |
| input  | `timezone`, `locale`                 | for the now line and the labels                            |
| model  | `selectedEventId`, `selectedSlot`    | one selection at a time                                    |
| output | `eventOpen(CalendarEvent)`           | one click on a tile, or a row of a "+N" list               |
| output | `slotCreate(CalendarSlot)`           | double click on empty space, or `Enter` on a selected slot |

The axis is all 24 hours. Minutes outside `hours` are shaded, a weekday with no
entry is closed, and the grid opens scrolled to the first open hour. Overlapping
events share a column up to four wide; the rest sit behind a "+N" chip that opens
`lib-calendar-more-popover`. Each column is a focusable group: the arrow keys pick
a row, `Enter` creates there, `Escape` lets go. Tiles are `<button>`s named by
their times, title, resource and badge. `resourceLabel` prefixes the resource with the
host's noun.

`button[libCalendarTile]` and `lib-calendar-more-popover` are exported for a view
that draws tiles or a hidden-events list of its own. The tile's host binds
`[attr.aria-label]="tile.label()"` itself.

## `lib-calendar-month`

| Kind   | Name                                                                   | Notes                                                                  |
| ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| input  | `anchor: DateValue`                                                    | any date of the month, required                                        |
| input  | `events`, `resources`, `hours`, `timezone`, `locale`, `firstDayOfWeek` |                                                                        |
| model  | `selectedEventId`                                                      |                                                                        |
| output | `eventOpen(CalendarEvent)`                                             | a row, here or in a "+N" list                                          |
| output | `dayOpen(DateValue)`                                                   | the day number, or `Enter` on a cell                                   |
| output | `slotCreate(CalendarSlot)`                                             | double click on empty space, or `Shift`+`Enter`; carries the date only |

Whole weeks, four to six rows. A cell lists its day in start order and trims to
the rows that fit, measured once per resize through a token-sized probe. Below
`--calendar-cell-min-width` the rows become swatch dots and the count moves into
the cell's accessible name. `role="grid"` with roving focus: one tab stop, the
arrows move it by a day or a week.

## `lib-calendar-year`

| Kind   | Name                                             | Notes                            |
| ------ | ------------------------------------------------ | -------------------------------- |
| input  | `anchor: DateValue`                              | any date of the year, required   |
| input  | `dayCounts: Readonly<Record<DateValue, number>>` | a missing day is zero            |
| input  | `hours`, `timezone`, `locale`, `firstDayOfWeek`  | closed weekdays are never tinted |
| output | `dayOpen(DateValue)`                             | click or `Enter` on a day        |
| output | `monthOpen(DateValue)`                           | the heading, or a card press     |

Twelve mini months, four to one per row by the host width. Four tint steps (0,
1–2, 3–5, 6+) with a legend; the count is also the day's `title` and part of its
name.

## `lib-calendar-agenda`

| Kind   | Name                                        | Notes                                |
| ------ | ------------------------------------------- | ------------------------------------ |
| input  | `anchor: DateValue`                         | any date of the month, required      |
| input  | `events`, `resources`, `timezone`, `locale` | events outside the month are ignored |
| model  | `selectedEventId`                           |                                      |
| output | `eventOpen(CalendarEvent)`                  |                                      |

The month as a list grouped by day with sticky heads. Empty days are skipped,
an empty month says so, and the current month opens on today.

## `core/`

No Angular, no DOM. Each file is unit-tested on its own.

| File                | Functions                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `date-math.ts`      | `viewRange`, `shiftAnchor`, `startOfWeek`, `weekDays`, `monthGridDays`, `yearMonths`, `datesBetween`, `eventMinutes`, `snapMinutes`, `zoneClock` |
| `tile-layout.ts`    | `packTimed` (overlap columns, capped, with overflow chips), `fitList` (a capped cell and its "+N"), `densityStep`                                |
| `event-label.ts`    | `eventNameParts`, `eventNameSuffix`: the resource and the badge in an event's accessible name, shared by every view                              |
| `toolbar-layout.ts` | `toolbarLayout(width, { views })`: which controls are inline at a host width; `CALENDAR_VIEWS`, `isCalendarView`                                 |
| `range-label.ts`    | `rangeLabel` and the per-view labels, all through `Intl`                                                                                         |

`date-math.ts` builds on `@ui/date-picker`'s exported utilities, so weekday
order and month names come from `Intl` and are written once in the workspace.

## Accessibility

| Part           | What a keyboard or a screen reader gets                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar        | A named `group`. Every icon button has a name and a tooltip. Filters, settings and the view buttons are toggles with `aria-pressed` and a stable name. The Filters count is `aria-hidden`, and its name says "2 active" instead |
| Time grid      | Each column is a focusable `group` with a hint, not a `grid`: an empty grid of cells fails AXE. The arrow keys pick a row, `Enter` creates there, `Escape` lets go. The pick is announced, debounced                            |
| Tiles and rows | `<button>`s in tab order, named by times, title, resource and badge. `resourceLabel` names what the resource is                                                                                                                 |
| Month, year    | `role="grid"` with rows and cells and one roving tab stop. The arrows move a day or a week, `Enter` opens the day, `Shift`+`Enter` creates (month). A cell's name carries its count                                             |
| "+N" list      | Each row is named like a tile. The row draws its resource as a bar only, so the name says whose it is                                                                                                                           |
| Side panel     | A non-modal `<dialog>` named by its heading, with the time scale as a labelled radio group                                                                                                                                      |
| Navigation     | The range label is announced once a step settles, not on every press                                                                                                                                                            |

State is never colour alone. A resource is a swatch and a name, a status is a
badge with text, and a muted event also strikes its time. Swatch bars, dots and
the now line are `aria-hidden`. Every view has a `forced-colors` block.

## Tokens

Structural sizes live in the core scale as `--calendar-*`. The six resource
swatches are brand tokens, `--swatch-1` to `--swatch-6`, with a light and a
dark value each; a tile mixes its swatch into `--surface` at 14% and draws the
swatch at full strength on its edge and its resource dot. Text always wears a
text token.

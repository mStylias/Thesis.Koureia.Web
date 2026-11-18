# @ui/datagrid

A general-purpose data grid. This lib is at
**M5 — grid state, refresh and live data**. Editing, the toolbar system and
export are later milestones.

```html
<lib-datagrid [columns]="columns" [data]="rows" key="id" ariaLabel="Bookings">
  <ng-template libDatagridCell="status" let-cell>
    <span class="badge">{{ cell.displayValue }}</span>
  </ng-template>
</lib-datagrid>
```

The grid **sizes to its container** — give it a height through a flex or grid
parent, never a fixed pixel value on the host.

## The rendered grid (M1)

- **Row virtualization.** Rows are absolutely positioned at `index * rowHeight`
  inside a canvas the height of the whole dataset. A row's offset is written
  once when it enters the window and never again while scrolling.
- **Sticky header and pinned columns** through CSS stickiness in one scroll
  container, so both stay correct under two-axis scrolling and reading order
  survives. Pinned columns are hoisted to the edges of the render order.
- **Cell pipeline.** The formatter fast path is the default: one DOM node per
  cell, no embedded view, with memoized `Intl` formatters. An `ng-template` per
  column replaces it where markup is needed.
- **Replaceable states**: initial-load skeleton, non-blocking bar for later
  loads, "no data" versus "no results for the filter", and an error state with
  retry that never throws into the host. The skeleton is drawn from the first
  frame, the wait for the saved views included, and stays up at least 300ms,
  the rows landing with it. Array data draws none.
- **Accessibility**: `role="grid"` with `aria-rowcount` / `aria-colcount`
  reflecting the whole dataset — `-1` while paging holds part of an unknown
  whole, which is what `aria-rowcount` reserves it for — absolute
  `aria-rowindex`, roving-tabindex cell focus with the arrow / Home / End /
  Ctrl+Home / Ctrl+End / Page keys, and a polite live region for load
  announcements.

## Interaction (M2)

- **Sorting** — click a header to cycle, modifier-click or `Shift+Enter` to add
  a criterion, ordinal badges for the priority. The cycle is configurable and
  the `sort` model is two-way, so a host presets or persists it. Local sorting
  honours a column's `comparator` and `sortValue`; `sort.field` sorts a
  computed column by a different source field remotely.
- **Selection** — `single` / `multiple`, click to select, modifier-click to
  add, shift-click or `Shift+Arrow` for a range, `Space` to toggle, `Ctrl+A`
  for all. A range adds to what was selected when the anchor was set, so a
  second range keeps the first; shift-clicking again from one anchor resizes
  that range and only releases the rows it had added. Ranges never deselect.
  Selection is keyed and survives a reload. `selectAllMode`
  `'allMatching'` stores a **predicate** — the filter plus exclusions — never a
  key list, so it stays correct over a remote source of any size.
- **Paging** — a classic pager over `@ui/paginator`, a "load more" affordance
  when the source reports no total, and an infinite mode that appends pages as
  the viewport nears the end of what is loaded. `pageSizes` puts the sizes at the other end of
  the footer — a button each where the row has the width, a selector where it
  does not — and the pager then keeps to half the row. The pager is never disabled while a load runs: a bar that dimmed on every
  request would flash, since most requests answer faster than the eye reads the
  change.
- **Built-in columns** — an optional selection checkbox column and an absolute
  row number column, both pinned to the start and correct under paging and
  virtualization. `showRowNumbers` is two-way: the column menu toggles it too.
- **Column UX** — drag to resize (`'widen'` or `'adjacent'`) and reorder, a
  header menu (`Alt+Down`, the trigger, or right-click) for sort, pin, group,
  row numbers and hide, `Ctrl+Arrow` to resize and
  `Ctrl+Shift+Arrow` to reorder from the keyboard, plus a separately-exported
  `lib-datagrid-column-chooser`. A reorder drag carries a floating copy of the
  header; dropping anywhere on another column takes that column's place, so
  the drop never depends on which half of the target the pointer reached. The
  chooser also draws as an icon with a tooltip (`iconOnly`), for a toolbar with
  more controls than room — the caption and the count stay in the button's
  accessible name, clipped rather than dropped. It opens a popover by default.
  An application that provides `DATAGRID_COLUMN_CHOOSER_OPTIONS` can open a
  floating panel (`@ui/floating-panel`) instead: docked to the bottom-right
  corner under the toolbar, draggable and resizable, and open while the user
  works with the grid. `presentation` overrides the choice for one chooser.
- **Column visibility** — `hiddenColumns` is the whole of it: a column absent
  from the list is shown. The grid seeds the list from the definitions'
  `visible: false` when they arrive, so a default-hidden column can be shown
  again from the chooser, the header menu, `setColumnVisible` or a restored
  state. A host that later flips `visible` on a definition is followed;
  re-binding the same definitions is not, so a column the user just showed
  stays shown.
- **Permissions** — `ColumnDef.allow` binds the imperative API exactly as it
  binds the pointer and menu flows. `setColumnWidth`, `moveColumn`,
  `setColumnVisible` and `pinColumn` refuse a column that forbids the
  operation, and warn in development. The grid's own columns forbid all of
  them.
- **Toolbar** — a region of three slots filled by `libDatagridToolbar`
  templates. The overflow system lands with the toolbar milestone.

```html
<lib-datagrid
  [columns]="columns"
  [data]="rows"
  key="id"
  [(sort)]="sort"
  selectionMode="multiple"
  [(showRowNumbers)]="numbered"
  pagingMode="pager"
  [pageSize]="25"
  [(hiddenColumns)]="hidden"
>
  <ng-template libDatagridToolbar="end">
    <lib-datagrid-column-chooser [columns]="columns" [(hidden)]="hidden" />
  </ng-template>
</lib-datagrid>
```

## Grouping, aggregation and row detail (M3)

- **Grouping** — one level per criterion on the two-way `group` binding, driven
  from the column menu, from the drag-to-group panel (`groupPanel`), or from
  `GridApi.setGroup`. Group headers show the value, the row count and their
  aggregates; a group collapses to its header alone, so collapsing removes work
  rather than hiding it. `groupDefaultExpanded` sets the policy for a group the
  user has not touched, and `expandAllGroups` / `collapseAllGroups` reach groups
  the grid has not built yet.
- **Remote grouping** — the query carries the group spec, and a source that
  groups server-side returns `QueryResult.groups`. The grid renders that
  hierarchy as returned rather than regrouping. A group's `count` is the whole
  group even when only its first page of rows travelled, which is what makes
  paged group contents work.
- **Aggregation** — `summaries` declares total and per-group aggregates over
  `count` / `sum` / `min` / `max` / `avg` / `custom`. A total renders in the
  sticky grid footer under its column; a group aggregate renders inline in the
  header, in a group footer row, or aligned under its own column, per its
  `placement`. `valueFormat` formats the number, `displayFormat` wraps it with
  `{0}` standing in for the value.
- **Row detail** — declaring a `libDatagridDetail` renderer (or binding
  `[detail]`) is what makes rows expandable, and adds the expander column. The
  content is instantiated on first expansion and destroyed on collapse, so a
  closed detail costs nothing. Expansion is keyed and two-way through
  `[(expandedKeys)]`; `rowExpanding` and `rowCollapsing` are cancellable.
- **Variable row heights.** Group rows, group footers and detail regions differ
  in height from data rows, so the virtualizer resolves offsets from a prefix
  sum built once per body change. Every entry declares its height _before_
  render — nothing is measured, no row carries an observer, and the canvas has
  its true height on the first paint. A body of nothing but data rows keeps the
  arithmetic fast path and materializes no list at all.
- **Semantics.** A grouped or expandable grid becomes a `treegrid`: group rows
  carry `aria-expanded` and `aria-level`, the expander cell carries
  `aria-expanded` and the accessible name, and `aria-rowcount` counts the
  flattened body rather than the source's row total. `Enter`, `Space`, `→` and
  `←` all reach expansion from the keyboard, and an arrow only claims the key in
  the direction that would change something — so `→` on an open row still walks
  to the next cell.

```html
<lib-datagrid
  [columns]="columns"
  [data]="rows"
  key="id"
  groupPanel
  [(group)]="group"
  [summaries]="summaries"
  [(expandedKeys)]="expanded"
>
  <ng-template libDatagridDetail let-detail>
    <app-booking-detail [booking]="detail.row" (close)="detail.collapse()" />
  </ng-template>
</lib-datagrid>
```

## Filtering (M4–M4.5)

Every surface compiles into the **one** `FilterNode` tree, and a host can read
or write it at any time. Each surface is opt-in through the `features` input —
a value, never a directive on the tag, so a wrapper forwards it without linking
what it does not use.

```ts
import { filterBuilder, filterPanel, filterRow, headerFilters } from '@ui/datagrid';

protected readonly features = [filterRow(), headerFilters(), filterPanel(), filterBuilder()];
```

```html
<lib-datagrid
  [columns]="columns"
  [data]="rows"
  key="id"
  [features]="features"
  [baseFilter]="scope"
  [(filter)]="filter"
  [(search)]="search"
>
  <ng-template libDatagridToolbar="start">
    <lib-datagrid-search [(value)]="search" />
  </ng-template>
</lib-datagrid>
```

An application-wide policy takes the other path:
`provideDatagridFeatures(filterPanel())` in an ancestor injector, which a grid
uses when the host binds no `features` of its own.

- **Filter row** (`filterRow({ apply })`) — one editor per column beneath the
  header, typed by `ColumnDef.dataType`: text, number, date picker or a
  yes/no select. The funnel beside it chooses the operator, and on a date
  column the same menu carries the relative periods. `apply: 'auto'` filters as
  the user types, debounced; `'deferred'` waits for `Enter` or for the editor to
  lose focus. A column declares its own operator set, default operator and
  presets through `ColumnDef.filter`.
- **Header filter** (`headerFilters({ pageSize })`) — a popup listing the
  column's value domain with search, tri-state select-all and paging. Resolution
  is a host option list, `GridDataSource.loadDistinct`, the whole array source,
  then the loaded rows. Only the last path is partial, and the panel says so.
  An unchanged request is cached, so reopening the panel does not reload it.
  The distinct request deliberately carries `filter: null`: row filters, header
  filters on this or other columns, the free filter and the base filter never
  narrow another column's option list. They still combine normally in the main
  row query, and a column's row and header slots combine with `and`.
  `ColumnDef.filter.headerFilterOptions` replaces the domain with host entries
  carrying arbitrary `FilterNode`s, so an option can be a named range.
  `groupInterval: { step: 100 }` produces numeric buckets. Date and datetime
  columns render a Year → Month → Day checkbox tree. A source that returns day
  buckets gives exact counts; a datetime source that ignores the requested day
  interval gets a complete calendar generated from unfiltered minimum and
  maximum loads, and the panel states that counts are unavailable.
- **Filter panel** (`filterPanel()`) — a readable summary of everything in
  force, with the three distinct clears of §7.5: one chip, every filter, and the
  whole arrangement. `filterPanel({ position: 'bottom' })` moves it under the
  pager, against the grid's bottom edge; with a toolbar, a group panel and a
  filter row all stacked above the rows there is little grid left otherwise. The
  divider flips to face the rows, so the panel still reads as part of the grid.
- **Filter builder** (`filterBuilder()`) — the full expression editor: nested
  groups, `and` / `or` / `not`, and one value editor per condition typed by the
  field. It edits the free `filter` tree and reports it once, on apply. The way
  in is the filter panel's "Edit filter" action; while nothing filters the grid
  and the panel is therefore absent, the trigger takes a thin bar of its own,
  positioned by `filterBuilder({ position: 'bottom' })`. The editor opens in an
  overlay and is fetched by a dynamic import, so a grid that never opens it
  never downloads the pickers it draws. `DatagridFilterBuilder` is exported on
  its own for a host that would rather place it somewhere else and drive it
  from `getFilter` / `setFilter`.
- **Global search** — `<lib-datagrid-search>` is a separate export for a toolbar
  region, like the column chooser: a grid that offers no search never carries
  the text field.
- **Base filter** — `[baseFilter]` is `and`-combined into every query, never
  appears in the panel, and survives `clearFilters()`. One-way on purpose: a
  scope the user cannot see is not a facet the grid may rewrite.
- **Synchronization** — `filterSync` (default on) mirrors the free `filter` tree
  into the per-column surfaces. A single plain condition on a field shows in
  that column's filter row cell, and editing the cell moves the field out of
  the tree and into the column filter, so the two can never both apply to it.
  Anything one cell cannot hold — a group, a negation, two conditions on one
  field, or a field a column filter already owns — makes the cell **say so**
  rather than look empty, and the panel marks the chip; §7.3 forbids dropping
  it silently. Turn synchronization off to keep a host-set scope out of the
  user's surfaces.
- **Relative dates** — stored as a descriptor, never as a materialized range,
  and re-evaluated against the current instant on every query, reload and state
  restoration. An explicit edit ends the period and a period supersedes the
  editor: the most recent explicit action wins, in both directions.
- **API** — `getFilter` / `setFilter` for the free tree,
  `getColumnFilter` / `setColumnFilter` / `clearColumnFilter` for one column,
  `clearFilters` for all of them, `getSearch` / `setSearch` for the term.
  `getHeaderFilter` / `setHeaderFilter` / `clearHeaderFilter` reach the second
  slot alone.
  Everything round-trips through `GridState`.

### The expression editor owns the free tree, not the whole filter

A column's two slots stay where they are: the filter row's and the header
filter's. The builder writes the free tree, which is the one place an expression
no single column can hold belongs — and with `filterSync` on, a top-level
condition it produces still lands in that column's filter row cell, and editing
the cell takes the field back out of the tree. Anything else in force while the
editor is open is reported inside it, because a surface that is not the whole
filter must say so.

A condition whose editor collected nothing is not applied, and not dropped
quietly either: the row carries a warning with its own text and the editor
counts them under the tree. Two things read back differently from what was
typed, both truthfully: a `date` column's "equals" is stored as the range
covering that day, so it reopens as "between"; and `in` / `notIn` take one
comma-separated field, since a row of controls has no room for a list editor.

### Why it is an overlay, and why its choosers are menus

Two container rules, both learned from the browser rather than reasoned about.
A modal `<dialog>` draws in the **top layer**, above every overlay there is, so
a date picker or a chooser opened from inside one is painted behind it — the
editor is a popover instead, and everything it opens is a sibling overlay that
stacks normally. And `lib-select` draws its list **inline**, so a panel that can
scroll clips the list and the list grows the panel; every chooser here is a
button over one shared menu, which takes no space at all and shrinks to its
track. The condition row is a CSS grid of `minmax(0, 1fr)` tracks for the same
reason: a control that cannot go below its own width overflows the row.

### A date editor collects a day, not an instant

A `date` or `datetime` column widens what the picker gives it to the wall-clock
day: "equals 5 January" becomes the whole of that day, `ge` takes its opening
midnight and `gt` its last millisecond. Without that, a `datetime` column would
match only the rows stored at exactly midnight. `ne` is deliberately absent from
the date operator set — "not on this day" would have to negate a range, which
one condition cannot say.

### The filter row's editors are a facet of their own

The node in the query store is derived from what the editor holds, not the other
way round. Re-deriving the editor from the node would flip the operator chooser
from "equals" to "between" the moment a day was picked, because that is the node
equality produces. A cell falls back to reading the node whenever the two
disagree — which is exactly when some other surface wrote it.

### It is a row of the grid

The filter row is its own `rowgroup` with `aria-rowindex="2"`, so the body
indexes from 3 and `aria-rowcount` includes it. Its cells are not focusable and
its editors are ordinary tab stops, which is the inverse of the header: a header
cell is focusable and holds no interactive control, a filter cell holds controls
and is not focusable. The header's funnel follows the header's rule — pointer
only, `aria-hidden`, with `Alt+Down` → "Filter this column…" as its keyboard
twin.

### A header filter can read its own source

`filter.headerFilterSource` lists a source of the column's choosing instead of the
grid's rows: a shop's customers, its barbers. The popup sends its search text to
the source as typed and pages it behind "show more". A checked entry filters
`field in (values)`, where `field` is the source's (`customerId`), not the
column's (`customerDisplayName`): a name repeats, an id does not.

- **No "Select all", and no local narrowing.** A paged source cannot tick "all",
  so removing the column's filter is how a reader sees everyone. The source
  matches fields the label does not show (a phone) and folds case and accents,
  so the popup does not narrow its answer again by label.
- **A restored filter is listed first, checked.** The first page of an opening
  resolves the values the column filters by and the page does not hold, through
  `byKeys`. That is why `value` must be the source's key.
- `value` and `label` are methods, so a `HeaderFilterSource<Customer>` sits in a
  column that declares `HeaderFilterSource<unknown>`.

### A column says which filter it takes

`allow.rowFiltering: false` withholds the filter-row cell and
`allow.headerFiltering: false` the funnel. `allow.filtering: false` withholds
both, as before.

### A column can start filtered

`filter.initial: { relative }` is written once, with the initial sort, before the
first query. It shows in the filter row like a filter the reader set, and Reset
writes it again. A stored view replaces it like any other arrangement.

The day-aligned periods (`on`, `from`, `before`) count from the start of today in
`config.locale.timezone`, moved by `amount` units: `{ from, 0, day }` is "today
onward", with no end. `last` and `next` keep counting from now.

`config.locale.timezone` is also the zone every date renders in: cells, cards,
the filter summaries and the export. It was declared and read nowhere before. A
day picked in the filter row's date editor is still the browser's day.

`config.locale.language` is the language numbers, currencies and dates are
formatted in, on the same surfaces. Without it they follow the browser's
language, so a Greek page in an English browser printed `€24.00`.

A renderer cell that draws a flex row (tags, the boolean glyph) takes the row's
height inside a table cell (`:host-context(.dg-cell)`), so `align-items` centres
it vertically. The cell centres plain text with a `line-height`, which a flex box
of its content's height does not take.

## Saved state, configuration and live data (M5)

### The arrangement is one value

`getState()` / `setState()` are lossless over everything the user can arrange —
column order, width, visibility and pinning, sort, grouping, both filter slots,
relative periods, the free filter tree, search and page size. The object is
JSON-serializable, carries a `version`, and takes a documented upgrade hook
(`stateMigration`) so a persisted state from an earlier release is migrated
rather than discarded. Applying a state issues **exactly one** data query
however many facets it changed.

`[(state)]` is two-way and **subsumes the per-facet models**, so a wrapper
forwards one binding instead of a dozen. The per-facet models stay for direct
consumers, and whichever side writes, the other follows.

Where the user _was_ — page index, scroll offsets, selection, expansion, focus —
is excluded by default and opt-in through `getState({ volatile: true })`, which
puts it under `GridState.volatile`. `isDirty(reference)` ignores that half:
scrolling is not an unsaved change, and a view that reported itself dirty for it
would ask to be saved forever.

`stateChanged` is debounced and says where the change came from — `'user'` for
an interaction, `'programmatic'` for a `setState`, a `[state]` write or a
restored arrangement. A resize drag writes a width per frame and reports once.

### Persistence is an adapter

```ts
providers: [provideDatagridStatePersistence(localStorageStatePersistence())];
```

```html
<lib-datagrid stateKey="bookings" … />
```

The default is that nothing is saved. An adapter is `load(id)` / `save(id, state)`
plus an optional `clear(id)`, and either method may answer asynchronously. First
render never waits for it — but the **first query does**, so no request goes out
with a projection or a filter the saved state is about to replace. A store that
refuses (private mode, a full quota, an offline endpoint) loses the arrangement
and nothing else.

### One config object, three layers

```ts
export const BOOKINGS_GRID: GridConfig<Booking> = { key: 'id', columns, data };
```

`[config]` takes the whole configuration, and per key the narrower layer wins:
an explicit binding on the tag, then the config object, then
`provideDatagridDefaults()` from an ancestor injector. All three cross any
number of wrapper layers.

"Explicit" means _bound_, not _different from the default_: the grid records
which inputs Angular has written through `ngOnChanges` — which fires for signal
inputs too — because `density="standard"` and no binding at all are otherwise
indistinguishable.

§3.2 holds: a **fresh config object with equal contents is a no-op**. It resets
no column width, no scroll offset and no selection, and that has a regression
test rather than a promise.

### The capability mask

```html
<lib-datagrid [config]="config" />
<lib-datagrid [config]="config" readOnly [capabilities]="{ sorting: true, paging: true }" />
```

A capability answers "may the user do this here", separately from a column's
`allow` ("does this column permit it") and from whether a feature is loaded. The
two combine **by conjunction** — neither overrides the other — and a withheld
capability is refused on every path: the affordance is gone rather than
disabled, the keyboard binding refuses, and the `GridApi` refuses. Hiding a
resize handle while `Ctrl+Arrow` still resizes is the defect §3.3 exists to
forbid, so every capability case is tested through all three.

`readOnly` withholds everything in one binding and individual keys re-grant
selectively, which is how the same columns and the same config serve a read-only
presentation and an interactive one. `stateChange` gates the user's
rearrangement and the persistence write — never `setState`, because applying a
saved arrangement one-way is exactly what a read-only view is for.

### Refresh and live data

`reload()` is §12's refresh: it re-evaluates relative date filters, emits
`refreshRequested` so a host that owns its data can respond, and preserves
scroll, selection, expansion and focus — all four are keyed, and a row that
comes back unchanged is not torn down.

`applyTransaction({ insert, update, remove })` applies keyed row changes with no
query. Only the rows it names lose their cached view model, so the re-render is
proportional to the change and the change flash marks exactly what moved. Host
rows are never mutated, and an insert whose key is already loaded updates that
row in place rather than producing two rows under one key.

Auto-refresh is `[(autoRefresh)]` plus `[autoRefreshInterval]`, with
`[autoRefreshIntervals]` offering a chooser. The indicator carries its state in
text as well as in colour and does not spin — an infinite loop draws the eye
away from the rows it exists to keep current. It suspends itself while an
overlay is open, while a filter edit is waiting, while a load is running, and in
a background tab.

### Named views

`gridViews({ key })` turns on a strip of saved arrangements, drawn in the
toolbar's start region. The feature descriptor is the whole of the opt-in — the
strip places itself, and naming `views` as a toolbar item only moves it.

```ts
protected readonly features = [gridViews({ key: 'bookings_main_grid' })];
```

```ts
// Where documents live. `@features/saved-views` stores them in a user
// resource; any other store implements `SavedViewsStorage`'s two methods.
providers: [provideUserResourceSavedViews()];
```

A view is a name plus a `GridState`, so it holds everything §14.1 holds and
nothing else — the page index is volatile and stays out. **The first view is the
default**, which makes "set as default" a move to the front and makes ordering a
property of the list rather than a second thing to store. Every view of one grid
travels as **one document**, order included, so a create, a rename and a reorder
are each a single write.

The document is read **before the first data query goes out**: the content of a
grid is a consequence of its view, and a query issued first would be answered
against a projection and a filter the view is about to replace. That costs no
new machinery — the strip supplies the grid's `GridStatePersistence`, which
§14.2 already defers the first query for. Its `save` is inert and it has no
`clear`: a view is saved when the user presses save, never as a side effect of
moving a column, and resetting the arrangement cannot destroy the saved views.

Views also **take the arrangement over**. With them on, `statePersistence` and
`stateKey` are bypassed, so one arrangement can never be saved in two places and
disagree on the next load. `resetArrangement` still means the columns' declared
defaults, which leaves the selected view dirty with revert as the way back.

Dirty is `gridStatesEqual` against the selected view, so only the selected view
can be dirty and scrolling is not an unsaved change. The tab takes an asterisk —
with the fact carried as text through `aria-describedby`, never as the glyph
alone — and save and revert appear **inside that tab**, in place of its ×: the
view they would save is the one the user is looking at, and a pair parked at the
end of the strip says so only by implication. Withdrawing the × while they are
there also keeps delete from sitting one press away from save. Switching view
drops unsaved changes silently; those two buttons are the whole of the ceremony.

The `+` sits after the tabs, and after the "no views created yet" message when
there are none — the control that adds to a list belongs at the end of it.

A strip with more tabs than room gets **prev/next arrows**, the pair `@ui/tabs`
uses and for the same reasons: a toolbar row cannot spare the height a
horizontal scrollbar takes, and the pair is pointer-only — `aria-hidden`,
unfocusable, labelled by `title` — because the keyboard walks the strip with the
arrow keys and focusing a tab brings it into view unasked. Each press moves four
fifths of what is on screen, so a few tabs already read stay as anchors. The bar
is hidden, not the scrolling: a wheel or a trackpad still works. The two are
drawn together and dimmed at their own end rather than removed, so reaching one
end does not resize the strip under the pointer.

The first tab carries a star, because being default is a _position_ and a
position stops being visible the moment the strip scrolls; the fact travels to
assistive technology as a description rather than as part of the tab's name, so
it is not re-announced mid-interaction. Setting a view as default plays the
same FLIP a drag does: it is the longest travel this control has, and popping a
tab to the front leaves the reader to work out what moved.

A name is capped at `VIEW_NAME_MAX_LENGTH`, and the tab clips what it draws —
past a certain width a name is being read rather than recognised. Nothing is
lost: the full name stays in the tooltip and in the accessible name. The cap is
a product decision, not a backend one; the name lives inside the resource's
`value`, which the backend never reads.

Saving the editor stores the name **and** the arrangement on screen, which is
what makes one press settle both. Renaming a view that is _not_ selected writes
the name alone: the arrangement on screen belongs to a different view, and
copying it in would destroy this one.

The strip is a `tablist` of `tab`s with a **roving tabindex and manual
activation** — arrows move focus, `Enter` and `Space` select. `@ui/tabs`
activates on focus, and that is wrong here for one reason: a view switch applies
a state and issues a query, so walking the strip would fire a request per
keypress. `Ctrl` with an arrow reorders, `F2` renames, `Shift`+`F10` opens the
per-view menu. The × on a tab is `aria-hidden` and unfocusable, like `@ui/tabs`'
close affordance and for the same reason; the keyboard reaches delete through
the menu, and either path confirms first.

**The dragged tab is the ghost.** It leaves the flow visually — lifted with a
shadow and translated straight to the element, per pointer frame, so no signal
is written and no change detection runs — while the tabs it displaces FLIP into
their new places over `--dur-fast`. A second painted copy would be the thing the
user is already holding, drawn twice, and the strip is an `overflow-x` scroller
that would clip one. The release plays the tab home from wherever the pointer
left it.

A swap is issued at most once per render: the list signal changes immediately
but the DOM catches up a render later, so the drag records the dragged tab's
`offsetLeft` and refuses to decide again until that number stops describing it.
Without that guard a tab dragged past its neighbour and back again swaps to the
old places and straight back, which reads as a drag that will not return home
until it is released.

The drop target is decided by the dragged tab's **edges**, never its centre:
clamped inside the strip, a tab wider than the last one can never move its own
centre past that tab's centre, so the widest view could not be dropped last.
Covering half the neighbour is the rule instead, and only the neighbour in the
direction of travel is tested.

The strip itself is `@ui/saved-views`, shared with every other screen that
saves presets; the grid supplies a `GridState` guard and `gridStatesEqual` and
keeps the two seams below. It is reached by a dynamic `import()`, so a grid that
never turns views on downloads neither it nor the confirmation dialog it opens.

#### The narrow form

A little before the bar starts collapsing items into its overflow menu, the
strip becomes a **selectbox** whose first row adds a view. The trigger is what
the bar has left, not a breakpoint: overflow here is a width fact, and how much
width is left depends on how many items the host declared rather than on how
wide the window is. `DatagridToolbar` publishes that number through
`DATAGRID_TOOLBAR_HEADROOM`, re-provided as the strip's `SAVED_VIEWS_HEADROOM`,
and the strip reads it.

The strip's own width is **not** part of the sum — `ToolbarEntry.elastic` marks
it out of it. Counting an entry that shrinks when the bar runs short would make
the sum depend on its own answer: shrinking frees the width that said it had to
shrink, and the two swap back and forth every frame. The overflow trigger's
width comes off the sum whether or not one is drawn, which is what puts the
change _before_ the first item collapses rather than with it.

**The toolbar's buttons come first.** The views entry is `overflow: 'never'`, so
it is drawn whatever the budget — which, left at its natural width, means each
view added pushes another button into the overflow menu. It is instead held to
exactly the headroom, in both forms, and scrolls inside that ceiling. The
arithmetic is then closed: `rigid + views ≤ available − trigger`, so no `auto`
entry is ever collapsed on views' account. The ceiling cannot feed back on
itself for the same reason the headroom is safe to read at all — the strip's own
width is not in the sum that produces it.

Yielding stops at the width where the field would no longer say which view is on
screen. A bar whose buttons alone overrun it reports no headroom, and a cap
taken literally there leaves a control that has stopped working; the floor hands
that case back to the bar instead, where `used` exceeds the budget and `auto`
entries collapse into the overflow surface — a press away, rather than gone.

In that form the field carries the same star and asterisk the tabs do, and both
clip: a listbox as wide as its longest name is the failure the tab's own clip
prevents, moved one surface across. The unsaved pair stays outside the field —
it is the one urgent thing, and the mark alone says a save is waiting without
saying what to do about it. Everything else moves behind a `⋮` **drawn inside
the field, before the chevron, but a sibling of it in the DOM**: `role="combobox"`
admits no interactive children, the same rule that made the multi-select's chip
×s `aria-hidden` glyphs. Keeping it a real button is what leaves duplicate,
rename and delete on the keyboard. Its menu opens with **create**, because the
listbox's first row is otherwise the only way in.

The name editor is a dialog rather than the inline frame, for the reason the
form exists: an input and two buttons in the field's place is the shape that ran
out of room. `showModal` focuses the close button, so the field is focused
explicitly on open.

Reordering waits for the width to come back — a listbox has no equivalent of a
drag. **Set as default** still moves a view to the front, which is the only
ordering fact that carries meaning.

### A temporary view

`gridViews({ key, temporary })` names a view the host makes for one visit, such
as "this customer's appointments". Its `state` is built from the arrangement the
grid holds when it opens. On a first load it is read inside the load the first
query waits for, so the grid queries once, in that view, and a stored default is
never applied on the way. `temporary` can answer a promise, as when the view's
name needs a lookup: it is awaited beside the stored views, not ahead of them. `api.openTemporaryView(view)` opens one on a live grid:
one apply, one query.

It is never stored and never the default. `@ui/saved-views` holds it apart from
the stored list, so no list operation can move it to the front. `onLeave` runs
once when it stops being the view on screen, so a host can drop the address that
opened it. With no stored view to fall back to, closing it resets the grid.

## Toolbar, presets and the column model (M7)

### The toolbar is one list

`[toolbar]` takes a `ToolbarConfig` whose `items` mixes built-in names with host
items and renderers, and the bar places each of them by region.

```ts
protected readonly toolbar: ToolbarConfig = {
  items: [
    'search',
    { id: 'new', label: 'Νέα κράτηση', variant: 'primary', onClick: () => this.create() },
    { id: 'more', label: 'Ενέργειες', items: [{ id: 'print', label: 'Εκτύπωση' }] },
    'clearSelection',
    'columnChooser',
    'refresh',
  ],
};
```

Built-in names: `columnChooser`, `refresh`, `autoRefresh`, `clearSelection`,
`resetArrangement`, `search`, `filterToggle`, `groupPanel`, `sortMenu`,
`viewSwitch`, `filterBuilder`.

A built-in item may carry a `shortLabel` for the overflow surface, where a row
is read beside its neighbours rather than alone in a bar; a host item declares
one with `shortLabel`.

`filterBuilder` puts the expression editor's trigger in the bar. The editor
otherwise carries it in a row of its own whenever the filter panel is hidden,
so naming the item makes the grid drop that row — one trigger, not two. `export` is named
and resolves to nothing until M8, and says so once in development.

A host item with `items` alone is a menu; `items` **and** `onClick` is a split
button. `visible` gates it — the grid defines no authorization model, so the
predicate is the host's.

**The bar knows nothing of grid actions.** A built-in name is turned into a
label, an icon and a command before the bar sees it, so every entry it draws has
one shape whatever produced it. Built-in labels travel as message keys rather
than as text: the bar is built on first paint, and `translate` answers with the
key until the lazy scope arrives.

**Overflow is measured, and the collapsed surface is a panel.** What does not
fit collapses, last `auto` item in draw order first; `overflow: 'never'` keeps
an item inline whatever the budget, `'always'` starts it collapsed. The panel is
`role="group"`, not `role="menu"`, because §13 requires a custom renderer to
stay fully interactive once collapsed and a menu admits menu items alone.

### Slots as values

`[templates]` is the value path for every renderer slot, so a wrapper forwards
one object instead of a dozen templates:

```ts
protected readonly templates: GridTemplates = {
  cell: { status: StatusCell },
  empty: NoBookings,
  detail: BookingDetail,
};
```

Resolution order everywhere is **directive → `templates` → definition**: a
directive is written on this grid, while the map and the `ColumnDef` may come
from shared configuration.

### Column presets

Factory functions returning a `ColumnDef`, so a host varies one property by
spread and the renderer needs no host view:

```ts
const columns: ColumnDef<Booking>[] = [
  textColumn({ id: 'code', field: 'code' }),
  currencyColumn({ id: 'price', field: 'price' }, { precision: 0 }),
  datetimeColumn({ id: 'starts', field: 'starts' }),
  booleanColumn({ id: 'paid', field: 'paid' }, { display: 'check' }),
  tagColumn({ id: 'status', field: 'status' }, { tone: { confirmed: 'success' } }),
  linkColumn({ id: 'customer', field: 'customer' }, { href: (row) => `/customers/${row.id}` }),
  actionsColumn({ id: 'actions' }, { maxInline: 2, actions: [/* … */] }),
];
```

Action overflow is **declared** (`maxInline`), not measured: §22 forbids a
per-row observer, and this library declares heights rather than measuring them.

`ColumnDef.field` stays `string`. A dot-path type was cut in favour of a
development check that each declared field resolves on the first loaded row,
reported once per column — it catches the same mistake and costs nothing in
inference.

### Lookups

```ts
{ id: 'branch', field: 'branchId', lookup: { source: branches, value: 'id', display: 'name' } }
```

A static collection or a data source of its own. Loaded once per column and kept
for the life of the grid — a reference collection re-fetched because a row
scrolled into view is the request-per-row §5.3 forbids. The display path and the
header-filter option list read the same resolved collection; a value the lookup
does not cover falls back to the raw value rather than rendering empty.

### Column groups

A column that declares `columns` is a **band**: a caption spanning its children
in a header row of its own. Bands nest.

```ts
const columns: ColumnDef<Booking>[] = [
  { id: 'code', field: 'code' },
  {
    id: 'customer',
    caption: 'Πελάτης',
    columns: [
      { id: 'name', field: 'customer.name' },
      { id: 'phone', field: 'customer.phone' },
    ],
  },
];
```

**Nothing below the header knows bands exist.** The declarations are flattened
once; the query, the layout, the body and the persisted arrangement all see a
flat list of columns. Spans are derived from the columns as they are actually
drawn, so hiding, reordering and pinning change them without being told.

**A band's columns stay next to each other**, or its caption would span a gap.
Every order the store writes goes through that rule, which is what an
arrangement saved before the band existed needs. In the header it shows as
confinement: a column reorders among its own siblings, dragging the band's cell
moves all of its columns, and pinning any of them pins the whole band.

The header is a two-dimensional grid of cells. `ArrowUp` walks from a column to
the band that names it and `ArrowDown` comes back; `Ctrl+Shift+Arrow` moves
whichever is focused. A column with fewer bands above it than the deepest one
reaches up through the rows they would occupy, and declares that as
`aria-rowspan`; a band declares `aria-colspan`.

### The primary column

```ts
{ id: 'code', field: 'code', primary: true }
{ id: 'code', field: 'code', primary: { href: (row) => `/bookings/${row.id}` } }
```

§5.1 states the primary column's behaviour rather than leaving it to the host,
so the grid writes it on: pinned (to the start unless the column declares
`pinned: 'end'`), never hidden, never reordered. Its value renders as a real
control — a `<button>`, or an `<a>` when a `href` is supplied, which is what
middle-click and "copy link address" need.

Activating it emits **`primaryCellActivated` and nothing else**: not
`rowActivated`, and it does not select the row. `Enter` over the cell activates
in one press rather than stepping into the control first — the identifier must
not be further from the keyboard than any other cell. At most one column may be
primary; a second is reported and left ordinary.

## The card view

A table of eight columns has no honest form on a phone: horizontal scroll hides
the columns that decide whether a row is the one the reader wants, and a column
set trimmed per breakpoint hides them for good. `view` draws the same grid as
one card per row instead.

```html
<lib-datagrid [columns]="columns" [data]="rows" key="id" view="auto" cardsBelow="md" />
```

`'auto'` follows the viewport; `'table'` and `'cards'` pin it. The server and
the first client frame always render the table, and `'auto'` flips after the
first render — which is what keeps the hydrated DOM identical to the rendered
one.

### Nothing is declared twice

The cards read the same `ColumnDef` array, the same `hiddenColumns`, the same
`cell` renderers, formatters and lookups. A renderer written for a column draws
unchanged on a card, because a card field carries the same `CellContext` a cell
does.

| Column                    | Card                                          |
| ------------------------- | --------------------------------------------- |
| `primary: true`           | Title, and the activation control             |
| `actionsColumn(…)`        | Footer actions strip                          |
| Selection column          | Checkbox in the card header                   |
| Row number, detail toggle | Dropped — a card is not a table row           |
| Everything else           | A labelled field row, in visible-column order |

`ColumnDef.card` refines one column without repeating it:

```ts
{ id: 'customer', field: 'customer', caption: 'Πελάτης', card: { role: 'subtitle' } }
{ id: 'internalId', field: 'internalId', card: { role: 'none' } }   // table only
{ id: 'notes', field: 'notes', card: { wide: true } }
```

The bar itself goes icon-only in the card view, whatever `toolbar.iconOnly` or
an individual item says — it is as narrow as the screen that asked for cards.
Nothing is lost: an entry that collapses into the overflow surface always draws
its caption there, in either presentation.

Fields stack their caption over their value and sit two abreast, so a long
value wraps inside its own half of the card rather than widening it.
`card: { wide: true }` gives one field the full card.

`[cards]` takes `{ minWidth, showLabels, renderer }`. The flow fits as many
cards of at least `minWidth` as the grid is wide, so the column count follows
the container rather than the viewport. A whole-card renderer is also a
`<ng-template libDatagridCard let-card>` or `templates.card`.

### What changes with the presentation

Kept: the toolbar, search, filter panel and builder, group panel, paging,
export, refresh, every replaceable state, selection, row detail, `decorateRow`
and every event.

Gone: the header, the filter row, the footer row, column resize, reorder,
pinning and striping. None of them means anything without column tracks. The
load bar the header carries moves to the top edge of the list, which is the same
boundary — the one the new records arrive below.

Moved: filtering keeps the filter panel and the expression editor, and the
`filterBuilder` toolbar item puts the editor's trigger in the bar rather than
in a row of its own — which is worth a phone's whole width. Sorting becomes the
`sortMenu` toolbar item — one key at a time, and
pressing the column in force advances it through ascending, descending and
unsorted. The item is drawn **only** in the card view: the table sorts from its
header, and a second control for it in the bar would say the same thing twice. Per-column filtering stays reachable through the filter panel and the
builder, which write the same tree the header filter does. Totals become a
strip under the list. A group becomes a sticky heading over its cards.

`viewSwitch` is a toolbar item the host names when it wants a manual toggle. A
manual choice is never persisted in `GridState`: a saved arrangement must not
carry a phone-shaped layout onto a desktop.

### It is a list, not a grid

`role="list"` with `role="listitem"` cards, and no table ARIA at all —
`aria-colindex` over a card describes a table that is not there, to the only
users who read it. Fields are `<dt>`/`<dd>` pairs. A grouped list gives up the
list role, because a heading is not a list item.

Focus is per card: `Up`/`Down` walk the cards, `Enter` activates the record,
`Space` selects, `F2` enters the card's own controls and `Escape` leaves them.
A press activates on the **first** click rather than the second — a touch
screen has no double click, and the card is the large target a phone offers.
With a primary column, a press or `Enter` anywhere on the card emits
`primaryCellActivated`, as the title does. Without one it emits `rowActivated`.

### It pages by scrolling

`pagingMode="pager"` resolves to `infinite` in the card view: the pager and the
page-size control are gone, and the next page arrives as the reader reaches the
end of the list. A pager under a list of cards spends a row of the content on
two controls, and the screen that draws cards is the one with no row to spare —
it also sits below the fold of a list the reader is already scrolling, so the
way to the next page is the gesture they are already making. The grid decides
this over the host's own `pagingMode`, the way the toolbar imposes icon-only:
it is about the space the presentation has, which the host cannot know.

`pagingMode="none"` is left alone — a host that asked for the whole list gets
it — and a grid in that mode over a large dataset warns in development when it
resolves to cards.

A change of paging mode goes back to the first page, in either direction.
Arriving in the card view on page three would otherwise accumulate from row 51
with the first fifty unreachable, and going back would leave three pages
stitched under one pager. The first resolution is not a change, so a restored
arrangement keeps the page it saved.

### It is not virtualized, deliberately

Cards wrap into a flow whose column count follows the container, so an offset
computed from `index * height` does not locate a card — and this library
declares heights rather than measuring them, which a card of stacked fields
cannot honestly do. The card list draws the loaded page, which is what paging
already bounds.

In `infinite` mode a sentinel at the end of the scroll viewport starts the next
page while the reader is still a screen away from the end — in both
presentations. The table has a second trigger, its virtualized window coming
within an overscan of the loaded rows; the card list has no window to speak of,
so the sentinel is the whole of it. The load-more button stays wherever a source
reports no total: an affordance reachable only by scrolling is no affordance for
a keyboard user.

## Export, clipboard and print (M8)

### One model, four destinations

The grid produces a **normalized table model** and an adapter turns it into a
file. Nothing in the model knows about CSV, spreadsheets, the clipboard or
paper, which is what lets one model serve all four and lets a host register a
format the library never shipped.

```ts
interface ExportTable {
  format: string;
  fileName: string; // no extension; the adapter appends its own
  sheetName: string;
  columns: ExportColumn[];
  rows: ExportRow[]; // band · header · data · group · groupFooter · summary · custom
}
```

Every field is writable, because `beforeExport` hands this object to the host
and §15 asks for title rows, styled headers and renamed files to be possible
from there.

The model honours what the grid is showing: the visible columns in their
current order, the current sort, filter and grouping with its aggregates, and
the current formatting. A cell carries **both** the underlying value and the
text the grid drew, so a spreadsheet writes a number as a number while a CSV
writes exactly what was on screen. Columns declaring `allow.exporting: false`
are absent from all four destinations.

**Cells lie left to right and each consumes `colSpan` columns.** One rule, so a
banded header and a group row are laid out the same way whether the writer
merges cells (the spreadsheet) or pads them with empty fields (the text
formats). A model row is therefore always the width of the table.

### What ships, and what a provider adds

| Format        | Reached by                                           |
| ------------- | ---------------------------------------------------- |
| `csv`         | always — the library's default                       |
| `tsv`         | always; also what `Ctrl/Cmd+C` puts on the clipboard |
| `xlsx`        | `provideDatagridExcel()`                             |
| `pdf`         | `provideDatagridPdf()`                               |
| anything else | `provideDatagridExport(adapter)`                     |

The spreadsheet writer is **written here rather than taken from a package**: one
sheet with typed cells, number formats, merges, column widths and a frozen
header is a small fraction of what a spreadsheet library carries. It is reached
only through `import()`, so an application that never calls
`provideDatagridExcel()` never downloads it — and neither the model builder nor
the text writers are in the shell's bundle either. The whole of `core/export/`
loads on the first export.

A registration replaces a built-in of the same name, so switching to
semicolon-separated CSV needs no new format name.

### The PDF draws what the grid drew

`pdf` writes every row of the current query (filter, sort, grouping, totals),
never the loaded page, and never the pager. Columns keep their order and their
share of the width. The header repeats on every page, and text wraps rather than
truncates, so a narrow column loses no value.

A preset's visual reaches the page too, through `ColumnDef.exportVisual`:
`tagColumn` draws pills in their tones, `booleanColumn({ display: 'check' })` a
check or a dash, and `linkColumn` an underlined link that opens. A host renderer
keeps its look the same way:

```ts
{ id: 'vip', field: 'vip', cell: VipBadge,
  exportVisual: (row, value) => (value ? { kind: 'tags', tags: [{ label: 'VIP', tone: 'accent' }] } : null) }
```

The colours are the light theme's, read off the page when the export runs. The
text needs TrueType files, because a PDF cannot embed WOFF2 and the standard
font has no Greek. An application registers them once:

```ts
{ provide: DATAGRID_PDF_OPTIONS,
  useFactory: () => ({ fonts: { regular: '/fonts/sans.ttf', bold: '/fonts/sans-bold.ttf' }, subtitle: name }) }
```

jsPDF, the writer and the fonts load on the first PDF export only.

### Where the file goes

```ts
providers: [provideDatagridFileSaver((blob, fileName) => upload(blob, fileName))];
```

Without a saver the grid triggers a browser download. Replacing it is how a host
uploads instead, and how a server-rendered build and a test keep the grid away
from the DOM — every export test in this library replaces it, which is why none
of them touch a download.

### Exports are never what is rendered

Virtualization means the mounted rows are a window, and remote paging means the
loaded rows are one page. `scope: 'all'` therefore **pages through the current
query** — with its own `skip`/`take`, past the pager, without disturbing what is
on screen (`DataStore.fetch` runs the pipeline and writes no signal). Progress
is reported per page and the run is abortable between pages.

The paged query drops `group` and `aggregates`: a grouped query answers with a
hierarchy the pager cannot walk. The export re-groups the fetched rows and
computes the totals itself, so the aggregates in the file cover **the file**
rather than the page it came from.

`maxRows` (default 100 000) is a hard stop. A source that keeps answering with
full pages would otherwise page until the browser runs out of memory, and an
incomplete file the grid reports is the better failure.

`scope: 'selected'` takes the selected rows; an `allMatching` selection is
re-fetched under the filter it was taken with, not the one in force now — the
user selected a result set and may since have narrowed the view.

### Progress lives in the grid, not only in an event

A determinate bar with the counts as text and a **Cancel button**, against the
grid's bottom edge like the auto-refresh strip. `exportProgress` fires too, so a
host can draw its own — but cancellation needs a real focusable control, and an
event gives a keyboard user nothing to press. The strip sits behind
`@defer (when exportState() !== null)`, so a grid that never exports never loads
it.

### `beforeExport` is synchronous, and it is the only hook

```ts
if (event.name === 'beforeExport') {
  event.payload.fileName = `bookings-${today()}`; // renames the file
  event.payload.model.rows.unshift(titleRow(columnCount)); // inserts a row
  event.payload.canceled = shouldNotLeave(event.payload.model); // vetoes it
}
```

Per §20 the veto is read the moment the emission returns, so a handler mutates
the payload in place. Both halves travel on the aggregate `gridEvent` stream and
the veto survives a wrapper re-emitting it.

**No new outputs were added.** `beforeExport`, `exportProgress`, `exported`,
`exportCanceled` and `exportFailed` reach a host through `gridEvent`, which is
the standing rule from M5 onwards: a new capability arrives inside `config`,
`features`, `templates`, `capabilities` or `gridEvent`, and a new discrete
binding needs a reason beyond convenience.

### Clipboard

`Ctrl/Cmd+C` copies the **selected rows** as tab-separated text with a header
line, and the focused row when nothing is selected. The shortcut is claimed only
when the grid has rows to give; otherwise it goes to the browser, which would
have copied the user's own text selection.

`navigator.clipboard.writeText` rather than a `copy` event: the model is built
behind a dynamic import, and a synchronous clipboard event cannot wait for one.
The transient activation a keypress grants outlives a module load by seconds, so
the write still counts as user-initiated.

### Print

`api.print()` renders the export model into an offscreen frame and prints that.
Printing the page itself would print the virtualized window — a few rows of a
dataset. A frame rather than `window.open`, because a popup blocker refuses a
`window.open` that is one `await` away from the click that started it.

The print document carries structure only — borders, weights, alignment, a
repeating `thead` and `break-inside: avoid` — and no colour. It is its own
document, so it could not read the theme tokens even if it wanted to.

### Configuration

```ts
export: {
  fileName: 'κρατήσεις',
  sheetName: 'Κρατήσεις',
  formats: ['csv', 'xlsx'],  // the toolbar item is a button for one, a menu for more
  scope: 'all',              // 'page' | 'selected'
  pageSize: 1000,
  maxRows: 100_000,
  bands: true, groups: true, summaries: true,
}
```

The `exporting` capability and `enabled: false` both **withhold the toolbar item
outright** rather than drawing it disabled, and both refuse `api.export()` — §3.3
asks for the affordance to be absent, not inert.

## The consumer seam (M2.5)

An application that uses this grid everywhere builds **one wrapper** and
configures it per screen. Everything crossing that boundary is a value on an
input; nothing crossing it is projected content.

**Content projection does not survive a wrapper.** A component that renders
`<lib-datagrid><ng-content /></lib-datagrid>` forwards **zero** renderers: an
Angular content query matches by declaration site, so an `ng-template` written
inside `<app-grid>` belongs to the app's view however many projection hops it
takes. `{ descendants: true }` changes nothing — measured both ways. It fails
with no error and no warning, just an empty cell.

### `columns`, `data` and `key` are optional

None of the three is `input.required`. A host computing them asynchronously
binds them when they arrive; until both `columns` and `key` are present the
grid renders the **neutral shell** — the viewport, no rows, and none of the
empty / no-results / error states, because a grid still waiting for its
configuration has nothing to report. Filling them in does not remount.

### Renderers as values

`ColumnDef.cell` and `ColumnDef.header` take a `RendererRef`, which is a
`TemplateRef` **or a component type**. A component type is the branch that
crosses a wrapper: it is a symbol another module imports.

```ts
@Component({ selector: 'app-status-cell', template: '{{ context().displayValue }}' })
export class StatusCell {
  readonly context = input.required<CellContext<Booking>>();
}

const columns: ColumnDef<Booking>[] = [{ id: 'status', field: 'status', cell: StatusCell }];
```

Resolution order, for both cell and header: a `libDatagridCell` /
`libDatagridHeader` directive wins over the `ColumnDef` reference, because a
directive is written on this grid while the reference may come from shared
configuration. The directives are sugar over the same resolution point, never
a second mechanism.

### One API object, not fifty methods

```ts
private readonly grid = viewChild.required(Datagrid);
readonly api = computed(() => this.grid().api());   // the whole of what a wrapper owes
```

`api` is a `Signal<GridApi<TRow>>`. For a host that cannot reach the instance
through a template reference — a grid inside a projected list, or one created
dynamically — bind `[apiRef]` to a `WritableSignal<GridApi<TRow> | null>`; the
grid writes itself in and clears it on destruction.

Methods whose milestone has not shipped are **present and throw**, naming the
milestone, so the object's shape is final and a wrapper never tests for an
absent method. Editing, export, `applyTransaction` and `autoSizeColumns` are the
ones that throw today. Reads stay live after destruction; writes become
no-ops with a development warning, which matters because a wrapper adds a
render tick between a host resolving its reference and the grid resolving its
own.

### One event stream, alongside the granular outputs

```ts
onGridEvent(event: GridEvent<Booking>): void {
  if (event.name === 'selectionChanging' && !this.canSelect()) {
    event.payload.canceled = true;
  }
}
```

`(gridEvent)` carries a `{ name, payload }` union narrowable by `name`. The
granular outputs stay for a host binding two or three of them, and both are
fed from **one emission** — a consumer cannot observe one without the other.

**Cancellation is synchronous.** Angular outputs emit synchronously, so a
handler sets `canceled` before the emission returns and the grid reads it
immediately after. That is what lets a veto survive being re-emitted through a
wrapper, and it is contract rather than implementation detail: an asynchronous
veto is not supported.

Wired today: `initialized`, `firstSettled`, `queryChanged`, `dataChanged`,
`loadFailed`, `error`, `sortChanged`, `filterChanged`, `pageChanged`,
`pageSizeChanged`, `columnResized`, `columnMoved`, `columnVisibilityChanged`,
`rowClick`, `rowDoubleClick`, `rowActivated`, `cellClick`, `cellDoubleClick`,
`cellFocused`, `selectionChanging`, `selectionChanged`, `groupChanged`,
`rowExpanding`, `rowExpanded`, `rowCollapsing`, `rowCollapsed`, `scrolled`. The
rest arrive with the features that raise them.

Two guarantees the spec asks for and this wiring keeps: a facet's **initial
value is not a change**, so no event fires for it; and one user action produces
one event — a resize drag reports the width the user settled on, not the frames
it passed through.

### The bounded set a wrapper forwards

`config`, `features`, `templates`, `capabilities`, `[(state)]`,
`[(selectedKeys)]`, `[(expandedKeys)]`, `(gridEvent)`. Four of those are
inputs later milestones add; the count does not grow beyond them, because new
capability arrives _inside_ one of them rather than as a new binding.

## Motion

Curves and durations come from the tokens.

- **Sort indicator** — the arrow fades in, and a direction change rotates the
  same arrow 180° rather than swapping two icons. `--ease-out`, because the
  user pressed the header and a press outranks the movement category.
- **Row reorder on sort** — rows slide to their new places, but **only when
  every row is rendered**. Under virtualization a sort replaces most of the
  window, so animating would slide two or three rows while a dozen popped.
  Disable with `[animateRows]="false"`.
- **Group chevron** — rotates 90° between closed and open; the same rotation
  the sort arrow uses, at `--dur-fast`, because it answers a press.
- **Cell flash** — a cell whose value changed on a refresh washes over in
  accent. Silent for a first load, a scroll, a sort, and a refresh that changed
  nothing. Disable with `[flashOnChange]="false"`.
- **Drag** — the ghost lifts on `--ease-spring` and drops out faster; the drop
  indicator is one bar that translates between columns.
- **State regions** — empty, no-results and error rise and fade in;
  the loading bar fades.

Nothing animates at rest: `document.getAnimations()` settles to zero.

### Why the header is its own tab stop

§16.2 lists the header and the body as separate regions `Tab` moves between,
so the header carries its own roving tabindex rather than joining the body's
cell walk. Inside a header cell the pointer-only affordances — the resize
handle and the menu trigger — are `aria-hidden` and not focusable, because a
focusable control inside a `columnheader` that is itself focusable would nest
one interactive element in another. Every one of their functions has a
keyboard equivalent on the cell: `Enter` sorts, `Alt+Down` opens the menu,
`Ctrl+Arrow` resizes, `Ctrl+Shift+Arrow` reorders.

### Renderer contract

Renderers are **recycled**: the grid updates an existing view's context rather
than promising a new instance per row. Derive everything from the context and
keep no per-row state inside a renderer. `let-cell` binds the whole context;
named bindings such as `let-row="row"` work too.

Keys typed inside a renderer's own interactive content are left alone — the
grid only handles keys whose target is the cell itself.

### Why row height is an input, not a token

Density scales padding and type through tokens, but the row height is a
component input. The virtualizer computes its window from that number in
TypeScript, and a value that lives only in a stylesheet cannot drive window
math. `$component-size` therefore carries only the grid geometry CSS owns.

## The headless core (M0)

Framework-agnostic state and behavior built on Angular signals, with zero DOM.

- **Public contract types** — `GridConfig`, `ColumnDef`, `Query`/`QueryResult`,
  `FilterNode`, `GridState`, `GridApi`, event payloads. These are the versioned
  API; breaking changes to them require a major version.
- **`QueryStore`** — every query facet (sort, group, filters, search, paging,
  projection) as signals, composed into one `Query` descriptor. Synchronous
  facet writes coalesce into one downstream request, so `setState()` issues
  exactly one query.
- **`DataStore`** — executes queries against local arrays, remote sources, or
  a hybrid per-operation matrix. Coalesces rapid changes, aborts superseded
  requests, reports errors as data — the whole pipeline, `transformQuery`,
  `transformResult` and the local post-process included — and exposes the
  first-settled signal.

  Remote paging returns one page of a result the source has already ordered and
  narrowed, so an operation the grid then runs locally sees that page and
  nothing else: local sorting orders each page on its own, and a local filter
  shrinks the page and reports its size as the total. **Remote paging needs
  remote filtering, search, sorting, grouping and aggregation.** The store
  cannot repair the combination without fetching the whole dataset, so it
  reports it as an error in development instead.

- **Local engine** — filter-tree predicate compiler for the full operator set,
  stable multi-sort, aggregates, paging, and group synthesis (`buildGroups`)
  with per-group aggregates.
- **`GroupStore` / `ExpansionStore`** — group expansion as a default plus the
  paths that depart from it, so `collapseAll()` reaches groups the grid has not
  built; keyed row expansion with a single/multiple policy.
- **`ColumnStore`** — order, visibility, width, pinning as overrides on
  immutable defs; computes the query projection from visible columns.
- **`SelectionStore`** — keyed selection; "select all matching" stored as a
  predicate (filter + exclusions), never a materialized key list.
- **State** — `serializeGridState` / `applyGridState` with versioning,
  migration hook and unknown-column tolerance; `gridStatesEqual` backs the
  dirty comparison.
- **`GridEventBus`** — typed events with structural dedup.

## Why these decisions

- **Rows are referenced by key everywhere.** Indexes do not survive reloads;
  keys do. `createKeyGetter` resolves the config's `KeySpec` once.
- **Relative date filters are descriptors.** They materialize against the
  current instant at schedule time, so every reload re-evaluates them.
- **Errors are data.** A failed load sets the `error` signal; nothing throws
  into the host's render cycle.
- **The base filter is separate from the user filter.** It joins the query
  via `and`, is invisible to every filter surface, and survives
  `clearFilters()`.

## Usage (headless, M0)

```ts
import { ColumnStore, DataStore, QueryStore, connectDataStore, where } from '@ui/datagrid';

const query = new QueryStore({ pageSize: 25 });
const data = new DataStore(myRows); // or a GridDataSource, or a DataConfig
connectDataStore(query, data, injector);

query.setSort([{ field: 'name' }]);
query.setFilter(where('status', 'eq', 'active')); // one coalesced load
data.rows();
data.loading();
data.error(); // signals
```

## Accessibility

The rendering shell (M1+) owns the ARIA grid semantics and the keyboard
model. The core contributes the state they need: keyed focus, total counts
for `aria-rowcount`, and dedup guarantees for live-region announcements.

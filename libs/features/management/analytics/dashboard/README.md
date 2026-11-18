# @features/management-analytics-dashboard

The shop's numbers at `/management/dashboard`: a toolbar, six KPI tiles and seven tabs of charts.
`management-layout` registers `dashboardRoute` in its `PAGE_ROUTES`. The page gate is
`analytics:read`, which the `staff` role does not hold.

| Piece                               | Holds                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `analytics-dashboard.routes.ts`     | The dictionaries (its own and the appointments one), the error copy       |
| `analytics-dashboard.store.ts`      | The filters from the URL, the overview, one entry per tab, the reads      |
| `analytics-dashboard.errors.ts`     | The page's copy for the `ANALYTICS_*` codes, provided on the route        |
| `analytics.format.ts`               | Units, compact axis money, time bucket labels, day ranges, the KPI change |
| `page/analytics-dashboard.ts`       | The page: the toolbar, the KPI row, the tabs                              |
| `page/dashboard-filters.ts`         | The toolbar. It only reports changes                                      |
| `page/dashboard-filters.query.ts`   | The URL codec: defaults, refused values, presets resolved on today        |
| `kpis/kpi-tile.ts`                  | One KPI: the value, the change badge, the tooltip, the sparkline          |
| `charts/chart-card.ts`              | One chart: heading, note, states, the legend toggles, the hidden table    |
| `charts/chart-grid.ts`              | A tab's grid: one column, two from `md`. Two row tracks for each card     |
| `charts/series-table.ts`            | Any `SeriesSetViewDto` as a table for screen readers                      |
| `charts/chart-context.ts`           | `injectChartContext`: tokens, translate, the formatter and the period     |
| `charts/options/chart-*.ts`         | The pure helpers every option builder shares                              |
| `charts/options/<chart>.options.ts` | One pure builder per chart: `(set, ctx) => ChartOption`                   |
| `tabs/<tab>-tab.ts`                 | One tab: its cards, its options                                           |
| `testing/*`                         | Spec fixtures: plain tokens, a Greek context, sets, the Transloco setup   |

The API is `@api/analytics`.

## What is worth knowing

- **The URL is the state.** Every filter and the tab are query parameters. A defaulted value is
  left out of the address, so the default view is the bare path. A refused value (an unknown
  tab, a reversed range, day buckets over 92 days, a barber who is not in the shop) shows as its
  default, and the address is rewritten with `replaceUrl`. A preset is stored by its id, so a
  saved "last 30 days" link moves with time. A filter change merges into the address. A tab
  change replaces it, so the back button does not walk through every tab.
- **One read per target, keyed by what it depends on.** The key is the dates, the comparison,
  the bucket, the barber, the shop and the language. A tab whose entry has the current key draws
  without a request. The Team tab compares every barber, so its key and its request leave the
  barber out. Each read has a sequence number, and an older response is dropped.
- **Old data stays on screen while a new read runs.** The card dims it and shows a progress line.
  The first read shows a skeleton for at least `SKELETON_MIN_DURATION`. A failed read shows the
  failure with a retry, not the old data: the old data answers other filters.
- **The panels are lazy.** A hidden tab's charts are destroyed. The store keeps the response, so
  a return to the tab draws at once.
- **Option builders are pure.** They take the set and a `ChartContext` (tokens, translate, the
  formatter, the period, the locale) and return an ECharts option. A spec checks them without a
  browser. `ChartTheme` gives the tokens, so a theme change builds every option again.
- **The cards of a row share two row tracks: the header and the chart.** Each card spans two rows
  of `lib-chart-grid`, and its host, its `article` and its body pass them down as subgrids. So the
  taller header of a row sets the header height of both cards, and the charts of a row start at
  one height and are one height tall. A chart grows to its track, never below its `height`. A
  `wide` card spans both columns: a chart over time, or a table. The progress line and the live
  region are absolute, so they take no track. On a phone each card has its own tracks.
- **The legend is one row under the title and the note.** It never sits beside the title and
  never wraps, so the skeleton and the loaded legend are one height at every width. A card whose
  skeleton gives `legend` of 2 or more draws a row of stubs at that height. The items are compact
  (a `--space-4` marker, `--space-1` gaps, 24px tall targets), so the five statuses fit a card of
  two columns at 1440px. A legend that does not fit scrolls inside its row, with no scrollbar,
  and a focused item scrolls into view. The focus ring is inset, because the row clips it.
- **The legend is the card's buttons.** A builder writes `chartLegend([...])`, which ECharts
  keeps hidden. The card reads `legend.data` and draws a toggle button for each entry, with
  `aria-pressed`. A toggle sets `legend.selected` in a copy of the option. The ECharts legend is
  a click target on the SVG, which a keyboard cannot reach.
- **Status series take the appointments page's tones and names.** `statusBars` maps
  `APPOINTMENT_STATUS_SPECS` to the tokens, muted statuses lighter. The status names are in the
  appointments dictionary, which the route loads with the page's own. Text in a status hue (the
  KPI change, a failure) takes the `--success-text`-style tokens, and a fill takes the hue itself.
- **Time labels show real dates.** A cut first or last bucket shows its dates, so a three-day
  "week" reads as three days. The comparison's dates are rebuilt with the API's bucket rules
  (`timeBuckets`), because the API lines the `previous` series up by position.
- **The KPI row is a list of tiles, not a `StatGroup`.** A tile holds a `lib-stat` and more than
  the figure: the change and the sparkline. Inside a `StatGroup`, the inner `lib-stat` would be the
  list item and the rest of the tile would sit outside it.
- **`lostRate` changes in percentage points.** A percent of a percent misleads. A rise is bad.

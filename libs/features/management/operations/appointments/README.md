# @features/management-operations-appointments

The shop's appointments as a grid, at `/management/appointments`. `management-layout` registers
`appointmentsRoute` in its `PAGE_ROUTES`. The page gate is `appointments:read_all`, and every call
it makes needs only that code.

| Piece                             | Holds                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| `appointments.routes.ts`          | The dictionaries, the store, the drawer child route                  |
| `appointments.store.ts`           | The shop's options, the grid source, the three header-filter sources |
| `appointments.columns.ts`         | Every column, and which filter each takes                            |
| `customer-view.ts`                | The arrangement of "this customer's appointments"                    |
| `list/appointments-list.ts`       | The grid, the toolbar, `?customer=`                                  |
| `list/appointments-panel-host.ts` | The grid as the drawer's page (`APPOINTMENT_PANEL_HOST`)             |

## What is worth knowing

- **The endpoint does every operation.** `remote: true` over `appointments/odata`. The page sizes
  stop at 100, the endpoint's `$top` cap. The export reads in pages of 100.
- **The page opens on the upcoming appointments.** Date & time declares `filter.initial` "from
  today", so it shows in the filter row, the reader can change it, and Reset returns to it. A
  stored default view wins over it, as a view does over any declared arrangement.
- **Nothing blocks the click.** The route resolves only the dictionaries. The page reads
  `calendar-options` and, for `?customer=`, the customer's name itself, beside the grid's stored
  views, and the grid draws its skeleton meanwhile.
- **"Today" is the shop's.** `config.locale.timezone` hands the zone to the grid, which counts days
  and shows dates in it. The options usually land before the stored views, which the first query
  waits for. When they land later and the shop's zone differs from the browser's, a second query
  replaces the first.
- **A column takes one kind of filter.** Customer, Barber, Services, Status, Booked via and
  Rating take the header's list (`allow.rowFiltering: false`). The rest take the filter row
  (`allow.headerFiltering: false`).
- **A header filter tests an id, never a name.** Customer, Barber and Services read their own
  source (`headerFilterSource`) and filter `customerId`, `staffMemberId` and
  `services/any(s: s/serviceId …)`. Names repeat, and a renamed barber would drop out of a view.
- **The source describes the row to the binding.** `guidFields` sends ids bare, `collections`
  turns `services.serviceId` into `any()`, and `normalizedFields` sends "Cancelled by" and
  "Cancellation reason" to their folded twins, so they ignore case and accents.
- **`?customer=<id>` opens a temporary view.** The drawer's "View all" links here, from this page
  and from the calendar. The page reads the customer's name, and `gridViews({ temporary })` answers
  a promise of the view, awaited beside the stored views: one query, and a stored default is never
  applied on the way. From a drawer over this page, the page
  resolves the name first and then opens the view: one apply, one query.
- **The temporary view is never stored and never the default.** `@ui/saved-views` holds it apart
  from the stored list. Leaving it takes `?customer=` out of the address.
- **A write in the drawer reloads the grid.** It does not move the grid: the grid keeps its
  filter, and a saved appointment outside it is still the one the drawer shows.

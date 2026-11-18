# @features/management-operations-calendar

The shop's appointment book at `/management/calendar`: `lib-calendar` fed from `@api/appointments`.
`management-layout` registers `calendarRoute` in its `PAGE_ROUTES`. The page gate is
`appointments:read_all`, and every call it makes needs only that code.

| Piece                         | Holds                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `calendar.store.ts`           | Position, filters, the three resources, settings persistence. Route-scoped    |
| `calendar-mapping.ts`         | `AppointmentODataResponse` → `CalendarEvent`, roster → resources, hours       |
| `calendar-url.ts`             | The address: `?view=week&date=2026-09-21`, and `&columns=barbers` in day view |
| `calendar-settings.ts`        | The `calendar_settings` document and the saved views' state guard             |
| `calendar-browser-storage.ts` | The panel left open and a copy of the settings, kept in `localStorage`        |
| `filters/`                    | The filters panel: a form over the store's filter signal                      |
| `page/calendar-panel-host.ts` | The calendar as the appointment drawer's page (`APPOINTMENT_PANEL_HOST`)      |

## What is worth knowing

- **The calendar draws on the first frame.** The route resolves only the dictionaries. `hydrate`
  moves to the address at once, and the book loads for what is drawn. The last used settings and
  the default saved view land on top when they arrive, and a range or a filter they change loads
  again. A change the user made before they arrived wins over them.
- **The open panel is kept in `localStorage`, not in `calendar_settings`.** It is read before the
  first draw, so a panel left open is open on the first frame instead of sliding in.
- **The browser keeps a copy of the settings in effect.** It is read before the first draw, so a
  calendar left in month view draws month view, instead of week view and then month. The server
  copy still lands on top, and switches the view only when another device changed it.
- **The address wins over the persisted view.** A week link does not reset a saved per-barber
  preference: `columns` is read in day view only.
- **The last load survives a new query.** While the next range loads, the held rows are narrowed
  to the new range and filters on the client, which is why `matchesFilters` mirrors the server.
- **Year view reads counts only**, through `$apply` on the same endpoint.
- **The first visit writes nothing.** The settings are saved on the first change, never echoed.
  A panel opened while it overlays the calendar is shown but not persisted.
- **The book is read with `$select`.** `CALENDAR_APPOINTMENT_FIELDS` sits beside the mapping, and
  `CalendarAppointmentRow` is built from it, so the tiles cannot read a member the request left out.
- **The shop is a reload key, not a URL part.** The API resolves it from the account. A superadmin's
  shop change refetches every resource and drops the held rows. With no shop, nothing loads.
- **Customer search folds its term** before `$search`. The server folds it too, but not a capital
  `Σ` to the final `ς`.
- **Split shifts merge** into one range per weekday, because the time grid takes one.
- **The drawer is `@features/management-shared-appointments`,** at `:appointmentId` (`new` for a
  create). The page provides its host, so the drawer never imports the calendar. `new` carries its
  prefill in `slotDate`, `slotTime`, `barberId` and `rebook`. `date` is the calendar's own.
- **The drawer moves the calendar through the address only.** After a save, the host navigates to
  the appointment with `positionFor(date)`, and the page's own subscription applies it. Writing the
  store's anchor directly would race the page's address effect, which writes the old path back.
- **The discard guard runs on a prefill change, not on a calendar move.** The route's
  `runGuardsAndResolvers` compares the appointment id and the prefill parameters only.

Saved views (`calendar_main_views`) hold the whole arrangement: the filters, the calendar view and
the settings. The date and the open panel are not part of one. `calendar_settings` is the last used
arrangement, the fallback when there is no default view. An older document can still carry a
`panel` member, which is ignored and dropped by the next write.

# `@features/management-company`

The shop's own settings, `/management/company`. It is not a sidebar page: the account menu at the
right end of the top bar opens it, and every person who can open the workspace can read it. Only
holders of `company:update` see Edit and the other change actions.

```ts
// libs/features/management/layout/src/lib.routes.ts
{ ...companyRoute, path: MANAGEMENT_COMPANY_PAGE, title: 'management.nav.company' }
```

## Layout

One column of cards, each rendering `lib-page-section` from
`@features/management-shared-page-sections`, so each card loads and fails on its own.

| Folder      | Card                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| `shop/`     | Shop: logo, name, address, contact details, public page, support. Logo crop |
| `hours/`    | Opening hours: the week in view, the shared week grid in edit               |
| `closures/` | Closures and special hours, with the add and edit dialog                    |
| `booking/`  | Booking rules: four presets with the stored value kept as an option         |
| `photos/`   | Photos: upload, order, description, delete                                  |
| `form/`     | The field specs, the rules, and the request conversions                     |
| `page/`     | The page and its unsaved-changes guard                                      |

## What is worth knowing

- **One store, three cards.** `CompanyStore` reads `GET company` once for the Shop, Opening hours
  and Booking rules cards, and a save patches it with no new read. Closures and photos have their
  own resources. A platform admin's shop switch re-creates the page, so no card keys on the shop.
- **A closure write reloads in place.** The list keeps its rows while it reads again, so the
  conflicts banner can take focus.
- **The photo queue sends one file at a time**, in the order chosen, and stops when the card goes
  away. A reorder waits for the queue: an upload that lands during a reorder would make the order
  stale.
- **The week grid is the staff lib's.** `WeekHoursGrid` from
  `@features/management-shared-staff-schedule` edits the shop's week without a reference week.
  The card maps `openTime`/`closeTime` to the grid's `startTime`/`endTime` at its edges, and a
  refusal on `businessHours[i]` to the range it came from.
- **A save never moves a booking.** The hours and closure saves list the bookings now outside the
  open time in `lib-staff-conflicts` from the staff schedule lib, with a heading of their own and
  the barber on each line. Each links to its drawer for `appointments:read_all`.
- **The barbers' hours do not follow the shop's.** After an hours save, a note says so, with a
  link to the Staff page for `members:read`.
- **A closure that began before today is half history.** Its first day is read-only, and a delete
  ends it yesterday. "Today" is the shop's, from its zone.
- **The date pickers refuse past days through `excludedRanges`.** `[min]` cannot sit beside
  `[formField]`, and Signal Forms has no `min` for a text date.
- **The logo and the photos save at once**, outside edit mode, so the Photos card registers no
  editor. A file keeps its image type: the API checks the multipart part's `Content-Type`.
- **The route owns the error copy.** `companyErrorMessages` puts this page's words on every
  `COMPANY_*` refusal. The server's description is English.
- **The dictionaries load before the page.** `loadCompanyDictionaries` loads this lib's, the page
  frame's and the schedule lib's, because cards translate in `computed`s.

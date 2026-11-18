# @api/appointments

The shop's appointment book: `/api/v1/appointments`. The calendar and the appointments grid read it. The API
resolves the shop from the signed-in user, so no call takes a company id. Every call needs
`appointments:read_all` at that shop.

```ts
const rows = await firstValueFrom(
  api.appointments({ from: '2026-09-21', to: '2026-09-28', ...facets }, 'el', ['id', 'localDate']),
);
```

| Call              | Endpoint                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| `calendarOptions` | `GET …/calendar-options` — time zone, weekly hours, staff roster, categories |
| `appointments`    | `GET …/odata` with `$filter` and `$select` — every match, no page size       |
| `dayCounts`       | `GET …/odata` with `$apply` — per-day counts under the same filter           |
| `customers`       | `GET …/customers/odata` — the fetch for an OData data source                 |
| `grid`            | `GET …/odata` — the fetch for the appointments grid's OData data source      |
| `services`        | `GET …/services/odata` — every service, inactive ones included, `$search`    |

## What is worth knowing

- **The filter is written by hand** (`appointmentsFilter`). `localDate` is an `Edm.Date`, so its
  literal is unquoted, and the category facet is an `any()` lambda. `odata-query` renders neither.
- **The endpoint has no row cap.** A request without a range would read the whole book, so
  `appointmentsFilter` throws on a missing range instead of sending one.
- **A value that is not its literal form is dropped.** Ids come from the URL and from saved
  presets, and a stored string must not become part of an expression.
- **`appointments` sends `$select`.** The row carries prices and contact details. A caller names
  only the members it shows, next to the mapping that reads them.
- **Customer search folds its term on the caller's side.** The server folds it too, but Postgres
  lowercases a capital `Σ` to `σ` and never to the final `ς`, so `ΓΙΩΡΓΟΣ` misses `Γιώργος`.
  Column filters go through OData unfolded and keep that gap.
- Times and dates are shop-local on the wire. The client never converts them.

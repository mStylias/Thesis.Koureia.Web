# @api/analytics

The shop's numbers: `/api/v1/analytics`. The management dashboard reads it, one call for each
tab. The API resolves the shop from the signed-in user, so no call takes a company id. Every call
needs `analytics:read`.

```ts
const revenue = await firstValueFrom(
  api.revenue({ from: '2026-09-01', to: '2026-09-30', granularity: 'Week', languageCode: 'el' }),
);
```

| Call           | Endpoint                        | Response                  |
| -------------- | ------------------------------- | ------------------------- |
| `overview`     | `GET …/overview` — the six KPIs | `OverviewTabResponse`     |
| `revenue`      | `GET …/revenue`                 | `RevenueTabResponse`      |
| `demand`       | `GET …/demand`                  | `DemandTabResponse`       |
| `team`         | `GET …/team` — no staff filter  | `TeamTabResponse`         |
| `services`     | `GET …/services`                | `ServicesTabResponse`     |
| `customers`    | `GET …/customers`               | `CustomersTabResponse`    |
| `lostBusiness` | `GET …/lost-business`           | `LostBusinessTabResponse` |
| `quality`      | `GET …/quality`                 | `QualityTabResponse`      |

Every call takes `AnalyticsQueryParameters`:

| Field           | Sent                             | When absent                             |
| --------------- | -------------------------------- | --------------------------------------- |
| `from`, `to`    | Always, `YYYY-MM-DD`             | —                                       |
| `granularity`   | `Day`, `Week`, `Month`           | The API picks one from the range length |
| `compareTo`     | `PreviousPeriod`, `PreviousYear` | `PreviousPeriod`                        |
| `staffMemberId` | A guid                           | Every staff member                      |
| `languageCode`  | The active language              | The API default names the services      |

## What is worth knowing

- **The type names are the backend's DTO names.** Each chart is a `SeriesSetViewDto` under the
  name of its `AnalyticsChart` value, in camelCase: `revenueOverTime`, `busyHeatmap`.
- **Enums are PascalCase on the wire**, in both directions: `"Week"`, `"Money"`, `"Time"`. The
  API uses `JsonStringEnumConverter<T>` with no naming policy.
- **`null` is no data, `0` is a zero.** A series value, a KPI value and a KPI `change` can be
  `null`. Never draw a `null` as `0`.
- **`change` is a ratio,** `0.12` for +12 %. A `Percent` value is already 0 to 100.
- **`period` says what the API used** after its defaults: the granularity and the comparison
  range. Label the axis from it, not from the request.
- **`limit` and `days` are not sent.** The API defaults, 10 top customers and 14 upcoming days,
  are enough. The `charts/{chart}` and `kpis/{kpi}` endpoints have no calls yet.
- **Refusals** carry the code in `title`: `ANALYTICS_INVALID_PERIOD`,
  `ANALYTICS_INVALID_GRANULARITY` (`Day` over 92 days), `ANALYTICS_STAFF_MEMBER_NOT_FOUND`,
  `ANALYTICS_FETCH_FAILED`.

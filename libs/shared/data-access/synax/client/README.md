# @synax/client

TypeScript/Angular client library for APIs built with **Synax.AspNetCore** + **Synax.Results**.
It mirrors the server's philosophy on the client: results as values, never exceptions for
flow control. See [DESIGN.md](../DESIGN.md) for the full design.

Two entry points:

- **`@synax/client/core`** — transport-free: no Angular imports, no rxjs. `Result`,
  `HttpError` + `parseHttpError`, `ValidationError` helpers, property-path parsing,
  `PagedResult` / `KeysetPage` types, synthetic error codes.
- **`@synax/client`** — the Angular layer: RxJS operators that plug into your own
  `HttpClient` calls (never a wrapper around it), URL helpers, signal-based paginators,
  and an error-message registry.

## Consuming results

```ts
import { Result, KeysetPage } from '@synax/client/core';
import { hasBody, toResult, toResultResponse } from '@synax/client';

// GET — the stream never errors for HTTP failures
const result = await firstValueFrom(
  this.http.get<BookingResponse>(url).pipe(toResult()),
);
if (result.isSuccess) {
  use(result.data);            // null mirrors 204 No Content
} else {
  switch (result.error.errorCode) {
    case 'BOOKING_NOT_FOUND': ...
  }
}

// POST returning 201 Created + Location
const created = await firstValueFrom(
  this.http.post<BookingResponse>(url, body, { observe: 'response' }).pipe(toResultResponse()),
);
if (Result.hasData(created) && hasBody(created.data)) {
  created.data.body.id;        // the created resource
  created.data.location;       // "/api/v1/bookings/{id}"
}
```

`toResultResponse` always succeeds with a wrapper, so `Result.hasData` cannot tell a `201`
from a `204` — `hasBody(response)` is the check that narrows the body to non-null.

> **Cross-origin `Location`:** the header is not CORS-safelisted. An API on another origin
> must send `Access-Control-Expose-Headers: Location`, or the browser hides it and
> `location` is silently `undefined`. Same-origin calls (including through a dev-server
> proxy, as in the demo) are unaffected.

`HttpError` re-materializes the .NET `Synax.AspNetCore.Errors.HttpError` from the
RFC 9457 problem body: `title → errorCode`, `status → httpCode`, `detail → description`,
`errors → validationErrors`, plus the ASP.NET `traceId` for log correlation.

Failures that never produced a Synax problem body get **synthetic** codes so
`errorCode` is always switchable: `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`,
`PARSE_ERROR`, `UNKNOWN_ERROR`, and `HTTP_{status}` for foreign error bodies.
No server error codes ship with the library — your app owns its code constants.

> **Auth challenges are the common `HTTP_{status}` case.** A `401`/`403` from the
> authentication middleware never reaches a Synax handler, so it has an _empty body_ and
> arrives as `HTTP_401`/`HTTP_403` — `UNAUTHORIZED`/`FORBIDDEN` only appear when a handler
> returned them itself. Drive sign-in state off `httpCode` (or `byStatus`, below).

## Signal resources

```ts
bookings = httpResource<KeysetPage<BookingResponse, string>>(() => this.url());
bookingsError = computed(() => asHttpError(this.bookings.error())); // HttpError | null
```

## URLs

```ts
provideSynaxApi({ baseUrl: 'https://api.example.com', defaultVersion: 1 });

const url = injectSynaxUrl();
url('bookings/restaurant/' + id); // https://api.example.com/api/v1/bookings/restaurant/{id}
url('auth/login', { version: null }); // https://api.example.com/auth/login
url('bookings', { version: '1.2' }); // .../api/v1.2/bookings — ApiVersion(1, 2)
```

## Pagination

```ts
// keyset / infinite scroll — you supply the fetch with your own HttpClient call
readonly bookings = new KeysetPaginator<BookingResponse, string>((after, pageSize) =>
  this.http.get<KeysetPage<BookingResponse, string>>(this.url, {
    params: { pageSize, ...(after ? { after } : {}) },
  }).pipe(toResult()),
);
// bookings.items() / hasMore() / loading() / error(); bookings.loadMore(); bookings.reset()

// offset / tables
readonly restaurants = new PagedSource<RestaurantResponse>((page, pageSize) =>
  this.http.get<PagedResult<RestaurantResponse>>(this.url, { params: { page, pageSize } })
    .pipe(toResult()),
);
// restaurants.load(); .nextPage(); .totalPages(); ...
```

## OData (`/search` endpoints)

Endpoints built on `Synax.EntityFrameworkCore.OData` answer with the OData envelope
(`{ "value": [...], "@odata.count": n }`). Queries are built with
[`odata-query`](https://github.com/techniq/odata-query): `odataQueryString` serializes them,
`toODataResult()` normalizes the envelope to `{ items, totalCount, context?, nextLink? }`, and an
invalid client query comes back as a plain `HttpError` with code `INVALID_ODATA_QUERY`.

```ts
import { ODataPage, odataQueryString } from '@synax/client/core';
import { ODataSource, toODataResult } from '@synax/client';

this.http.get<ODataPage<RestaurantResponse>>(
  this.url('restaurants/search') +
    odataQueryString({ filter: { name: { contains: term } }, top: 20, count: true }),
).pipe(toODataResult());         // Observable<Result<ODataResult<RestaurantResponse>>>

// or as pager state ($top/$skip, $count on by default)
readonly search = new ODataSource<RestaurantResponse>(query =>
  this.http.get<ODataPage<RestaurantResponse>>(
    this.url('restaurants/search') + odataQueryString(query),
  ).pipe(toODataResult()),
  { pageSize: 20, orderBy: 'name' },
);
search.setFilter({ name: { contains: term } });   // back to page 1 and reload
```

The current Synax backend also supports opt-in `$search`, `$compute`, `$apply`, server-driven
paging, metadata, annotations, nested `$expand` options, `$levels`, and `$format=json`.
`odataQueryString` covers the query options needed by the shared data-source layer:

```ts
import { odataQueryString, odataTransform } from '@synax/client/core';

odataQueryString<Role>({ search: 'manager OR "booking admin"', top: 20 });

const distinctNames = odataTransform<Role>({
  groupBy: {
    properties: ['name'],
    transform: { aggregate: '$count as count' },
  },
});
odataQueryString<Role>({ transform: distinctNames, top: 51 });
// ?$apply=groupby((name),aggregate($count as count))&$top=51

odataQueryString<Role>({
  compute: 'numberOfUsers mul 2 as doubledUsers',
  select: ['name', 'doubledUsers'],
});

odataQueryString<Role>({
  transform: 'compute(year(createdAt) as year)/groupby((year),aggregate($count as count))',
});
```

Use `odataTransform<T>()` for structured `$apply` chains. It checks group properties and
aggregate structure before `odata-query` widens `transform` to an unchecked object. Use a raw
string only for transformations that package cannot model, such as `compute(...)` inside
`$apply`; raw expressions are app-authored and are not escaped.

`ODataPage` and `ODataResult` preserve `@odata.context` and `@odata.nextLink` as `context` and
`nextLink`. Follow a next link verbatim because it carries the server's `$skiptoken` or aggregation
offset. `ODataSource` remains a client-driven `$top`/`$skip` pager and does not follow next links;
the shared OData data-source binding builds queries directly instead.

> **Append the query string to the URL; do not pass it to `HttpClient`'s `params`.**
> `odataQueryString` returns an already-partially-encoded string (`%`, `&`, `+` and spaces are
> escaped _inside_ string literals, structural spaces are not). `HttpParams` would encode it a
> second time and the server would search for the literal text `Tav%20Barbers`.

Prefer a **structured** filter over a hand-written string: `{ name: { contains: term } }`
quotes and escapes the value, so searching for `O'Brien` yields `contains(name,'O''Brien')`
instead of an expression whose literal ends early. Plain strings are still accepted, so
existing filters keep working — they are passed through verbatim and are yours to escape.
`guid(id)` and `raw(expr)` cover the literal forms OData spells differently from JS.

Member names are **not** checked against the row type — `odata-query`'s `Filter<T>` unions an
open `PlainObject`, so `{ nmae: ... }` compiles and comes back as a `400`. The type parameter
documents the query's subject; it does not validate it.

`$select`/`$expand` and response annotations reshape rows into camelCased dictionaries — type those
calls as `ODataPage<ODataRow>`. The server caps `$top` at its `MaxTop` (100 by default), and rejects
options the endpoint did not opt into. `Searchable<T>()`, `EnableCompute`, `EnableApply`, and
`PageSize` are the backend switches. The default Aptison Booking roles endpoint uses none of them,
so it is suitable for `$filter`/`$orderby`/`$top`/`$skip`/`$count`/`$select` tests but correctly
rejects `$search`, `$compute`, `$apply`, and `$skiptoken`.

## Health

```ts
import { asHealthReport, SynaxHealthCheckResponse } from '@synax/client/core';

// /health answers 200 for Healthy/Degraded and 503 for Unhealthy — with the same body,
// so the failure branch still carries a report.
const report = result.isSuccess ? result.data : asHealthReport(result.error.raw);
```

## Validation errors

```ts
import { errorsFor, generalErrors, flattenValidationErrors } from '@synax/client/core';

errorsFor(error, 'items[2].name'); // field-level errors matched to your request JSON
generalErrors(error); // errors that belong to no single field
```

## Error messages

```ts
provideSynaxErrorMessages({
  codes: { BOOKING_NOT_FOUND: $localize`That booking no longer exists.` },
  byStatus: { 500: $localize`Something went wrong.` },
});

const message = injectErrorMessageResolver();
toast.show(message(result.error));
```

## Development

```bash
nx test shared-data-access-synax        # the Angular layer
nx test shared-data-access-synax-core   # the transport-free core
nx run-many -t lint test -p shared-data-access-synax shared-data-access-synax-core
```

# Synax.Client — TypeScript/Angular client library design

A TypeScript library for consuming APIs built with **Synax.AspNetCore** + **Synax.Results**.
It mirrors the server's philosophy on the client: results as values, never exceptions for
flow control, with the error contract (RFC 9457 Problem Details + Synax conventions) modeled
as first-class types.

> **Vendored into this workspace.** The library was authored in a standalone `Synax.Client`
> repository and lives here as two Nx projects (`client/` and `core/`) — see the README
> alongside this file for the layout. Sections 2.7, 3 and 6 below describe the original
> Angular CLI + ng-packagr packaging and its build-out order; they are kept for the design
> rationale they carry, not as a description of how the code is built today.

## 1. The wire contract (what Synax servers produce)

Derived from `ResultExtensions.ToHttpResult`, `HttpErrorExtensions.ToProblemResult`,
`SynaxExceptionHandler`, and the EFCore pagination types.

### Success

| Server result                     | HTTP response                                  |
| --------------------------------- | ---------------------------------------------- |
| `Result.Ok(data)`                 | `200 OK`, JSON body (camelCase)                |
| `Result.Ok(null)` / void `Result` | `204 No Content`, empty body                   |
| `onSuccess` overload              | custom, e.g. `201 Created` + `Location` header |

### Failure — always `application/problem+json` (RFC 9457)

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "status": 404,
  "title": "BOOKING_NOT_FOUND",
  "detail": "No booking with that id.",
  "traceId": "00-…-00",
  "errors": [
    {
      "code": "PARTY_TOO_LARGE",
      "description": "Party size exceeds table capacity.",
      "propertyName": "items[2].name",
      "innerErrors": []
    }
  ]
}
```

Contract facts the library encodes:

- **`title` carries the machine-readable error code** (`HttpError.ErrorCode`, e.g.
  `NOT_FOUND`, `VALIDATION_FAILED`, or domain codes like `BOOKING_NOT_FOUND`). `detail`
  carries the human description and may be absent.
- ASP.NET's problem-details pipeline stamps a `traceId` extension on server-emitted
  problems — useful for correlating a client report with server logs/telemetry.
- The `errors` extension appears only when field-level `ValidationError`s exist.
  `propertyName` is **camelCased per dotted segment with indexers preserved**
  (`"address.street"`, `"items[2].name"`) — designed to be matched against the request
  JSON the client sent. `propertyName` is omitted (not null) for form-level errors.
  `innerErrors` nests hierarchically and is omitted when empty.
- Unhandled server exceptions arrive in the **same shape**: `title: "Unhandled exception"`
  (500) or `title: "OperationCancelled"` (499). Custom `MapException` mappings may emit
  other titles.
- Result messages, origins, and exceptions are **server-side only by design** — the error
  code + description + validation errors are the entire client-visible diagnostic surface.

### Pagination shapes

```ts
// offset  (ISynaxQuery.ToPagedListAsync)
{ items: T[], page: number, pageSize: number, totalCount: number,
  totalPages: number, hasPreviousPage: boolean, hasNextPage: boolean }

// keyset  (ISynaxQuery.ToKeysetPageAsync) — pass nextCursor back as `after`
{ items: T[], pageSize: number, hasMore: boolean, nextCursor: TKey | null }
```

### Other conventions

- URL grouping: versioned endpoints under `/api/v{version}/{tag}/`, non-versioned under
  `/{tag}/` (tags are case-insensitive).
- Health endpoint: `{ overallStatus, checks: [{ ... }], totalDuration }` with statuses
  serialized as strings.

## 2. Architecture decisions (settled)

1. **Transport-free core + Angular integration layer.** The shared core contains
   **zero HTTP**: only types and pure functions (result union, problem parsing from
   `(status, body)`, pagination helpers). All I/O stays in the app's own `HttpClient`
   usage — see next point.
2. **Integrate with `HttpClient`, don't wrap it.** A client wrapper is too aggressive:
   it hides `HttpClient`'s own surface (options, `observe`, progress events, typed
   overloads) and fights other libraries that also build on it. Instead the Angular
   layer ships **RxJS operators and helpers that plug into calls the app already
   makes**: `this.http.post<T>(url, body).pipe(toResult())`. Interceptors, XSRF,
   `HttpTestingController`, SSR transfer-cache — all untouched because the app still
   calls `HttpClient` directly.
3. **RxJS as the foundation, signals as a consumption layer.** `toResult()` yields
   `Observable<Result<T>>` (mutations included). Signal-based helpers (`httpResource`
   error mapping, paginator state) sit on top for modern component code.
4. **Generic types, hand-written DTOs.** No OpenAPI codegen (for now). Apps declare
   their own request/response interfaces and error-code constants; the library supplies
   the generic shapes and machinery.
5. **No forms integration.** Reactive/template forms will never be targeted. A future
   entry point will bind server validation errors to **signal forms** (stabilized in
   Angular 22); until then, forms stay out entirely. The `propertyName` path parser
   lives in core so that future work (and any app-side binding) has the primitives.
6. **No auth integration.** Token acquisition/attachment is routinely owned by dedicated
   libraries (e.g. OIDC clients); shipping our own interceptor would collide with them.
7. **Lives in this repo** (`Synax.Client`), pnpm workspace, npm publishing deferred.
   No demo front-end yet.

## 3. Package layout

One publishable library (Angular CLI workspace + ng-packagr, **pnpm** as package manager)
with a secondary entry point so the transport-free core stays importable without Angular:

```
@synax/client/core     — no Angular imports, no rxjs requirement
  result.ts            Result<TData, TError = HttpError> union + Ok/Fail factories,
                       guards and combinators (mirrors Synax.Results)
  http-error.ts        HttpError, ValidationError, parseHttpError(status, body, headers?)
  property-path.ts     parse dotted+indexed propertyName paths (primitive for future
                       signal-forms binding and app-side error placement)
  pagination.ts        PagedResult<T>, KeysetPage<T, TKey> interfaces + pure helpers
  synthetic-codes.ts   synthetic client-side codes only (NETWORK_ERROR, TIMEOUT,
                       PARSE_ERROR, CANCELLED, HTTP_{status}); no server default codes
                       are shipped — apps own their error-code constants

@synax/client          — Angular layer (peer deps: @angular/core, @angular/common, rxjs)
  operators.ts         toResult<T>() and friends — RxJS operators for HttpClient pipes
  resource.ts          httpResource/rxResource error mapping helpers
  url.ts               SYNAX_API_CONFIG token + synaxUrl(...) for /api/v{n}/{tag} routing
  pagination.ts        KeysetPaginator, PagedSource (signal-based state machines)
  messages.ts          SYNAX_ERROR_MESSAGES token + resolveMessage(error)
```

## 4. Feature specifications

### 4.1 `Result<TData, TError>` — mirroring `Synax.Results`

Naming and usage syntax track the .NET library as closely as TypeScript allows:
`Result.Ok(...)` / `Result.Fail(...)` factories, `isSuccess` / `data` / `error` members.

```ts
type Result<TData, TError = HttpError> =
  | {
      readonly isSuccess: true;
      readonly isFailure: false;
      readonly data: TData | null;
      readonly error: null;
    }
  | {
      readonly isSuccess: false;
      readonly isFailure: true;
      readonly data: null;
      readonly error: TError;
    };

// factories (match the .NET static factories):
Result.Ok(data); // 200 — data present
Result.Ok(); // 204 — void success, data is null
Result.Fail(error); // failed result carrying the typed error

// usage — same shape as a .NET handler consuming a Result:
const result = await firstValueFrom(this.http.post<BookingResponse>(url, body).pipe(toResult()));
if (result.isSuccess) {
  console.log(result.data!.id);
} else {
  switch (result.error.errorCode) {
    /* ... */
  }
}

// helpers (secondary to the .NET-style property access above):
Result.hasData(r); // narrows data to non-null (the 200-vs-204 distinction)
Result.match(r, { ok, fail });
Result.map(r, fn);
```

Design rule mirrored from the server: **failures are values, not thrown errors.** The
library never lets an `HttpErrorResponse` escape as a stream error for expected failures.

### 4.2 `HttpError` + parsing — mirroring `Synax.AspNetCore.Errors.HttpError`

The client-side error type reuses the .NET names (`ErrorCode`, `HttpCode`, `Description`,
`ValidationErrors` → camelCased members), re-materialized from the Problem Details wire
format:

```ts
interface HttpError {
  errorCode: string; // problem `title`; always populated (synthetic if needed)
  httpCode: number; // HTTP status (0 for network failures)
  description?: string; // problem `detail`
  validationErrors: ValidationError[];
  traceId?: string; // ASP.NET-stamped; absent on synthetic client-side errors
  raw?: unknown; // original body for escape hatches
}
interface ValidationError {
  // identical member names to the .NET record
  code: string;
  description: string;
  propertyName?: string; // camelCased dotted path, indexers preserved
  innerErrors?: ValidationError[];
}
```

`parseHttpError(status, body, headers?)` (pure, in core):

- `application/problem+json` (or problem-shaped JSON) → map `title → errorCode`,
  `status → httpCode`, `detail → description`, `errors → validationErrors`,
  `traceId → traceId`.
- Non-problem body / HTML / empty → synthetic `errorCode` derived from status
  (`HTTP_404`, ...) with `raw` preserved.
- Client-side conditions get reserved synthetic codes: `NETWORK_ERROR` (status 0),
  `TIMEOUT`, `CANCELLED`, `PARSE_ERROR`. Consumers can always `switch` on `errorCode`
  without null checks.

Helpers: `flattenValidationErrors(error)` (depth-first, paths joined),
`errorsFor(error, path)`, `generalErrors(error)` (no propertyName).

### 4.3 `HttpClient` integration (Angular) — operators, not a wrapper

The app keeps calling `HttpClient` itself; the library supplies pipeable operators:

```ts
// the workhorse: full HttpClient surface stays available before the pipe
this.http.get<KeysetPage<BookingResponse, string>>(url, { params }).pipe(toResult()); // Observable<Result<KeysetPage<...>>>

this.http.post<BookingResponse>(url, body).pipe(toResultResponse()); // Result<{ data, status, location? }> — for 201 Created
```

- `toResult<T>()`: maps the body to `Result.Ok(data)` (`null`/empty → the 204 case) and
  `catchError` → `Result.Fail(parseHttpError(...))`. The resulting stream **never errors**
  for HTTP failures; only genuine programming errors propagate.
- `toResultResponse<T>()`: same, but success carries `{ data, status, location? }` for
  endpoints using the `onSuccess` overload (e.g. `201 Created` + `Location`). Used with
  `{ observe: 'response' }`.
- `resultError(resource.error())` / `asHttpError(err)`: converts an `httpResource`/
  `rxResource` error (or any caught `HttpErrorResponse`) into an `HttpError`, so signal
  resources get the same typed error surface without any wrapping:
  ```ts
  bookings = httpResource<KeysetPage<BookingResponse, string>>(() => this.url());
  bookingsError = computed(() => asHttpError(this.bookings.error()));
  ```

### 4.4 URL conventions

Pure helpers + optional DI config; no client object:

- `provideSynaxApi({ baseUrl, defaultVersion })` registers `SYNAX_API_CONFIG`.
- `synaxUrl('bookings', { version: 1 })` → `/api/v1/bookings`;
  `synaxUrl('auth/login')` with no version → `/auth/login`. Injectable form
  (`injectSynaxUrl()`) reads the config; a pure overload takes it explicitly.

### 4.5 Pagination

Types in core; stateful helpers in the Angular layer:

- `KeysetPaginator<T, TKey>` — signal-based infinite-scroll state machine:
  `items` (accumulated), `hasMore`, `loading`, `error`, `loadMore()`, `reset()`.
  Constructed with a fetch function `(after: TKey | null, pageSize) =>
  Observable<Result<KeysetPage<T, TKey>>>` (the app builds it with its own `HttpClient`
  call + `toResult()`); guards against concurrent/duplicate loads.
- `PagedSource<T>` — offset pagination state: `page`/`pageSize` signals trigger refetch;
  exposes `items`, `totalCount`, `totalPages`, `hasNextPage`, `hasPreviousPage`,
  `loading`, `error`. Suitable for tables/pagers (CDK `DataSource` adapter optional, later).

### 4.6 Error-code registry & messages

- Core ships **no server error-code constants** — apps own their code constants/unions
  (mirroring their Domain `ErrorCodes` classes). Only the synthetic client-side codes
  (values the library itself produces) are exported.
- `SYNAX_ERROR_MESSAGES` (DI token): `Record<string, string | (e: HttpError) => string>`
  with per-status fallbacks; `resolveMessage(error)` for toasts/banners; designed to sit
  in front of any i18n layer (values may come from `$localize`/transloco).

## 5. Out of scope (for now)

- **Forms integration** — deliberately none. Future direction: a `@synax/client/signal-forms`
  entry point binding `ValidationError.propertyName` paths to signal forms
  (stabilized in Angular 22). Reactive/template forms will not be supported.
- **Auth** — token acquisition/attachment belongs to dedicated auth libraries; the
  library stays agnostic (it merely types 401/403 problems like any other `HttpError`).
- OpenAPI codegen companion (revisit later — the generic layer is its natural target).
- Demo Angular front-end for BookingDemoApp.
- npm publishing / release automation.

## 6. Implementation phases

1. **Scaffold**: Angular CLI workspace on **pnpm**, `synax-client` library with the
   `core` secondary entry point, strict TS, vitest/karma per CLI default, lint.
2. **Core**: `Result`, `HttpError` + `parseHttpError`, property-path parser,
   pagination types, synthetic-code constants. Pure unit tests (table-driven,
   including real payload shapes captured from the demo API).
3. **Angular integration**: `toResult()`/`toResultResponse()` operators,
   `asHttpError` resource helper, `provideSynaxApi` + `synaxUrl`. Tests via
   `HttpTestingController` on plain `HttpClient` calls.
4. **Pagination + signals**: `KeysetPaginator`, `PagedSource`.
5. **Messages**, README with usage recipes against the BookingDemoApp endpoints.

Each phase is independently shippable; 2–3 already deliver the core value
(typed results + problem parsing + never-throw operators).

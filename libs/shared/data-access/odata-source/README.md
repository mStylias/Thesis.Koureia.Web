# shared-data-access-odata-source

An OData endpoint as a `DataSource<T>`. Import from `@data/odata-source`.

This is the transport half of the shared data-source layer. A control imports
`@ui/data-source` and never this lib — that is what keeps a transport dependency
out of the component libraries, and it is why this is a sibling rather than a
deep import.

```ts
readonly roles = odataSource<RoleODataResponse>({
  fetch: (query) =>
    this.http
      .get<ODataPage<ODataRow>>(this.url('roles/search') + odataQueryString(query))
      .pipe(toODataResult()),
  key: { selector: 'id', type: 'uuid' },
  capabilities: { maxTop: 100 },
  searchFields: ['nameNormalized'],
});
```

## The app supplies the fetch

The library never makes an HTTP call. `fetch` is an **Observable**, not a
promise, because unsubscribing is what cancels an `HttpClient` request: with a
promise the contract's `signal` could only stop the caller listening, not stop
the request. `@synax/client`'s own `ODataFetch` satisfies the shape.

**Append the query string to the URL. Never hand it to `params`.** It is already
partly percent-encoded and `HttpParams` would encode it a second time, so the
server would search for the literal `%CE%B1`.

## Capabilities are opt-in, and every one has a fallback

A Synax endpoint refuses a query option it did not enable, and the refusal is a
`400` at run time rather than a type error. So every flag defaults to **off** and
the source sends only the base surface every endpoint answers.

| Off       | What happens instead                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`  | an `or` of `contains` over `searchFields`; with none declared the search is dropped and reported through `onUnsupported`                                                              |
| `apply`   | **`loadDistinct` is absent from the source**, so a consumer falls through to its own local path; aggregates are not requested, and nothing is reported rather than a page-local total |
| `compute` | a distinct request cannot bucket by a date part: `interval` is ignored and raw values come back                                                                                       |
| `maxTop`  | defaults to **100**, `AddSynaxOData()`'s own cap                                                                                                                                      |

`loadDistinct` being _missing_ rather than throwing is the whole design. Presence
is the capability, so a header-filter panel degrades instead of breaking.

## The `$top` cap is a correctness problem, not a tuning one

`load` honors the window it is given, so a `take` beyond `maxTop` is read in
server-sized pages and concatenated.

Without that, a full-dataset export asks for 1000 rows, receives the server's
100, reads the short page as the end of the result, and writes a truncated file
**while reporting success**. Declaring `maxTop` too high is what produces the
honest `400` instead.

## Search needs a normalized column

`searchFields` must name the server's normalized column, not the display column.

The server's `contains` emits a bare `LIKE` with no `lower()`, so it is case- and
accent-sensitive — measured, not assumed: `contains(name,'admin')` matches and
`contains(name,'ADMIN')` does not. This binding folds the needle with
`@ui/data-source`'s `foldText`, the client half of `lower(unaccent(t))`, so a
folded needle against a generated `name_normalized` column answers the same query
the local engine answers.

`$search`, where an endpoint declares `Searchable<T>`, is sent **unfolded**: it
has a grammar of its own and lowercasing it would turn the `OR` and `AND`
operators into search terms.

## Field kinds the endpoint must name

Nothing in a `FilterNode` says what a field holds, so four kinds are declared per source:

| Option             | Effect                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `guidFields`       | A string value goes bare. A quoted GUID is an `Edm.String`, and the server refuses the comparison.     |
| `dateFields`       | A day goes as a bare `YYYY-MM-DD`. An instant is an `Edm.DateTimeOffset`, which an `Edm.Date` refuses. |
| `collections`      | `services.serviceId` means any element: `services/any(s: s/serviceId in (…))`.                         |
| `normalizedFields` | A text condition moves to the folded twin with a folded needle, as `searchFields` does for search.     |

A negated condition on a list (`notIn`, `notContains`) negates the whole lambda. "Has no
service in (a)" is `not services/any(…)`, never "has some service other than a".

## What it does not do

- **No remote grouping.** `$apply=groupby` returns group rows and no contents;
  assembling a `GroupResult` tree needs a second request per expanded group, and
  no consumer issues one. A grouped request sends its group fields as an
  `$orderby` prefix — what the local engine does too — so rows arrive in group
  order and the consumer groups them. Reported through `onUnsupported`.
- **No `loadChildren`.** A lazy hierarchy has no single OData shape, and the only
  consumer that wants one (`@ui/tree`) has no OData endpoint yet.
- **It does not follow `@odata.nextLink`.** Every consumer pages by offset and a
  cursor cannot answer "page 7". The link is still read, as the plainest evidence
  of `hasMore`.
- **No custom aggregate.** It has no OData form, so it is reported rather than
  dropped in silence.

## Two forms that look right and are not

- **`raw()` is a value, not a filter.** `filter: raw('false')` serializes as
  `type eq 'raw' and value eq 'false'`. An impossible condition travels as the
  plain string `'false'`, which `odata-query` passes through.
- **A `Date` must not be pre-serialized.** `odata-query` emits a `Date` as the
  unquoted instant `Edm.DateTimeOffset` expects. Converting it to a string first
  makes it a quoted **string literal** — a different type and a different
  comparison. `serializeDate` exists for an endpoint that genuinely wants one.

## An impossible filter matches nothing

`in ()` is not valid OData, and simply dropping the condition would mean
"match everything" — for a `byKeys([])` or a header filter with nothing ticked,
a wrong answer rather than a missing one. So an empty membership test becomes
`$filter=false`, an empty exclusion constrains nothing, and the two literals are
normalized through `and`, `or` and `not` rather than handed to `odata-query`'s
`not`, which reads a string operand as a member name.

## Tests

The unit specs assert the **emitted query string**, never the option object: the
string is what the server parses, so an assertion on the object would pass while
the wire was wrong.

`live-source.spec.ts` runs the same binding against a real endpoint and is
skipped unless the stack is up:

```bash
ODATA_LIVE=1 npx nx test shared-data-access-odata-source --skip-nx-cache
```

It reads `roles/odata`, and expects `odata-probe@example.com` on the staff of one
company (`aaaa0000-0000-4000-8000-00000000cafe`) with a `company_admin` grant, and
the seeded system roles. The API resolves the company from the account.
It is the only test that proves the queries are ones a real server accepts, which
no fake can.

# shared-ui-data-source

The transport-free data and identity contract every data-bound control in the
library consumes. Import from `@ui/data-source`.

There is no Angular, RxJS, HTTP or query-language import in this lib, and there
must never be one: a control that imports the contract must not gain a transport
dependency. A binding to a real transport is a **sibling** lib that implements
`DataSource<T>`, never a deep import from here.

## The Nx tag is `type:util`, not `type:ui`

Deliberate, and it must stay that way. A transport binding is tagged
`type:data-access`, and the module boundary in `eslint.config.mjs` lets
`type:data-access` depend only on `type:util` and `type:data-access`. Tagged
`type:ui`, this lib could not be implemented by the very libs that exist to
implement it.

The tag is also the honest one: the lib is framework-free by construction and
its Vitest environment is `node` with no Angular plugin, the same discipline
`@synax/client/core` keeps. `@ui/` in the import alias names the audience —
every data-bound control — not the layer.

```ts
const roles: DataSource<Role> = {
  load: ({ search, skip = 0, take = 20, signal }) =>
    api.searchRoles({ search, skip, take, signal }),
  byKeys: (keys, signal) => api.rolesByIds(keys, signal),
};
```

## Capabilities are optional methods

`load()` is the whole required surface. Everything else is a capability, and its
**presence is the declaration** — there is no separate feature flag to keep in
sync with the implementation:

| Method         | Who needs it                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `load`         | everyone                                                                                          |
| `byKeys`       | any control whose value is a key: it must show the label for id 42 without loading the collection |
| `loadChildren` | a lazy hierarchy — one level per call, `null` is the root                                         |
| `loadDistinct` | the value domain of one field, for a header filter                                                |

A control checks for the method and degrades when it is absent, rather than
failing. `@ui/autocomplete` retains a value it cannot resolve and says so.

## Errors are rejections, `Result` stays out

`load()` may reject; the calling store turns the rejection into state. Keeping
`Result<T, HttpError>` out of the signature is what keeps the contract free of
`@synax` — a binding converts a failed `Result` into a rejection carrying the
`HttpError`.

## Keys

`KeySpec<T>` is a field name, a dot path, a list of fields for a composite key,
or a function. `createKeyGetter` compiles it once; `keyTypeOf` reports the
declared wire type (`string` | `int` | `bigint` | `uuid`) so a binding can
serialize a GUID key correctly; `keyFields` reports the fields a projection must
keep. `serializeKey` is the stable string form for maps and DOM tracking.

## Cancellation

`abortReason`, `throwIfAborted` and `withAbort` normalize the platform
`AbortSignal`: the reason is always an `Error` (`AbortSignal.reason` is `any`,
and a rejection that carries something else fails
`prefer-promise-reject-errors`), and `withAbort` rejects the moment the signal
fires whether or not the underlying promise ever settles — so a source that
ignores its signal cannot hold a control open. `@ui/autocomplete` and
`@ui/select` share these rather than each keeping a copy.

## Naming: the result says `rows`

`items` is better vocabulary for a list. `QueryResult.rows` has been public API
of `@ui/datagrid` since M0, and renaming it would break every host that wrote a
data source **and** stop `GridDataSource<T>` from being a `DataSource<T>`
subtype, which is the point of having one contract. So `LoadResult.rows` means
"rows in the grid's sense, items in a list's". A deliberate naming wart,
recorded so nobody re-opens it.

## An array is a source

`createArraySource` satisfies the contract in full, so a control bound to a
collection and a control bound to an endpoint run one code path, not two.

```ts
const roles = createArraySource(ROLES, { key: 'id', searchText: (role) => role.name });
```

Capabilities follow what is declared, and nothing is guessed: `key` is what
gives it `byKeys`, and `parentKey` is what gives it `loadChildren`. Leave
`parentKey` out and the capability is absent on purpose — `@ui/tree` reads a
source without `loadChildren` once and nests it in memory, which is the right
shape for an array.

## Local operations are first-class

Any control may run any operation in memory while bound to a remote source.
`withLocalOperations` is a wrapper around a `DataSource`, not a feature of one
control, so a host can put it on or take it off without touching the control:

```ts
// An endpoint that filters but cannot sort the way this screen needs.
const source = withLocalOperations(roles, { filtering: true, sorting: false });
```

`true` is all-remote, `false` is "fetch and do everything here", and an object
mixes them. An operation the object does not name is local — the form says what
the endpoint can do, so silence means it cannot.

**`remoteMatrixWarning` is the honesty check.** Remote paging returns one page a
source has already ordered and narrowed, so a local sort orders each page on its
own and a local filter reports the page's size as the total. The layer cannot
repair that without fetching everything, so it says so. It returns a string
rather than logging: this lib has no framework and therefore no `isDevMode`, so
the caller decides when it is in development and how it reports.

## Text folding

Every local text comparison folds case and diacritics first — `foldText` is the
client half of the server's `lower(unaccent(t))`. That is what lets `Αθηνα`
match `Αθήνα` in a search box, and it is why a transport binding must fold its
needle and point it at a normalized column: a local result and a remote result
have to answer one query the same way.

`foldText` is for matching only. It is not `unaccent` exactly — that is
dictionary-driven and rewrites a few characters NFD does not decompose — so
never build an equality or a key on it.

## Not here yet

`@data/odata-source`, the transport binding, which is what will make any of
these capabilities reach a server.

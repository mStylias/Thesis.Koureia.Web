# Synax client

Client library for APIs built with **Synax.AspNetCore** + **Synax.Results**. It mirrors the
server's philosophy on the client: results are values, never exceptions used for flow
control. [DESIGN.md](./DESIGN.md) carries the full design; [client/README.md](./client/README.md)
is the usage guide.

## Two projects, not one

The library has two entry points, and they are two Nx projects so the boundary between them
is enforced rather than merely intended:

| Import               | Project                         | Contents                                                                                                                                                                                                             |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@synax/client/core` | `shared-data-access-synax-core` | Transport-free. No Angular, no rxjs. `Result`, `HttpError` + `parseHttpError`, validation-error and property-path helpers, `PagedResult`/`KeysetPage`/OData wire types, OData query building, synthetic error codes. |
| `@synax/client`      | `shared-data-access-synax`      | The Angular layer. RxJS operators that plug into your own `HttpClient` calls (never a wrapper around it), URL helpers, signal-based paginators, and the error-message registry.                                      |

`core` is the one that has to stay framework-free — that is what lets the wire contract be
reused anywhere and keeps it cheap to test. Its project is configured to match: no Angular
Vite plugin, a `node` test environment rather than `jsdom`, and no Angular ESLint config. An
Angular import added to `core` breaks its own build before it can reach a consumer.

Framework-free is not the same as dependency-free: `core` depends on
[`odata-query`](https://github.com/techniq/odata-query) for query building, which pulls in
only `tslib` and imports no framework.

`client` depends on `core`. Nothing depends the other way.

## Using it

```ts
import { Result, HttpError, KeysetPage } from '@synax/client/core';
import { toResult, provideSynaxApi, injectSynaxUrl } from '@synax/client';
```

Register the API base once, in the app config:

```ts
provideSynaxApi({ baseUrl: environment.apiUrl, defaultVersion: 1 });
```

See [client/README.md](./client/README.md) for the operators, pagination sources, OData
helpers, validation-error placement and the error-message registry.

## Relationship to upstream

The source of truth is the standalone `Synax.Client` repository; this is a vendored copy
adapted to Nx. Local deviations:

- **OData query building delegates to `odata-query` and completes its Synax-specific gaps.**
  Upstream's hand-rolled `odataParams(query): Record<string, string>` is replaced by
  `odataQueryString(query): string`. `ODataQuery<T>` uses that package's full option set, narrows
  `transform` to a checked `Transform<T>`, and adds the `$compute` option the package does not
  serialize. `ODataPage` also models the backend's annotations and server-driven next link. The
  motivation is literal escaping — upstream's `filter?: string` left callers concatenating user
  input into OData expressions, which breaks on the first apostrophe.

- The two ESLint overrides in `client/eslint.config.mjs` and `core/eslint.config.mjs`, each
  commented with its reason — this workspace lints under `strictTypeChecked`, which upstream
  does not.
- `describeError` in `client/src/lib/http-error-mapping.ts`, which returns a fixed sentence
  for values with no useful string form instead of `'[object Object]'`.
- Specs import their own entry point relatively (`../index`) rather than by alias, as Nx
  requires within a project.

Swapping to a published `@synax/client` package would be a `tsconfig.base.json` path change
for everything except the OData surface, which would need this change carried upstream or
re-applied as a local wrapper.

## Development

```bash
nx run-many -t lint test -p shared-data-access-synax shared-data-access-synax-core
```

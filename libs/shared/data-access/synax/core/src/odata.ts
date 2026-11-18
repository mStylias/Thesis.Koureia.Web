import buildQuery, { type QueryOptions, type Transform } from 'odata-query';

/**
 * One page of an OData-queried collection. The server always sends `value`. It can also send
 * `@odata.count`, `@odata.nextLink`, and `@odata.context` when the endpoint enables them.
 *
 * Rows are the query's element type, except where `$select`, `$expand`, `$apply`, or response
 * annotations reshape them. Type those calls as `ODataPage<ODataRow>`.
 */
export interface ODataPage<T> {
  /** The metadata fragment that describes this payload. */
  '@odata.context'?: string;
  /** The items matching the query. */
  value: T[];
  /** The total count across all pages; present only when the client sent `$count=true`. */
  '@odata.count'?: number;
  /** The next server-driven page. Follow this URL without rebuilding its cursor. */
  '@odata.nextLink'?: string;
}

/** A reshaped or annotated row, keyed with the camel-cased EDM member names. */
export type ODataRow = Record<string, unknown> & {
  '@odata.id'?: string;
  '@odata.type'?: string;
};

/** The OData page in client vocabulary, with protocol links and context retained when present. */
export interface ODataResult<T> {
  /** The items matching the query. */
  items: T[];
  /** The total count across all pages, or `null` when `$count=true` was not requested. */
  totalCount: number | null;
  /** The metadata fragment that describes this payload. */
  context?: string;
  /** The next server-driven page. Follow this URL without rebuilding its cursor. */
  nextLink?: string;
}

/** Normalizes the OData wire envelope into an {@link ODataResult}. */
export function odataResult<T>(page: ODataPage<T>): ODataResult<T> {
  return {
    items: page.value ?? [],
    totalCount: page['@odata.count'] ?? null,
    ...(page['@odata.context'] === undefined ? {} : { context: page['@odata.context'] }),
    ...(page['@odata.nextLink'] === undefined ? {} : { nextLink: page['@odata.nextLink'] }),
  };
}

/**
 * A `$apply` value. Structured values use `odata-query`'s checked transform model. A string is
 * available for server transformations that package cannot model, such as `compute(...)`.
 */
export type ODataTransform<T> = Transform<T> | Transform<T>[] | string;

/**
 * OData query options, parameterized by the row shape `T`.
 *
 * CAUTION: `T` documents the query's subject. It does not police it. `Filter<T>` unions its
 * typed form with an open `PlainObject` and `Select<T>` with a plain `string[]`, so a
 * misspelled member compiles and then fails at runtime as `400 INVALID_ODATA_QUERY`. Test
 * query-building code.
 *
 * The option set is wider than any endpoint accepts. Synax endpoints opt into `$search`,
 * `$compute`, `$apply`, and server-driven paging separately. A rejected query is a `400`, not a
 * type error.
 */
export type ODataQuery<T = unknown> = Omit<Partial<QueryOptions<T>>, 'transform'> & {
  /** `$apply`, named `transform` to match `odata-query`. */
  transform?: ODataTransform<T>;
  /** A top-level `$compute` expression. */
  compute?: string;
};

/**
 * Checks a structured `$apply` value against `Transform<T>` before `odata-query` widens it to an
 * unchecked object.
 */
export function odataTransform<T>(transform: Transform<T>): Transform<T>;
export function odataTransform<T>(transform: Transform<T>[]): Transform<T>[];
export function odataTransform<T>(
  transform: Transform<T> | Transform<T>[],
): Transform<T> | Transform<T>[] {
  return transform;
}

/**
 * Serializes an {@link ODataQuery} into the `?$`-prefixed query string to append to the
 * endpoint URL:
 *
 * ```ts
 * this.http.get<ODataPage<RestaurantResponse>>(
 *   url + odataQueryString({ filter: { name: { contains: term } }, top: 20, count: true }),
 * );
 * // -> /restaurants/search?$filter=contains(name,'Tav')&$count=true&$top=20
 * ```
 *
 * Prefer a structured `filter` to a hand-written string. Values are quoted and escaped, so
 * `O'Brien` becomes `contains(name,'O''Brien')` and not a malformed expression.
 *
 * Returns `''` for an empty query, so appending is always safe.
 *
 * CAUTION: Append the result to the URL. Never pass it to `HttpClient`'s `params`. The string
 * is already partly percent-encoded, and `HttpParams` encodes it a second time. The server
 * then reads `Tav Barbers` as `Tav%20Barbers`.
 */
export function odataQueryString<T>(query: ODataQuery<T>): string {
  const { compute, transform, ...options } = query;
  const queryString = buildQuery<T>({
    ...options,
    transform: typeof transform === 'string' ? undefined : transform,
  });

  return appendQueryOptions(queryString, [
    ['$apply', typeof transform === 'string' ? transform : undefined],
    ['$compute', compute],
  ]);
}

function appendQueryOptions(
  query: string,
  options: readonly (readonly [name: string, value: string | undefined])[],
): string {
  return options.reduce(
    (result, [name, value]) =>
      value === undefined || value === ''
        ? result
        : `${result}${result.includes('?') ? '&' : '?'}${name}=${value}`,
    query,
  );
}

/**
 * `odata-query`'s building blocks, re-exported so consumers need no direct dependency.
 *
 * The value wrappers cover literals OData spells differently from JavaScript. `guid(id)` emits
 * a bare GUID and not a quoted string. `raw(expr)` passes an expression through.
 */
export {
  alias,
  binary,
  decimal,
  duration,
  escapeIllegalChars,
  escapeODataStringLiteral,
  guid,
  json,
  raw,
  StandardAggregateMethods,
} from 'odata-query';

export type {
  Aggregate,
  Alias,
  Binary,
  Decimal,
  Duration,
  Expand,
  ExpandOptions,
  Filter,
  GroupBy,
  Guid,
  Json,
  OrderBy,
  PlainObject,
  QueryOptions,
  Raw,
  Select,
  Transform,
  Value,
} from 'odata-query';

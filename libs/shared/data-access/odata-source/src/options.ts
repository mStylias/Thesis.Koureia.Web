/**
 * What the binding is told about the endpoint it talks to.
 *
 * Every advanced capability is **opt-in and off by default**, because a Synax endpoint
 * rejects a query option it did not enable and the rejection is a `400` at run time, not a
 * type error. The default therefore sends only the base surface, which every endpoint
 * answers.
 */
import type { KeySpec } from '@ui/data-source';
import type { HttpError, ODataQuery, ODataResult, ODataRow, Result } from '@synax/client/core';
import type { Observable } from 'rxjs';

/**
 * Issues one request and reports the outcome as data.
 *
 * The app supplies this; the library never calls HTTP itself. It is an `Observable` rather
 * than a promise because **unsubscribing is what cancels an `HttpClient` request** — with a
 * promise the contract's `signal` could only stop the caller listening, not stop the request.
 *
 * `@synax/client`'s own `ODataFetch` satisfies this shape:
 *
 * ```ts
 * fetch: (query) =>
 *   this.http
 *     .get<ODataPage<ODataRow>>(this.url('roles/search') + odataQueryString(query))
 *     .pipe(toODataResult()),
 * ```
 */
export type ODataSourceFetch<T> = (
  query: ODataQuery<T>,
) => Observable<Result<ODataResult<ODataRow>, HttpError>>;

/**
 * What the endpoint opted into. Each flag maps to one server-side switch, and each one
 * absent means the binding degrades rather than sends a query that would be refused.
 */
export interface ODataCapabilities {
  /**
   * `Searchable<T>(...)` is declared, so `$search` is answered.
   *
   * Without it a `search` becomes an `or` of `contains` over {@link ODataSourceOptions.searchFields}.
   */
  search?: boolean;
  /**
   * `EnableApply`, so `$apply` is answered.
   *
   * This is the one capability with no base-surface equivalent. Without it the source
   * **does not declare `loadDistinct` at all** and reports no aggregates, so a consumer
   * falls through to whatever local path it has instead of breaking.
   */
  apply?: boolean;
  /**
   * `EnableCompute`, so `compute(...)` inside `$apply` is answered.
   *
   * Without it a distinct request cannot bucket by a date part: `interval` is ignored and
   * raw values come back.
   */
  compute?: boolean;
  /**
   * The server's `MaxTop`. Default **100**, which is `AddSynaxOData()`'s own default.
   *
   * A `take` beyond it is paged internally and concatenated, because the shared contract
   * says `load` honors the window it is given. Without that, a full-dataset export asks for
   * 1000 rows, receives the server's 100, reads the short page as the end of the result, and
   * reports success on a truncated file.
   */
  maxTop?: number;
}

/** Resolved capabilities: every flag decided, so no call site repeats a default. */
export interface ResolvedCapabilities {
  readonly search: boolean;
  readonly apply: boolean;
  readonly compute: boolean;
  readonly maxTop: number;
}

/** `AddSynaxOData()`'s own default cap on `$top`. */
export const DEFAULT_MAX_TOP = 100;

/** How many keys one `byKeys` request carries before it is split. */
export const DEFAULT_KEY_BATCH_SIZE = 200;

export interface ODataSourceOptions<T> {
  /** Issues one request. See {@link ODataSourceFetch}. */
  fetch: ODataSourceFetch<T>;

  /**
   * Item identity. `type: 'uuid'` is what makes a key serialize as a bare GUID rather than
   * a quoted string, which the server rejects.
   */
  key: KeySpec<T>;

  /** What the endpoint answers. Everything defaults to off. */
  capabilities?: ODataCapabilities;

  /**
   * Fields a free-text `search` scans when `$search` is not available.
   *
   * **Name the normalized column, not the display column.** The server's `contains` emits a
   * bare `LIKE` with no `lower()`, so it is case- and accent-sensitive; only a folded column
   * matches the folded needle this binding sends. A generated
   * `name_normalized = lower(unaccent(name))` column is what makes local and remote search
   * answer the same query the same way.
   *
   * With none declared, a `search` is dropped and reported once.
   */
  searchFields?: readonly string[];

  /**
   * Rewrites a contract field into its OData path. Defaults to turning dots into slashes,
   * so `customer.name` addresses `customer/name`.
   */
  fieldPath?: (field: string) => string;

  /**
   * Serializes a `Date` in a filter.
   *
   * Leave it out unless the endpoint wants something else. By default a `Date` travels
   * untouched and `odata-query` emits the unquoted instant `Edm.DateTimeOffset` expects.
   * Returning a string here makes it a quoted **string literal** instead, which is a
   * different type and a different comparison — right for a date-as-text column, wrong for a
   * real one.
   */
  serializeDate?: (value: Date) => unknown;

  /**
   * Fields that hold GUIDs, by contract name (`customerId`, `services.serviceId`). Their string
   * values travel bare. A quoted GUID is an `Edm.String`, which the server refuses to compare
   * with an `Edm.Guid`.
   */
  guidFields?: readonly string[];

  /**
   * Fields that hold a calendar day (`Edm.Date`), by contract name. A `Date` or a `YYYY-MM-DD`
   * string travels as the bare day, read from the local parts the grid's day editor builds. An
   * instant there is an `Edm.DateTimeOffset`, which the server refuses to compare with a date.
   */
  dateFields?: readonly string[];

  /**
   * Members that are lists of records. A condition on `services.serviceId` means "any element",
   * sent as `services/any(s: s/serviceId in (…))`. `notIn` and `notContains` negate the whole
   * lambda.
   */
  collections?: readonly string[];

  /**
   * Folded twins of text fields, as `{ cancellationReason: 'cancellationReasonNormalized' }`.
   * A text condition on the field goes to the twin with a folded needle, so it ignores case and
   * accents. Same reason as {@link searchFields}: the server's `contains` is a bare `LIKE`.
   */
  normalizedFields?: Readonly<Record<string, string>>;

  /** Keys per `byKeys` request. Default 200. */
  keyBatchSize?: number;

  /**
   * Reports a query the binding could not send in full — a dropped search, an aggregate with
   * no OData form. Called once per occurrence, so a host can log rather than guess why a
   * value is missing. Absent means silence.
   */
  onUnsupported?: (report: UnsupportedReport) => void;
}

/** Something the endpoint's declared capabilities could not express. */
export interface UnsupportedReport {
  /** What was asked for. */
  readonly facet: 'search' | 'aggregate' | 'interval' | 'grouping';
  /** Why it could not be sent, in one sentence. */
  readonly reason: string;
}

/** Fills in every capability, so the rest of the binding reads no defaults. */
export function resolveCapabilities(capabilities?: ODataCapabilities): ResolvedCapabilities {
  return {
    search: capabilities?.search ?? false,
    apply: capabilities?.apply ?? false,
    compute: capabilities?.compute ?? false,
    maxTop:
      capabilities?.maxTop !== undefined && capabilities.maxTop > 0
        ? Math.floor(capabilities.maxTop)
        : DEFAULT_MAX_TOP,
  };
}

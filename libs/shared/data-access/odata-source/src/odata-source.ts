/**
 * An OData endpoint as a `DataSource`.
 *
 * The transport half of the shared data-source layer: it translates the transport-free
 * request every data-bound control already speaks into OData query options, and nothing in
 * `libs/shared/ui` gains a dependency on this lib or on `@synax`.
 */
import {
  createKeyGetter,
  keyFields,
  serializeKey,
  type DataKey,
  type DataSource,
  type DistinctRequest,
  type DistinctResult,
  type DistinctValue,
  type LoadRequest,
  type LoadResult,
} from '@ui/data-source';
import { odataTransform, type ODataQuery, type ODataRow } from '@synax/client/core';
import { readWindow, runQuery } from './fetch';
import {
  DEFAULT_KEY_BATCH_SIZE,
  resolveCapabilities,
  type ODataSourceOptions,
  type UnsupportedReport,
} from './options';
import { odataPath, splitProjection } from './translate/field';
import { toODataFilter, type FilterContext, type ODataFilter } from './translate/filter';
import {
  groupOrderBy,
  toAggregate,
  toKeyFilter,
  toOrderBy,
  toSearchFilter,
  type AggregateRequest,
} from './translate/query-parts';

/**
 * A request wide enough for a grid: everything a `LoadRequest` carries, plus the two facets
 * only a grid asks for. Declared structurally so this lib depends on no control.
 */
interface WideRequest extends LoadRequest {
  group?: readonly { field: string; desc?: boolean }[];
  aggregates?: readonly AggregateRequest[];
}

/** A result wide enough for a grid. */
interface WideResult<T> extends LoadResult<T> {
  aggregates?: Readonly<Record<string, unknown>>;
}

/**
 * Builds a `DataSource<T>` over an OData endpoint.
 *
 * ```ts
 * readonly roles = odataSource<RoleODataResponse>({
 *   fetch: (query) =>
 *     this.http
 *       .get<ODataPage<ODataRow>>(this.url('roles/search') + odataQueryString(query))
 *       .pipe(toODataResult()),
 *   key: { selector: 'id', type: 'uuid' },
 *   capabilities: { maxTop: 100 },
 *   searchFields: ['nameNormalized'],
 * });
 * ```
 *
 * Capabilities are off by default, so the source sends only the base surface every endpoint
 * answers. `loadDistinct` is **absent** unless `apply` is declared — a consumer then falls
 * through to its own local path instead of breaking on a `400`.
 */
export function odataSource<T>(options: ODataSourceOptions<T>): DataSource<T> {
  const capabilities = resolveCapabilities(options.capabilities);
  const path = options.fieldPath ?? odataPath;
  const filterContext: FilterContext = {
    path,
    ...(options.serializeDate === undefined ? {} : { date: options.serializeDate }),
    guidFields: new Set(options.guidFields ?? []),
    dateFields: new Set(options.dateFields ?? []),
    collections: options.collections ?? [],
    normalizedFields: options.normalizedFields ?? {},
  };
  const keyOf = createKeyGetter(options.key);
  const fields = keyFields(options.key);
  const batchSize = Math.max(1, options.keyBatchSize ?? DEFAULT_KEY_BATCH_SIZE);
  const report = (facet: UnsupportedReport['facet'], reason: string): void => {
    options.onUnsupported?.({ facet, reason });
  };

  /** The `$filter` for one request: the user's tree and the search, combined. */
  const filterFor = (request: WideRequest): ODataFilter | undefined => {
    const tree = toODataFilter(request.filter, filterContext);
    const search = searchFor(request);
    if (search === undefined) {
      return tree;
    }
    if (tree === undefined) {
      return search;
    }
    if (tree === 'false' || search === 'false') {
      return 'false';
    }
    const parts = [tree, search].filter((part) => part !== 'true');
    return parts.length === 0 ? 'true' : parts.length === 1 ? parts[0] : { and: parts };
  };

  /** The search half, as `$search` where the endpoint answers it or a `contains` tree. */
  const searchFor = (request: WideRequest): ODataFilter | undefined => {
    const term = request.search?.trim() ?? '';
    if (term === '' || capabilities.search) {
      // `$search` travels as its own option, not as a filter. It is added in `buildQuery`.
      return undefined;
    }
    const translated = toSearchFilter(request.search, options.searchFields);
    if (translated === undefined) {
      report(
        'search',
        'the endpoint declares no $search and the source declares no searchFields, so the ' +
          'search was dropped',
      );
    }
    return translated;
  };

  /** Assembles one row query. */
  const buildQuery = (
    request: WideRequest,
    window: { skip: number; take?: number },
  ): ODataQuery<T> => {
    const query: ODataQuery<T> = {};

    const filter = filterFor(request);
    if (filter !== undefined) {
      query.filter = filter;
    }

    const term = request.search?.trim() ?? '';
    if (term !== '' && capabilities.search) {
      // Not folded: `$search` has a grammar of its own, and lowercasing it would turn the
      // `OR` and `AND` operators into search terms. Matching is the server's business here.
      query.search = term;
    }

    // Group fields lead the ordering, exactly as the local engine does, so rows arrive in
    // group order for a consumer that groups them itself.
    const grouped = groupOrderBy(request.group);
    const sorted = toOrderBy(request.sort) ?? [];
    const orderBy = [...grouped, ...sorted];
    if (orderBy.length > 0) {
      // One string, not an array: `OrderBy<T>` types its array form as `keyof T` entries, and
      // a nested path with a direction is only expressible as text.
      query.orderBy = orderBy.join(',');
    }
    if (grouped.length > 0) {
      report(
        'grouping',
        'the endpoint cannot return grouped contents in one request, so the group fields ' +
          'were sent as an ordering and the rows must be grouped locally',
      );
    }

    const projection = splitProjection(request.select, request.expand);
    if (projection.select.length > 0) {
      query.select = projection.select as string[];
    }
    if (projection.expand.size > 0) {
      // `Expand<T>` maps over `keyof T`, so a dictionary built from strings cannot satisfy it
      // even though it is exactly what `buildQuery` serializes. The member names come from the
      // consumer's projection, and a wrong one comes back as a 400 either way.
      query.expand = Object.fromEntries(
        [...projection.expand].map(([entity, members]) => [
          entity,
          members.length === 0 ? {} : { select: members as string[] },
        ]),
      ) as ODataQuery<T>['expand'];
    }

    query.skip = window.skip;
    if (window.take !== undefined) {
      query.top = window.take;
    }
    if (request.requireTotalCount === true) {
      query.count = true;
    }

    return query;
  };

  /** The aggregates, as a second request. `$apply` replaces the result set, so it cannot share one. */
  const loadAggregates = async (
    request: WideRequest,
  ): Promise<Readonly<Record<string, unknown>> | undefined> => {
    const requested = request.aggregates ?? [];
    if (requested.length === 0) {
      return undefined;
    }
    if (!capabilities.apply) {
      report(
        'aggregate',
        'the endpoint does not enable $apply, so no aggregate was requested; a local total ' +
          'over one page would be page-local rather than dataset-wide',
      );
      return undefined;
    }

    const translation = toAggregate(requested, path);
    for (const unsupported of translation.unsupported) {
      report(
        'aggregate',
        `'${unsupported.type}' has no OData form, so the ${unsupported.field} aggregate was ` +
          'not requested',
      );
    }
    if (translation.transform === undefined) {
      return undefined;
    }

    const query: ODataQuery<T> = { transform: odataTransform<T>(translation.transform) };
    const filter = filterFor(request);
    if (filter !== undefined) {
      // Inside the transform, never beside it: a sibling `$filter` applies to the aggregated
      // result and answers a different question.
      query.transform = odataTransform<T>([{ filter }, translation.transform]);
    }

    const page = await runQuery(options.fetch, query, request.signal);
    const row = page.items[0];
    if (row === undefined) {
      return undefined;
    }
    const values: Record<string, unknown> = {};
    for (const [alias, key] of translation.aliases) {
      if (alias in row) {
        values[key] = row[alias];
      }
    }
    return values;
  };

  const source: DataSource<T> = {
    load: async (request: LoadRequest): Promise<LoadResult<T>> => {
      const wide = request as WideRequest;
      const window = {
        skip: request.skip ?? 0,
        ...(request.take === undefined ? {} : { take: request.take }),
      };

      const [page, aggregates] = await Promise.all([
        readWindow(
          options.fetch,
          (current) => buildQuery(wide, current),
          window,
          capabilities,
          request.signal,
        ),
        loadAggregates(wide),
      ]);

      const result: WideResult<T> = {
        rows: page.rows as readonly T[],
        ...(page.totalCount === null ? {} : { totalCount: page.totalCount }),
        // A server-driven next link is the plainest evidence of more. Failing that, a window
        // that came back full is.
        hasMore:
          page.nextLink !== undefined ||
          (page.totalCount !== null
            ? window.skip + page.rows.length < page.totalCount
            : window.take !== undefined && page.rows.length >= window.take),
        ...(aggregates === undefined ? {} : { aggregates }),
      };
      return result;
    },

    byKeys: async (keys: readonly DataKey[], signal?: AbortSignal): Promise<readonly T[]> => {
      if (keys.length === 0) {
        return [];
      }
      if (fields.length === 0) {
        throw new Error(
          'odata-source: byKeys needs a field-based key. A function selector names no field ' +
            'to filter on, so declare `key` as a field or a list of fields.',
        );
      }

      const found = new Map<string, T>();
      for (let index = 0; index < keys.length; index += batchSize) {
        const batch = keys.slice(index, index + batchSize);
        const filter = toKeyFilter(batch, options.key, fields, path);
        const query: ODataQuery<T> = { filter, top: batch.length };
        const page = await readWindow(
          options.fetch,
          (current) => ({ ...query, skip: current.skip, top: current.take ?? batch.length }),
          { skip: 0, take: batch.length },
          capabilities,
          signal,
        );
        for (const row of page.rows) {
          const item = row as T;
          found.set(serializeKey(keyOf(item)), item);
        }
      }
      // Returned in the order asked for, so a caller can pair keys with items positionally.
      return keys
        .map((key) => found.get(serializeKey(key)))
        .filter((item): item is T => item !== undefined);
    },
  };

  if (capabilities.apply) {
    source.loadDistinct = (request: DistinctRequest): Promise<DistinctResult> =>
      loadDistinct(request);
  }

  /**
   * The value domain of one field, as `$apply=filter(pre)/groupby((f),aggregate($count as n))`.
   *
   * The pre-group filter goes **inside** the transform. A sibling `$filter` runs after the
   * grouping and answers a different question — how many groups match — which is not what a
   * header filter is asking.
   *
   * No `$count`: combined with `$apply` it counts groups unreliably, so the caller pages by
   * asking for one more entry than it shows.
   */
  async function loadDistinct(request: DistinctRequest): Promise<DistinctResult> {
    const field = path(request.field);
    if (request.interval !== undefined && !capabilities.compute) {
      report(
        'interval',
        'the endpoint does not enable compute, so the values come back unbucketed and the ' +
          'consumer must bucket them itself',
      );
    }

    const grouping = {
      groupBy: { properties: [field], transform: { aggregate: '$count as count' } },
    };
    const pre = toODataFilter(request.filter, filterContext);
    const searchFilter = toSearchFilter(request.search, [request.field]);
    const narrowing = [pre, searchFilter].filter(
      (part): part is ODataFilter => part !== undefined && part !== 'true',
    );

    const query: ODataQuery<T> = {
      transform:
        narrowing.length === 0
          ? odataTransform<T>(grouping as never)
          : odataTransform<T>([
              { filter: narrowing.length === 1 ? narrowing[0] : { and: narrowing } },
              grouping,
            ] as never),
      orderBy: field,
      skip: request.skip ?? 0,
    };
    if (request.take !== undefined) {
      query.top = request.take;
    }

    const page = await runQuery(options.fetch, query, request.signal);
    const values: DistinctValue[] = page.items.map((row) => {
      const count = row['count'];
      return {
        value: readGrouped(row, field),
        ...(typeof count === 'number' ? { count } : {}),
      };
    });

    return {
      values,
      ...(request.take === undefined ? {} : { hasMore: values.length >= request.take }),
    };
  }

  return source;
}

/**
 * Reads the grouped member out of an aggregation row.
 *
 * A grouped path comes back nested — `groupby((customer/name))` answers
 * `{ customer: { name: ... } }` — so the slashes are walked rather than read as one key.
 */
function readGrouped(row: ODataRow, field: string): unknown {
  if (!field.includes('/')) {
    return row[field];
  }
  let current: unknown = row;
  for (const segment of field.split('/')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

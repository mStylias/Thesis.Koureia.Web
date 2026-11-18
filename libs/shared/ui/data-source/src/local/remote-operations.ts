/**
 * The hybrid matrix: which operations the source performs, and which the
 * consumer runs over what came back.
 *
 * This is a wrapper around a `DataSource`, not a feature of one control, so it
 * works for a list, a tree and a grid identically, and a host can put it on or
 * take it off without touching the control.
 */
import type { DataSource, LoadRequest, RemoteOperations } from '../data-source.types';
import { applyLoadRequest, type LocalEngineOptions } from './apply-request';

const ALL_REMOTE: Required<RemoteOperations> = {
  filtering: true,
  sorting: true,
  grouping: true,
  paging: true,
  aggregation: true,
  search: true,
};

const ALL_LOCAL: Required<RemoteOperations> = {
  filtering: false,
  sorting: false,
  grouping: false,
  paging: false,
  aggregation: false,
  search: false,
};

/** Fills in the matrix. `true` is all remote, `false` is all local. */
export function normalizeRemote(
  remote: boolean | RemoteOperations | undefined,
): Required<RemoteOperations> {
  if (remote === undefined || remote === true) {
    return ALL_REMOTE;
  }
  if (remote === false) {
    return ALL_LOCAL;
  }
  return { ...ALL_LOCAL, ...remote };
}

/**
 * The request member each operation owns.
 *
 * Grouping and aggregation name members no `LoadRequest` has. That is
 * deliberate: the split is generic over the request type, so a datagrid
 * `Query` — which does have them — splits correctly through the same code,
 * and a plain `LoadRequest` simply has nothing there to move.
 */
const OPERATION_MEMBER = {
  filtering: 'filter',
  search: 'search',
  sorting: 'sort',
  grouping: 'group',
  aggregation: 'aggregates',
} as const;

/**
 * Operations that must run before paging can pick a page out of the result.
 * Each one changes how many items there are or what order they come in.
 */
const PAGING_MEMBERS = ['skip', 'take', 'requireTotalCount'] as const;

const PRE_PAGING_OPERATIONS = [
  'filtering',
  'search',
  'sorting',
  'grouping',
  'aggregation',
] as const;

/**
 * Splits a request into the part the source is asked for and the part the
 * caller runs itself.
 *
 * Generic over the request so a wider descriptor keeps its own members.
 */
export function splitRequest<R extends LoadRequest>(
  request: R,
  remote: Required<RemoteOperations>,
): { outgoing: R; local: Partial<R> } {
  const local: Partial<R> = {};
  const held = new Set<string>();

  for (const [operation, member] of Object.entries(OPERATION_MEMBER)) {
    if (remote[operation as keyof RemoteOperations]) {
      continue;
    }
    const key = member as keyof R & string;
    if (request[key] == null) {
      continue;
    }
    local[key] = request[key];
    held.add(key);
  }

  if (!remote.paging) {
    for (const key of PAGING_MEMBERS) {
      if (request[key] != null) {
        local[key as keyof R] = request[key] as R[keyof R];
      }
      held.add(key);
    }
  }

  // Rebuilt by omission rather than by `delete`: the members are computed, and
  // a copy-then-delete leaves the deleted keys present-but-undefined on some
  // engines, which a source would then serialize as an empty facet.
  const outgoing = Object.fromEntries(
    Object.entries(request).filter(([key]) => !held.has(key)),
  ) as R;

  return { outgoing, local };
}

/**
 * Reports a matrix whose local half cannot produce dataset-wide results, or
 * `null` when the matrix is sound.
 *
 * Remote paging returns one page of a result the source has already ordered
 * and narrowed. An operation the caller then runs locally sees that page and
 * nothing else: a local sort orders each page on its own, and a local filter
 * shrinks the page and reports its size as the total. The layer cannot repair
 * this without fetching everything, so it says so instead.
 *
 * A string, not a `console.error`: this lib has no framework and therefore no
 * `isDevMode`. The caller decides whether it is in development and how it
 * reports. Losing the warning while generalizing the matrix would turn a loud
 * misconfiguration into a quiet wrong answer.
 */
export function remoteMatrixWarning(
  remote: Required<RemoteOperations>,
  label = 'data-source',
): string | null {
  if (!remote.paging) {
    return null;
  }
  const local = PRE_PAGING_OPERATIONS.filter((operation) => !remote[operation]);
  if (local.length === 0) {
    return null;
  }
  return (
    `${label}: remote paging needs remote ${local.join(', ')}. ` +
    'A local operation runs over one page, so its result is page-local rather than dataset-wide.'
  );
}

/**
 * Wraps a source so the operations the matrix marks local run here instead.
 *
 * ```ts
 * // An endpoint that filters but cannot sort the way this screen needs.
 * const source = withLocalOperations(roles, { filtering: true, sorting: false });
 * ```
 */
export function withLocalOperations<T>(
  source: DataSource<T>,
  remote: boolean | RemoteOperations,
  options?: LocalEngineOptions<T>,
): DataSource<T> {
  const matrix = normalizeRemote(remote);
  const wrapped: DataSource<T> = {
    load: async (request) => {
      const { outgoing, local } = splitRequest(request, matrix);
      const result = await source.load(outgoing);
      // Nothing was held back, so the source's own result stands — including
      // any total it reported, which a local pass could only re-derive worse.
      if (Object.keys(local).length === 0) {
        return result;
      }
      return applyLoadRequest(result.rows, local, options);
    },
  };
  if (source.byKeys !== undefined) {
    wrapped.byKeys = (keys, signal) => source.byKeys?.(keys, signal) ?? Promise.resolve([]);
  }
  if (source.loadChildren !== undefined) {
    wrapped.loadChildren = async (parent, request = {}) => {
      const { outgoing, local } = splitRequest(request, matrix);
      const result = await (source.loadChildren?.(parent, outgoing) ??
        Promise.resolve({ rows: [] as readonly T[] }));
      if (Object.keys(local).length === 0) {
        return result;
      }
      return applyLoadRequest(result.rows, local, options);
    };
  }
  if (source.loadDistinct !== undefined) {
    // Distinct is dataset-wide by definition. There is no local half of it to
    // run over a page, so it passes straight through.
    wrapped.loadDistinct = (request) =>
      source.loadDistinct?.(request) ?? Promise.resolve({ values: [] });
  }
  return wrapped;
}

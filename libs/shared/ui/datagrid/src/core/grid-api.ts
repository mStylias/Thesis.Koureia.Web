/**
 * The imperative API as one object.
 *
 * The grid exposes {@link GridApi} as a single value rather than as methods on
 * the component. A host that wraps the grid re-exposes one value in one line;
 * re-exposing methods costs one delegation per method and one more for every
 * method a later release adds.
 *
 * Methods belonging to a milestone that has not shipped are **present and
 * throw**, so the shape of the object is the final one from here and a wrapper
 * never has to test for an absent method.
 */
import { isDevMode } from '@angular/core';
import type { GridApi } from './types/api.types';
import type { ApplyStateReport } from './types/state.types';
import type {
  ImplementedApiMethod,
  GridApiHost,
  UnimplementedApiMethod,
  AsyncApiMethod,
  MutatingApiMethod,
} from './grid-api.types';

/**
 * Methods whose feature has not shipped. Each throws rather than being absent
 * or silently doing nothing, so a host discovers the gap at the call rather
 * than through an empty grid.
 */
export const UNIMPLEMENTED = [
  'startEdit',
  'commitEdit',
  'cancelEdit',
  'getPendingChanges',
] as const satisfies readonly Exclude<keyof GridApi, ImplementedApiMethod>[];

/** Which milestone ships each unimplemented method, named in its error. */
const MILESTONE: Readonly<Record<UnimplementedApiMethod, string>> = {
  startEdit: 'M6 (editing)',
  commitEdit: 'M6 (editing)',
  cancelEdit: 'M6 (editing)',
  getPendingChanges: 'M6 (editing)',
};

function unimplemented<TRow>(): Pick<GridApi<TRow>, UnimplementedApiMethod> {
  const entries = UNIMPLEMENTED.map(
    (name) =>
      [
        name,
        (): never => {
          throw new Error(
            `datagrid: GridApi.${name}() is not implemented yet — it ships with ${MILESTONE[name]}`,
          );
        },
      ] as const,
  );
  // Every entry is a throwing thunk, which no signature in `GridApi` matches.
  return Object.fromEntries(entries) as unknown as Pick<GridApi<TRow>, UnimplementedApiMethod>;
}

/**
 * Methods that change the grid, and are therefore inert after destruction.
 * `setState` is handled apart because it answers with a report.
 */
export const MUTATING = [
  'reload',
  'reset',
  'applyQuery',
  'refreshRow',
  'applyTransaction',
  'setColumnVisible',
  'setColumnWidth',
  'moveColumn',
  'pinColumn',
  'autoSizeColumns',
  'resetState',
  'openTemporaryView',
  'closeTemporaryView',
  'setFilter',
  'setColumnFilter',
  'clearColumnFilter',
  'clearFilters',
  'setSearch',
  'setSort',
  'setGroup',
  'expandGroup',
  'collapseGroup',
  'expandAllGroups',
  'collapseAllGroups',
  'expandRow',
  'collapseRow',
  'setSelectedKeys',
  'clearSelection',
  'selectAllMatching',
  'focusCell',
  'scrollToRow',
  'scrollToColumn',
  'setScrollPosition',
  'print',
  'repaint',
] as const satisfies readonly ImplementedApiMethod[];

/**
 * Methods that answer with a promise, and are therefore neutralized after
 * destruction rather than merely skipped: a caller awaiting one must not be
 * left hanging on a promise nothing resolves.
 */
export const ASYNC = [
  'export',
  'copyToClipboard',
] as const satisfies readonly ImplementedApiMethod[];

const DESTROYED_REPORT: ApplyStateReport = { applied: false, droppedColumnIds: [] };

/**
 * Builds the API object.
 *
 * Reads stay live after destruction — the stores outlive the view and their
 * last values are still the truthful answer. Writes become no-ops with a
 * development warning, which is what §19.2 asks for: a wrapper adds a render
 * tick between a host resolving its reference and the grid resolving its own,
 * so a late call is ordinary rather than a bug in the host.
 */
export function createGridApi<TRow>(
  host: GridApiHost<TRow>,
  isDestroyed: () => boolean,
): GridApi<TRow> {
  const alive = (method: string): boolean => {
    if (!isDestroyed()) {
      return true;
    }
    if (isDevMode()) {
      console.warn(`datagrid: GridApi.${method}() ignored — the grid was destroyed`);
    }
    return false;
  };

  // Assigning to `GridApi<TRow>` is the exhaustiveness check: a method missing
  // from both lists fails to compile here.
  const api: GridApi<TRow> = { ...host, ...unimplemented<TRow>() };

  const mutators = api as unknown as Record<MutatingApiMethod, (...args: never[]) => unknown>;
  for (const name of MUTATING) {
    const method = mutators[name];
    mutators[name] = (...args: never[]): unknown => (alive(name) ? method(...args) : undefined);
  }
  // Read off the host, which holds bound closures, rather than off `api`:
  // an unbound method reference would lose its receiver.
  const setState = host.setState;
  api.setState = (state): ApplyStateReport =>
    alive('setState') ? setState(state) : DESTROYED_REPORT;

  const asyncMethods = api as unknown as Record<
    AsyncApiMethod,
    (...args: never[]) => Promise<unknown>
  >;
  for (const name of ASYNC) {
    const method = asyncMethods[name];
    asyncMethods[name] = async (...args: never[]): Promise<unknown> =>
      // `copyToClipboard` answers whether it copied, so a destroyed grid
      // answers `false` rather than leaving the caller to read `undefined`.
      alive(name) ? method(...args) : name === 'copyToClipboard' ? false : undefined;
  }

  return api;
}

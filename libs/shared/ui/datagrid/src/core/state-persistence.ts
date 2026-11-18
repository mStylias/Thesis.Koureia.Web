/**
 * State persistence (§14.2).
 *
 * Persistence is an adapter, never built in: the default is that nothing is
 * saved. The library ships a local-storage adapter as a convenience, and an
 * application that keeps arrangements on a server implements the same two
 * methods against its own endpoint.
 *
 * ```ts
 * providers: [provideDatagridStatePersistence(localStorageStatePersistence())]
 * ```
 *
 * ```html
 * <lib-datagrid stateKey="bookings" … />
 * ```
 */
import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import type { GridState } from './types/state.types';
import type { GridStatePersistence } from './state-persistence.types';

/** Application-wide persistence, resolved when the grid binds no adapter. */
export const DATAGRID_STATE_PERSISTENCE = new InjectionToken<GridStatePersistence>(
  'DATAGRID_STATE_PERSISTENCE',
);

/**
 * Registers a persistence adapter for every grid beneath the injector. A grid
 * still needs a `stateKey` to say which arrangement is its own.
 */
export function provideDatagridStatePersistence(
  adapter: GridStatePersistence,
): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DATAGRID_STATE_PERSISTENCE, useValue: adapter }]);
}

/** Whether a parsed value can be a grid state. A migration hook judges the version. */
function isGridState(value: unknown): value is GridState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<GridState>;
  return typeof candidate.version === 'number' && Array.isArray(candidate.columns);
}

/**
 * Keeps arrangements in `localStorage` under `<prefix><id>`.
 *
 * Every access is guarded: storage is absent during server rendering, and a
 * browser can refuse it outright (private mode, a blocked origin, a full
 * quota). A refusal loses the arrangement, which is not a reason to take the
 * grid down with it.
 */
export function localStorageStatePersistence(options?: {
  prefix?: string;
  /** The store to use. Defaults to `localStorage`; pass `sessionStorage` for a per-tab arrangement. */
  storage?: Storage;
}): GridStatePersistence {
  const prefix = options?.prefix ?? 'datagrid.state.';
  const store = (): Storage | null => {
    if (options?.storage != null) {
      return options.storage;
    }
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  };
  return {
    load: (id) => {
      try {
        const raw = store()?.getItem(prefix + id) ?? null;
        if (raw == null) {
          return null;
        }
        const parsed: unknown = JSON.parse(raw);
        return isGridState(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save: (id, state) => {
      try {
        store()?.setItem(prefix + id, JSON.stringify(state));
      } catch {
        // Quota, private mode, or a blocked origin. The arrangement is lost,
        // which is the whole of the damage.
      }
    },
    clear: (id) => {
      try {
        store()?.removeItem(prefix + id);
      } catch {
        // As above.
      }
    },
  };
}

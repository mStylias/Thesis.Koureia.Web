/**
 * Application-wide grid configuration (§19.1).
 *
 * Resolution has three layers, and the narrower one always wins:
 *
 * 1. an explicit binding on the tag — `density="compact"`
 * 2. the matching key of the `[config]` object
 * 3. `provideDatagridDefaults()` from an ancestor injector
 *
 * All three cross any number of wrapper layers, so an application declares its
 * conventions once and a screen overrides the one key it cares about.
 *
 * ```ts
 * providers: [
 *   provideDatagridDefaults({
 *     appearance: { density: 'compact', striping: true },
 *     paging: { mode: 'pager', pageSize: 25 },
 *   }),
 * ]
 * ```
 */
import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import type { GridConfig } from './core/types/config.types';
import type { DatagridDefaults, ConfigLayer } from './datagrid.defaults.types';

/** Defaults for every grid beneath the injector. */
export const DATAGRID_DEFAULTS = new InjectionToken<DatagridDefaults>('DATAGRID_DEFAULTS');

/** Registers grid defaults, resolved beneath `[config]` and beneath explicit bindings. */
export function provideDatagridDefaults(defaults: DatagridDefaults): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DATAGRID_DEFAULTS, useValue: defaults }]);
}

/**
 * The first layer that answers, or `undefined`.
 *
 * A key present but `undefined` counts as absent, which is what lets a host
 * spread a partial object over a shared constant without erasing keys.
 */
export function readConfigLayers<TRow, TValue>(
  layers: readonly ConfigLayer<TRow>[],
  read: (layer: Partial<GridConfig<TRow>>) => TValue | undefined,
): TValue | undefined {
  for (const layer of layers) {
    if (layer == null) {
      continue;
    }
    const value = read(layer);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

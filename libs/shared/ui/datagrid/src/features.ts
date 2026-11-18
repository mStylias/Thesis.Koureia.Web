/**
 * Optional grid surfaces, attached as values or through dependency injection.
 *
 * A feature is a value on the `features` input, or a provider in an ancestor
 * injector. Both cross any number of wrapper layers: an application that
 * renders every grid through one `app-grid` forwards `features` without
 * knowing what is in it, and a screen that needs no filter row passes nothing.
 *
 * ```ts
 * // per grid
 * protected readonly features = [filterRow(), headerFilters(), filterPanel()];
 * ```
 *
 * ```ts
 * // application-wide, resolved beneath any explicit binding
 * providers: [provideDatagridFeatures(filterPanel())]
 * ```
 *
 * A directive on the tag is deliberately not the attachment point: it cannot
 * be applied conditionally and cannot be forwarded, so a wrapper supporting
 * *n* features would have to link all *n* and every screen would ship them.
 */
import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import type {
  DatagridBarPosition,
  DatagridFeature,
  DatagridFeatureName,
  FeatureByName,
  FilterBuilderFeature,
  FilterPanelFeature,
  FilterRowFeature,
  GridTemporaryView,
  GridViewsFeature,
  GroupPanelFeature,
  HeaderFilterFeature,
} from './features.types';

/** Turns on the filter row. */
export function filterRow(options?: { apply?: 'auto' | 'deferred' }): FilterRowFeature {
  return { name: 'filterRow', apply: options?.apply ?? 'auto' };
}

/** Turns on the header filter popup. */
export function headerFilters(options?: { pageSize?: number }): HeaderFilterFeature {
  const declared = options?.pageSize ?? 0;
  return { name: 'headerFilter', pageSize: declared > 0 ? Math.floor(declared) : 50 };
}

/** Turns on the filter panel. */
export function filterPanel(options?: { position?: DatagridBarPosition }): FilterPanelFeature {
  return { name: 'filterPanel', position: options?.position ?? 'top' };
}

/** Turns on the filter builder and the affordance that opens it. */
export function filterBuilder(options?: { position?: DatagridBarPosition }): FilterBuilderFeature {
  return { name: 'filterBuilder', position: options?.position ?? 'top' };
}

/** Turns on the drag-to-group panel. */
export function groupPanel(): GroupPanelFeature {
  return { name: 'groupPanel' };
}

/**
 * Turns on named views.
 *
 * `key` names the stored document: `gridViews({ key: 'roles_main_grid' })`
 * writes to `roles_main_grid_views`. The suffix is the library's, so the
 * "ends at the type of resource" half of the convention cannot be spelled two
 * ways on two screens.
 *
 * Views also take over the arrangement: with this on, the grid's own
 * `statePersistence` is bypassed, so one arrangement can never be saved in two
 * places and disagree on the next load.
 */
export function gridViews(options: {
  key: string;
  temporary?: () => GridTemporaryView | PromiseLike<GridTemporaryView | null> | null;
}): GridViewsFeature {
  return options.temporary === undefined
    ? { name: 'views', key: options.key }
    : { name: 'views', key: options.key, temporary: options.temporary };
}

/** The descriptor of a feature, or `null` when it was not opted into. */
export function findFeature<TName extends DatagridFeatureName>(
  features: readonly DatagridFeature[],
  name: TName,
): FeatureByName[TName] | null {
  const found = features.find((feature) => feature.name === name);
  return found === undefined ? null : (found as FeatureByName[TName]);
}

/** Application-wide features, resolved when the grid's `features` is unbound. */
export const DATAGRID_FEATURES = new InjectionToken<readonly DatagridFeature[]>(
  'DATAGRID_FEATURES',
);

/**
 * Registers features for every grid beneath the injector. An explicit
 * `[features]` binding on a grid replaces them; it does not merge.
 */
export function provideDatagridFeatures(
  ...features: readonly DatagridFeature[]
): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DATAGRID_FEATURES, useValue: features }]);
}

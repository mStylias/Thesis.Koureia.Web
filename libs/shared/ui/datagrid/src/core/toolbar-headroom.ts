import { InjectionToken, type WritableSignal } from '@angular/core';

/**
 * The bar's spare width, published to the entries drawn inside it.
 *
 * The toolbar writes it; an elastic entry reads it to pick a presentation it
 * can afford. A DI token rather than an input: an entry rendered through
 * `NgComponentOutlet` takes its inputs from a descriptor the grid builds, and
 * a width measured by the bar has no business travelling through the grid to
 * get back to the bar's own child.
 *
 * Provided by {@link DatagridToolbar}, so it is per bar. Injected
 * `{ optional: true }`: the same component is rendered on its own in stories
 * and in specs, where there is no bar and therefore no limit.
 */
export const DATAGRID_TOOLBAR_HEADROOM = new InjectionToken<WritableSignal<number>>(
  'DATAGRID_TOOLBAR_HEADROOM',
);

import {
  Injectable,
  InjectionToken,
  afterNextRender,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import type {
  ColumnChooserPresentation,
  DatagridColumnChooserOptions,
} from './datagrid-column-chooser.types';

/**
 * Which surface the column chooser opens. Without it, every chooser opens a
 * popover. The choice is the application's, so the library only offers both.
 *
 * ```ts
 * providers: [
 *   {
 *     provide: DATAGRID_COLUMN_CHOOSER_OPTIONS,
 *     useFactory: () => ({ presentation: signal('panel') }),
 *   },
 * ]
 * ```
 */
export const DATAGRID_COLUMN_CHOOSER_OPTIONS = new InjectionToken<DatagridColumnChooserOptions>(
  'DATAGRID_COLUMN_CHOOSER_OPTIONS',
);

/**
 * The presentation in force: the explicit one, else the application's, else
 * the popover.
 *
 * The server and the first client frame always answer `popover`, and the
 * answer changes in `afterNextRender`. The two surfaces draw different
 * triggers, and a viewport read during rendering would make the server and
 * the browser disagree. That is the `ViewMode` precedent.
 */
export function injectColumnChooserPresentation(
  declared: Signal<ColumnChooserPresentation | null>,
): Signal<ColumnChooserPresentation> {
  const options = inject(DATAGRID_COLUMN_CHOOSER_OPTIONS, { optional: true });
  const rendered = signal(false);
  afterNextRender(() => {
    rendered.set(true);
  });
  return computed(() =>
    rendered() ? (declared() ?? options?.presentation() ?? 'popover') : 'popover',
  );
}

/** The top inset the application gives the floating panel, or none. */
export function injectColumnPanelInsetTop(): string {
  return inject(DATAGRID_COLUMN_CHOOSER_OPTIONS, { optional: true })?.panelInsetTop ?? '';
}

let nextColumnPanelId = 0;

/**
 * The floating column panel a toolbar hosts for every chooser drawn in it.
 *
 * The panel lives on the toolbar, not on the chooser, because a chooser
 * folded into the overflow surface is destroyed when that surface closes,
 * and a panel the user is working in must not go with it.
 */
@Injectable()
export class ColumnPanel {
  readonly open = signal(false);
  readonly id = `lib-datagrid-column-panel-${(nextColumnPanelId++).toString()}`;
}

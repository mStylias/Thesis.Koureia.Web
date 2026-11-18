import { Component, input } from '@angular/core';

import type { FabSeverity, FabSize } from './fab.types';

/**
 * Floating action button: the one action a screen is for, as an elevated square icon button.
 * Applied to a native `<button>`, so it keeps native semantics, keyboard behavior and `disabled`.
 *
 * ```ts
 * import { Fab, FabGroup } from '@ui/fab';
 * ```
 *
 * ```html
 * <lib-fab-group>
 *   <button libFab size="sm" severity="secondary" aria-label="Change view">
 *     <svg lucideCalendarDays aria-hidden="true"></svg>
 *   </button>
 *   <button libFab aria-label="New appointment">
 *     <svg lucidePlus aria-hidden="true"></svg>
 *   </button>
 * </lib-fab-group>
 * ```
 *
 * The button holds only an icon, so it must have an `aria-label`.
 */
@Component({
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: 'button[libFab]',
  template: '<ng-content />',
  styleUrl: './fab.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-severity]': 'severity()',
  },
})
export class Fab {
  /** Edge length. Defaults to `md`. */
  readonly size = input<FabSize>('md');

  /** Fill. Defaults to `primary`, the brand accent. */
  readonly severity = input<FabSeverity>('primary');
}

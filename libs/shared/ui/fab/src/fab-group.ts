import { Component, input } from '@angular/core';

import type { FabGroupPosition } from './fab.types';

/**
 * Pins a stack of `libFab` buttons to the bottom-end corner, clear of the device's safe area.
 * The buttons stack top to bottom in DOM order and share one center line, so put the main
 * action last.
 *
 * ```html
 * <lib-fab-group position="absolute">
 *   <button libFab size="sm" severity="secondary" aria-label="Change view">…</button>
 *   <button libFab aria-label="New appointment">…</button>
 * </lib-fab-group>
 * ```
 */
@Component({
  selector: 'lib-fab-group',
  template: '<ng-content />',
  styleUrl: './fab-group.scss',
  host: {
    '[attr.data-position]': 'position()',
  },
})
export class FabGroup {
  /**
   * `fixed` pins the group to the viewport. `absolute` pins it to the nearest positioned
   * ancestor, for a widget that fills only part of the page. Defaults to `fixed`.
   */
  readonly position = input<FabGroupPosition>('fixed');
}

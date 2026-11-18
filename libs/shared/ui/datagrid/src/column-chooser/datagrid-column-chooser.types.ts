import type { Signal } from '@angular/core';

/**
 * The surface the chooser opens. `popover` drops under the button. `panel`
 * floats over the page, docked to the bottom-right corner, and stays open
 * while the user works with the grid.
 */
export type ColumnChooserPresentation = 'popover' | 'panel';

/** How every chooser beneath the injector opens. The application decides. */
export interface DatagridColumnChooserOptions {
  /** Read reactively, so a signal can switch the surface with the viewport. */
  readonly presentation: Signal<ColumnChooserPresentation>;
  /**
   * Space the floating panel keeps free above it, as a CSS length, such as
   * the app bar's height. Ignored by the popover.
   */
  readonly panelInsetTop?: string;
}

import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideTriangleAlert, LucideX } from '@lucide/angular';
import { Button } from '@ui/button';
import type { DatagridFilterChip } from '../datagrid.types';
import type { DatagridBarPosition } from '../features.types';

/**
 * A readable account of what is filtering the grid, with the three clear
 * affordances §7.5 asks for: one chip, every filter, and the arrangement.
 *
 * A chip the filter row cannot show carries a warning rather than being left
 * out — §7.3 forbids dropping what a surface cannot represent.
 */
@Component({
  selector: 'lib-datagrid-filter-panel',
  templateUrl: './datagrid-filter-panel.html',
  styleUrl: './datagrid-filter-panel.scss',
  imports: [TranslocoPipe, UiCopyPipe, Button, LucideTriangleAlert, LucideX],
  host: {
    '[attr.aria-label]': 'panelLabel()',
    '[attr.data-position]': 'position()',
    role: 'group',
  },
})
export class DatagridFilterPanel {
  readonly chips = input.required<readonly DatagridFilterChip[]>();

  /** Which edge the panel sits against, so its divider faces the rows. */
  readonly position = input<DatagridBarPosition>('top');

  /**
   * Accessible name of the region. Supplied by the grid, which owns the
   * Transloco scope; the chips' own labels go through the pipe here.
   */
  readonly panelLabel = input('');

  /** Offers the reset-arrangement action beside clear-all. */
  readonly showReset = input(false);

  /**
   * Offers §7.2's edit affordance, which opens the filter builder.
   *
   * The panel is the summary of what filters the grid, so the way to rewrite
   * that filter belongs beside it. A second bar carrying one button would say
   * the same thing twice.
   */
  readonly showBuilder = input(false);

  readonly removed = output<{ id: string }>();

  /**
   * The user asked to open the expression editor. Carries the press, so the
   * owner can hang the editor's overlay off the button that asked for it.
   */
  readonly builderRequested = output<Event>();

  readonly clearedAll = output();

  readonly resetRequested = output();
}

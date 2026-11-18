import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideCheck, LucideMinus } from '@lucide/angular';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';
import type { CellContext } from '../core/types/context.types';

/**
 * The renderer behind `booleanColumn({ display: 'check' })`.
 *
 * A glyph plus the same text the labelled form prints, clipped rather than
 * dropped: the state is never carried by colour or by a shape alone, and the
 * cell reads identically in both forms. A checkbox is deliberately not used —
 * an editable-looking control on a cell nobody can edit is the affordance
 * defect this library keeps out.
 */
@Component({
  selector: 'lib-datagrid-boolean-cell',
  template: `
    @if (value()) {
      <svg lucideCheck class="dg-boolean-icon" aria-hidden="true"></svg>
    } @else {
      <svg lucideMinus class="dg-boolean-icon" data-off aria-hidden="true"></svg>
    }
    <span class="dg-boolean-text">
      {{ (value() ? 'datagrid.boolean.true' : 'datagrid.boolean.false') | uiCopy | transloco }}
    </span>
  `,
  styleUrl: './datagrid-boolean-cell.scss',
  imports: [TranslocoPipe, UiCopyPipe, LucideCheck, LucideMinus],
  providers: [DATAGRID_TRANSLOCO_SCOPE],
})
export class DatagridBooleanCell<TRow = unknown> {
  /** The cell context every renderer receives. */
  readonly context = input.required<CellContext<TRow>>();

  protected readonly value = computed(() => this.context().displayValue === true);
}

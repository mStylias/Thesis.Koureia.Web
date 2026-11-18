import { Component, computed, input } from '@angular/core';
import { formatCellText } from '../core/format';
import { primarySpecOf } from '../core/primary-column';
import type { CellContext } from '../core/types/context.types';

/**
 * The cell of the primary column (§5.1).
 *
 * The identifier is a real control, so it announces as one and shows the user
 * that the record opens from here. It is `tabindex="-1"`: §16.2 makes the body
 * one tab stop, and the grid activates this from `Enter` on the cell in one
 * press rather than making the reader step into it first.
 *
 * With an `href` it is an anchor, which is what middle-click, `Ctrl`-click and
 * "copy link address" need. The press is not stopped here — the grid reads the
 * marker and turns it into `primaryCellActivated` without also selecting the
 * row underneath.
 */
@Component({
  selector: 'lib-datagrid-primary-cell',
  template: `
    @if (href(); as target) {
      <a class="dg-primary" data-primary-activate tabindex="-1" [href]="target">{{ label() }}</a>
    } @else {
      <button class="dg-primary" type="button" data-primary-activate tabindex="-1">
        {{ label() }}
      </button>
    }
  `,
  styleUrl: './datagrid-primary-cell.scss',
})
export class DatagridPrimaryCell<TRow = unknown> {
  /** The cell context every renderer receives. */
  readonly context = input.required<CellContext<TRow>>();

  /** Empty when the column declares no link, which renders a button instead. */
  protected readonly href = computed(() => {
    const { row, column } = this.context();
    return primarySpecOf(column)?.href?.(row) ?? '';
  });

  protected readonly label = computed(() => {
    const { column, displayValue } = this.context();
    return formatCellText(displayValue, column);
  });
}

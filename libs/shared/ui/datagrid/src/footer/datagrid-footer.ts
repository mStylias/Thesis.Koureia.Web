import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import type { DatagridRenderSummaryCell } from '../datagrid.types';

/**
 * The total summary row.
 *
 * A normal-flow child of the scroll viewport, sticky to its bottom edge, so it
 * scrolls sideways with the body while staying in view — the mirror of what
 * the header does on the other edge. Pinned cells stick on the cross axis at
 * the same insets the body uses.
 */
@Component({
  selector: 'lib-datagrid-footer',
  templateUrl: './datagrid-footer.html',
  styleUrl: './datagrid-footer.scss',
  imports: [NgComponentOutlet, NgTemplateOutlet],
  host: {
    role: 'rowgroup',
    '[style.height.px]': 'height()',
  },
})
export class DatagridFooter<TRow = unknown> {
  /** One cell per rendered column, in layout order. */
  readonly cells = input.required<readonly DatagridRenderSummaryCell<TRow>[]>();

  readonly height = input.required<number>();

  /** 1-based `aria-rowindex` of the footer row. */
  readonly ariaRowIndex = input(0);

  /** Accessible name of the row, translated by the grid. */
  readonly label = input('');
}

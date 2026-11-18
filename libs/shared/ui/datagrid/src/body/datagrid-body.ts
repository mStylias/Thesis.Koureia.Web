import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideChevronRight } from '@lucide/angular';
import { Checkbox } from '@ui/checkbox';
import { reorderMotionAllowed, slideFrom } from '../core/reorder-motion';
import { DatagridAttrs } from './datagrid-attrs';
import type { CellPosition } from '../core/types/api.types';
import type { GridKey } from '../core/types/key.types';
import type { DatagridRenderCell, DatagridRenderItem, DatagridRenderRow } from '../datagrid.types';

/**
 * The virtualized row canvas.
 *
 * Rows are absolutely positioned at the offset their entry declares, so an
 * offset is written once when a row enters the window and never again while
 * scrolling. The canvas is the full body height, which is what gives the
 * scrollbar its correct size without rendering the rows behind it.
 *
 * Entries are not all data rows: a grouped body carries group headers and
 * footers, and an expanded row is followed by its detail region. Every kind
 * declares its height before render, so nothing here is measured.
 */
@Component({
  selector: 'lib-datagrid-body',
  templateUrl: './datagrid-body.html',
  styleUrl: './datagrid-body.scss',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Checkbox,
    DatagridAttrs,
    LucideChevronRight,
  ],
  host: {
    role: 'rowgroup',
    '[style.height.px]': 'totalHeight()',
    '[attr.data-animate-reorder]': 'animateReorder() ? "" : null',
  },
})
export class DatagridBody<TRow = unknown> {
  /** Entries inside the current window, plus the focused row when it is outside. */
  readonly items = input.required<readonly DatagridRenderItem<TRow>[]>();

  /** Height of the full body in pixels. */
  readonly totalHeight = input.required<number>();

  readonly rowHeight = input.required<number>();

  /** The roving-tabindex position. */
  readonly focused = input<CellPosition | null>(null);

  /** Number of skeleton rows to draw during the initial load. */
  readonly skeletonRows = input(0);

  /** Columns a skeleton row draws. */
  readonly skeletonColumns = input(0);

  /** Whether rows carry a selected state worth exposing to assistive tech. */
  readonly selectable = input(false);

  /** Accessible name of a row's selection checkbox, translated by the grid. */
  readonly selectRowLabel = input('');

  /** Accessible name of a row's detail expander, translated by the grid. */
  readonly expandRowLabel = input('');

  /**
   * Slide rows to their new places when the order changes. The grid only turns
   * this on when every row is rendered — see its `animateReorder`.
   */
  readonly animateReorder = input(false);

  /** Where each key sat last render, so a move can be played backwards. */
  private readonly lastTop = new Map<GridKey, number>();

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect(() => {
      this.playReorder(this.items());
    });
  }

  /**
   * Plays each moved row from where it was to where it now is.
   *
   * The animation is `transform` only — measured safe over the pinned columns'
   * sticky chain, which a transform on the whole canvas would not be.
   */
  private playReorder(items: readonly DatagridRenderItem<TRow>[]): void {
    const enabled = this.animateReorder() && reorderMotionAllowed();

    const live = new Set<GridKey>();
    for (const item of items) {
      live.add(item.key);
      const previous = this.lastTop.get(item.key);
      this.lastTop.set(item.key, item.top);
      if (!enabled || previous === undefined || previous === item.top) {
        continue;
      }
      const element = this.rowElement(item.keyText);
      if (element != null) {
        slideFrom(element, 0, previous - item.top);
      }
    }
    for (const key of [...this.lastTop.keys()]) {
      if (!live.has(key)) {
        this.lastTop.delete(key);
      }
    }
  }

  /** Matched by attribute: a key may hold any character, and `CSS.escape` is not universal. */
  private rowElement(keyText: string): HTMLElement | null {
    for (const element of this.hostRef.nativeElement.querySelectorAll<HTMLElement>(
      '[role="row"]',
    )) {
      if (element.getAttribute('data-key') === keyText) {
        return element;
      }
    }
    return null;
  }

  protected isFocused(row: DatagridRenderRow<TRow>, cell: DatagridRenderCell<TRow>): boolean {
    const focused = this.focused();
    return focused?.key === row.key && focused.columnId === cell.columnId;
  }

  /**
   * A group row carries one cell whichever column the user came from, so the
   * focused column is remembered while the walk passes over group headers.
   */
  protected isRowFocused(key: GridKey): boolean {
    return this.focused()?.key === key;
  }

  protected range(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_unused, index) => index);
  }
}

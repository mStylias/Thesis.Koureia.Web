import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideChevronRight } from '@lucide/angular';
import { Card } from '@ui/card';
import { Checkbox } from '@ui/checkbox';
import { DatagridAttrs } from '../body/datagrid-attrs';
import type { GridKey } from '../core/types/key.types';
import type { DatagridCardItem } from '../datagrid.types';

/**
 * The card list: the body of the grid in its card presentation (§5.4).
 *
 * **Not a grid.** It renders `role="list"` with `role="listitem"` cards, and
 * carries none of the table's ARIA — a card has no column tracks, and
 * `aria-colindex` over one would describe a table that is not there to the
 * only users who read it. Fields are `<dt>` / `<dd>` pairs, which ties a value
 * to its label without repeating the label in an `aria-label`.
 *
 * A grouped list drops the list role: a heading is not a list item, and a list
 * whose children are headings is invalid. The groups carry real `<h3>`s
 * instead, which is the better structure to navigate anyway.
 *
 * Cards are rendered inline rather than through a per-card component, for the
 * reason the body renders rows inline: a component per card would put a
 * generic element between the list and its items, and a page of cards would
 * pay for a component instance each.
 *
 * **Nothing here is virtualized.** Cards wrap into a flow whose column count
 * follows the container, so an offset computed from `index * height` does not
 * say where a card is — and this library declares heights rather than
 * measuring them, which a card of stacked fields cannot honestly do. The list
 * draws the loaded page, which is what paging already bounds.
 */
@Component({
  selector: 'lib-datagrid-cards',
  templateUrl: './datagrid-cards.html',
  styleUrl: './datagrid-cards.scss',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Card,
    Checkbox,
    DatagridAttrs,
    LucideChevronRight,
  ],
  host: {
    '[style.--dg-card-min-width.px]': 'minWidth()',
  },
})
export class DatagridCards<TRow = unknown> {
  /** Cards, group headings and open detail regions, in render order. */
  readonly items = input.required<readonly DatagridCardItem<TRow>[]>();

  /** The card holding the list's single tab stop, or `null`. */
  readonly focusedKey = input<GridKey | null>(null);

  /** Whether cards carry a selected state worth exposing to assistive tech. */
  readonly selectable = input(false);

  /** Narrowest a card is drawn before the flow gives it a track of its own. */
  readonly minWidth = input(0);

  /** Set while the grid is grouped, which replaces the list with sections. */
  readonly grouped = input(false);

  /** Accessible name of the list. Only used while it is a list. */
  readonly ariaLabel = input('');

  /** Accessible name of a card's selection checkbox, translated by the grid. */
  readonly selectRowLabel = input('');

  /** Accessible name of a card's detail expander, translated by the grid. */
  readonly expandRowLabel = input('');

  /**
   * A load that keeps the cards on screen. The table reports one on the
   * header's bottom edge; with no header, the list reports it on its own top
   * edge, which is the same boundary — the one the new records arrive below.
   */
  readonly loading = input(false);

  /** Number of skeleton cards to draw during the initial load. */
  readonly skeletonCards = input(0);

  /** Field rows a skeleton card draws. */
  readonly skeletonFields = input(3);

  protected isFocused(key: GridKey): boolean {
    return this.focusedKey() === key;
  }

  protected range(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_unused, index) => index);
  }
}

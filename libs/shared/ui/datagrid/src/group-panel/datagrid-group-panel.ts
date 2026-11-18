import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideArrowDown, LucideArrowUp, LucideX } from '@lucide/angular';
import type { DatagridGroupChip } from '../datagrid.types';

/**
 * The drag-to-group panel.
 *
 * A part of the grid shell rather than a separate export: it is a drop target
 * for a header drag, and the grid is what tracks that drag. The chips are the
 * whole of the keyboard path — each carries a direction toggle and a remove
 * button, so grouping never depends on a pointer.
 */
@Component({
  selector: 'lib-datagrid-group-panel',
  templateUrl: './datagrid-group-panel.html',
  styleUrl: './datagrid-group-panel.scss',
  imports: [TranslocoPipe, UiCopyPipe, LucideArrowDown, LucideArrowUp, LucideX],
  host: {
    '[attr.data-drop-active]': 'dropActive() ? "" : null',
    '[attr.data-empty]': 'chips().length === 0 ? "" : null',
  },
})
export class DatagridGroupPanel {
  /** One chip per grouping level, outermost first. */
  readonly chips = input.required<readonly DatagridGroupChip[]>();

  /** True while a header drag hovers the panel, so the drop target reads as live. */
  readonly dropActive = input(false);

  /** Flips a level between ascending and descending. */
  readonly directionToggled = output<string>();

  /** Removes a level. */
  readonly removed = output<string>();

  /** Moves a level one position outward or inward. */
  readonly moved = output<{ columnId: string; by: number }>();

  protected onChipKeydown(chip: DatagridGroupChip, event: KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.moved.emit({ columnId: chip.columnId, by: event.key === 'ArrowRight' ? 1 : -1 });
    }
  }
}

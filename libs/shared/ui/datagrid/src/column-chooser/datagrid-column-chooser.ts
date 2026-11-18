import {
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideColumns3 } from '@lucide/angular';
import { Button, type ButtonVariant } from '@ui/button';
import { FloatingPanel, FloatingPanelContent } from '@ui/floating-panel';
import { PopoverTrigger } from '@ui/popover';
import { Tooltip } from '@ui/tooltip';
import { indexColumnBands } from '../core/column-bands';
import { seedHiddenColumns } from '../core/column.store';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';
import { DatagridColumnList } from '../column-list/datagrid-column-list';
import {
  ColumnPanel,
  injectColumnChooserPresentation,
  injectColumnPanelInsetTop,
} from './column-chooser-presentation';
import type { ColumnDef } from '../core/types/column.types';
import type { ColumnChooserPresentation } from './datagrid-column-chooser.types';

let nextChooserId = 0;

/**
 * Column visibility chooser.
 *
 * A separate export rather than part of the grid shell: a grid that does not
 * offer one must not pay for the popover and the text field it pulls in.
 * Drop it in a toolbar region and point it at the grid.
 *
 * It opens a popover under the button, or a floating panel docked to the
 * bottom-right corner. `DATAGRID_COLUMN_CHOOSER_OPTIONS` lets the application
 * choose, and `presentation` overrides it for one chooser.
 *
 * ```html
 * <lib-datagrid #grid [columns]="columns" [data]="rows" key="id">
 *   <ng-template libDatagridToolbar="end">
 *     <lib-datagrid-column-chooser [columns]="columns" [(hidden)]="hiddenColumns" />
 *   </ng-template>
 * </lib-datagrid>
 * ```
 */
@Component({
  selector: 'lib-datagrid-column-chooser',
  templateUrl: './datagrid-column-chooser.html',
  styleUrl: './datagrid-column-chooser.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    DatagridColumnList,
    FloatingPanel,
    FloatingPanelContent,
    PopoverTrigger,
    Tooltip,
    LucideColumns3,
  ],
  providers: [DATAGRID_TRANSLOCO_SCOPE],
})
export class DatagridColumnChooser<TRow = unknown> {
  /** The same column definitions the grid renders. */
  readonly columns = input.required<readonly ColumnDef<TRow>[]>();

  /**
   * Ids of the hidden columns, which is the whole of visibility: a column
   * absent from the list is shown. Two-way: bind the grid's own hidden set
   * here, which the grid seeds from the definitions' `visible: false` — so
   * checking a default-hidden column here shows it.
   */
  readonly hidden = model<readonly string[]>([]);

  /**
   * Draws the trigger as an icon with a tooltip instead of a labelled button,
   * for a toolbar that has more controls than room. The caption and the count
   * stay in the accessible name, so the button reads the same either way.
   */
  readonly iconOnly = input(false, { transform: booleanAttribute });

  /**
   * Visual style of the trigger. The toolbar passes the one it gives every
   * other entry, so the chooser does not stand out in a bar of buttons.
   */
  readonly variant = input<ButtonVariant>('filled');

  /**
   * The surface the chooser opens. Unset, the application's choice from
   * `DATAGRID_COLUMN_CHOOSER_OPTIONS` applies, and without one the popover.
   */
  readonly presentation = input<ColumnChooserPresentation | null>(null);

  protected readonly resolvedPresentation = injectColumnChooserPresentation(this.presentation);
  protected readonly panelInsetTop = injectColumnPanelInsetTop();

  /** The toolbar's panel. A chooser placed outside a toolbar keeps its own. */
  protected readonly hostPanel = inject(ColumnPanel, { optional: true });
  protected readonly ownPanelOpen = signal(false);
  protected readonly panelId =
    this.hostPanel?.id ?? `lib-datagrid-column-chooser-panel-${(nextChooserId++).toString()}`;
  protected readonly panelOpen = computed(() => this.hostPanel?.open() ?? this.ownPanelOpen());
  /** What a panel of its own opens below, so it never covers the trigger. */
  protected readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly declaredVisibility = new Map<string, boolean>();

  constructor() {
    // The hidden list is the whole of visibility, so a column the definitions
    // hid has to be in it before the chooser can offer to take it back out.
    // A grid seeds its own model the same way and from the same definitions,
    // so the two agree on the ids whichever of them writes first.
    effect(() => {
      const columns = this.bands().leaves;
      untracked(() => {
        const next = seedHiddenColumns(columns, this.hidden(), this.declaredVisibility);
        if (next != null) {
          this.hidden.set(next);
        }
      });
    });

    // A panel left open while the viewport shrank must not come back on its own.
    effect(() => {
      if (this.resolvedPresentation() !== 'panel') {
        this.ownPanelOpen.set(false);
      }
    });
  }

  private readonly bands = computed(() => indexColumnBands(this.columns()));

  /**
   * Shown on the trigger as `visible/total`, so the user sees the state without
   * opening the panel. Counted over every column, not over the list the search
   * narrows — the trigger stays outside the panel and must not change while the
   * user types in it.
   */
  protected readonly visibleCount = computed(() => {
    const hidden = new Set(this.hidden());
    return this.bands().leaves.filter((column) => !hidden.has(column.id)).length;
  });

  protected readonly totalCount = computed(() => this.bands().leaves.length);

  protected togglePanel(): void {
    if (this.hostPanel != null) {
      this.hostPanel.open.update((open) => !open);
    } else {
      this.ownPanelOpen.update((open) => !open);
    }
  }
}

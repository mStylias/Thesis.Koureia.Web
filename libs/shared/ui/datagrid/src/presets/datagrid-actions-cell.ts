import { Component, computed, input, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideDynamicIcon, LucideEllipsis } from '@lucide/angular';
import { Button } from '@ui/button';
import { ContextMenu, type MenuItem } from '@ui/context-menu';
import { Tooltip } from '@ui/tooltip';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';
import type { CellContext } from '../core/types/context.types';
import { readPresetOptions } from './preset-options';
import type { ActionsSpec } from './preset.types';
import type { ResolvedAction } from './datagrid-actions-cell.types';
/** Shared, so a renderer written by hand allocates no options per cell. */
const NO_ACTIONS: ActionsSpec = { actions: [] };

/**
 * The renderer behind {@link actionsColumn}.
 *
 * The buttons are real controls but sit outside the tab order: §16.2 makes the
 * body a single tab stop, and three buttons on every row of a virtualized grid
 * would be hundreds. The keyboard reaches them the way it reaches any widget
 * inside a cell — `Enter` on the focused cell moves into the first one, and
 * `Escape` returns to the cell.
 */
@Component({
  selector: 'lib-datagrid-actions-cell',
  template: `
    @for (entry of inline(); track entry.action.id) {
      <button
        libButton
        type="button"
        variant="text"
        size="sm"
        tabindex="-1"
        [severity]="entry.action.destructive ? 'error' : 'secondary'"
        [iconOnly]="iconOnly()"
        [disabled]="entry.disabled"
        [attr.aria-label]="iconOnly() ? entry.action.label : null"
        [libTooltip]="entry.action.tooltip || entry.action.label"
        [tooltipDisabled]="!iconOnly()"
        (click)="run(entry, $event)"
      >
        @if (entry.action.icon; as icon) {
          <svg [lucideIcon]="icon" aria-hidden="true"></svg>
        }
        @if (!iconOnly()) {
          {{ entry.action.label }}
        }
      </button>
    }
    @if (overflow().length > 0) {
      <button
        libButton
        type="button"
        variant="text"
        severity="secondary"
        size="sm"
        iconOnly
        tabindex="-1"
        [attr.aria-label]="'datagrid.actions.more' | uiCopy | transloco"
        (click)="openMenu($event)"
      >
        <svg lucideEllipsis aria-hidden="true"></svg>
      </button>
      <lib-context-menu
        #menu
        density="compact"
        [items]="menuItems()"
        [ariaLabel]="'datagrid.actions.more' | uiCopy | transloco"
      />
    }
  `,
  styleUrl: './datagrid-actions-cell.scss',
  imports: [
    TranslocoPipe,
    UiCopyPipe,
    Button,
    ContextMenu,
    Tooltip,
    LucideDynamicIcon,
    LucideEllipsis,
  ],
  providers: [DATAGRID_TRANSLOCO_SCOPE],
})
export class DatagridActionsCell<TRow = unknown> {
  /** The cell context every renderer receives. */
  readonly context = input.required<CellContext<TRow>>();

  private readonly menu = viewChild<ContextMenu>('menu');

  private readonly spec = computed<ActionsSpec<TRow>>(() =>
    readPresetOptions<ActionsSpec<TRow>>(this.context().column, NO_ACTIONS),
  );

  protected readonly iconOnly = computed(() => this.spec().iconOnly === true);

  /** The actions this row offers, after its own visibility predicates. */
  private readonly available = computed<readonly ResolvedAction<TRow>[]>(() => {
    const row = this.context().row;
    return this.spec()
      .actions.filter((action) => action.visible?.(row) !== false)
      .map((action) => ({ action, disabled: action.disabled?.(row) === true }));
  });

  /**
   * How many draw as buttons. A declared count, not a measured one: the column
   * has one width for every row, so measuring would compute the same number
   * once per rendered cell.
   */
  private readonly maxInline = computed(() => {
    const declared = this.spec().maxInline;
    return declared == null || declared < 0 ? 2 : Math.floor(declared);
  });

  protected readonly inline = computed(() => {
    const available = this.available();
    const max = this.maxInline();
    // One action over the limit draws as a button rather than as a menu of
    // one: a trigger that opens a single entry costs the user a click for
    // nothing.
    return available.length === max + 1 ? available : available.slice(0, max);
  });

  protected readonly overflow = computed(() => this.available().slice(this.inline().length));

  protected readonly menuItems = computed<readonly MenuItem[]>(() =>
    this.overflow().map((entry) => ({
      label: entry.action.label,
      icon: entry.action.icon,
      disabled: entry.disabled,
      command: () => {
        this.invoke(entry);
      },
    })),
  );

  protected run(entry: ResolvedAction<TRow>, event: MouseEvent): void {
    // The grid selects a row from a click on any of its cells. An action is
    // not a row selection, so the press stops here.
    event.stopPropagation();
    if (entry.disabled) {
      return;
    }
    this.invoke(entry);
  }

  protected openMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menu()?.showAt(event.currentTarget as HTMLElement, event, { focusFirstItem: true });
  }

  private invoke(entry: ResolvedAction<TRow>): void {
    const { row, key } = this.context();
    entry.action.run(row, key);
  }
}

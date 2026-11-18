import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideArrowDownWideNarrow,
  LucideArrowLeftToLine,
  LucideArrowRightToLine,
  LucideArrowUp,
  LucideArrowUpDown,
  LucideArrowUpNarrowWide,
  LucideEyeOff,
  LucideFunnel,
  LucideFunnelX,
  LucideGroup,
  LucideListOrdered,
  LucideListX,
  LucidePinOff,
  LucideUngroup,
} from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Checkbox } from '@ui/checkbox';
import { ContextMenu } from '@ui/context-menu';
import type { MenuItem } from '@ui/menu';
import { swapTarget } from '../core/column-resize';
import type { ColumnBox } from '../core/column-resize.types';
import type {
  DatagridRenderBandCell,
  DatagridRenderBandRow,
  DatagridRenderHeaderCell,
} from '../datagrid.types';
import type {
  ResizeDrag,
  HeaderUnitKind,
  ReorderDrag,
  HeaderRowCell,
  HeaderRow,
  NavCell,
} from './datagrid-header.types';

/** Pointer movement before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** Pixels a keyboard resize step moves. */
const KEYBOARD_RESIZE_STEP = 16;

/**
 * The sticky header row.
 *
 * It is a normal-flow child of the scroll viewport, so it scrolls
 * horizontally with the body while sticking to the top. Pinned header cells
 * stick on the other axis at the same insets the body uses.
 *
 * The header is its own tab stop with its own roving tabindex, separate from
 * the body's: §16.2 lists header and body as distinct regions `Tab` moves
 * between.
 */
@Component({
  selector: 'lib-datagrid-header',
  templateUrl: './datagrid-header.html',
  styleUrl: './datagrid-header.scss',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Checkbox,
    ContextMenu,
    LucideArrowUp,
    LucideFunnel,
  ],
  host: {
    role: 'rowgroup',
    // A live swap moves the grabbed cell in the DOM, and a moved element loses
    // its pointer capture. The host never moves, so it is what captures and
    // what listens.
    '(pointermove)': 'onPointermove($event)',
    '(pointerup)': 'onPointerup($event)',
    '(pointercancel)': 'onPointerup($event)',
  },
})
export class DatagridHeader<TRow = unknown> {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly cells = input.required<readonly DatagridRenderHeaderCell<TRow>[]>();

  /**
   * Band rows above the leaf row, outermost first (§5.1). Empty for a grid
   * that declares no column groups, which is then rendered exactly as before.
   */
  readonly bands = input<readonly DatagridRenderBandRow<TRow>[]>([]);

  /**
   * Whether a load that keeps its rows is running, which draws the progress
   * bar on the header's bottom edge — the boundary between the headers and the
   * rows the load is about to replace.
   */
  readonly loading = input(false, { transform: booleanAttribute });

  /** Whether the grid offers sorting at all. */
  readonly sortable = input(true);

  /** Whether a selection checkbox column is present and interactive. */
  readonly selectable = input(false);

  /**
   * Translates a key. The grid owns the Transloco scope this header renders
   * in, and the column menu builds its labels imperatively.
   */
  readonly translate = input<(key: string) => string>((key) => key);

  /**
   * Holds the live column swap while a reorder drag is over some other drop
   * target. The grid sets it when the pointer reaches the group panel, which
   * is the only thing that knows where that panel is.
   */
  readonly suppressReorder = input(false);

  /** Whether the grid offers grouping at all. Per-column `allow.grouping` still applies. */
  readonly groupable = input(false);

  /** Whether the row number column is drawn, which the column menu can toggle. */
  readonly showRowNumbers = input(false);

  /**
   * Whether the menu offers the row number toggle at all. Showing or hiding a
   * column is the `hiding` capability, and a withheld capability takes its
   * affordance away rather than disabling it.
   */
  readonly allowRowNumbers = input(true);

  /**
   * Emitted when the user activates a column's sort. `direction` is absent
   * for a plain activation, which advances the cycle, and set when the menu
   * picked a direction outright — `null` means clear this column's sort.
   */
  readonly sortToggled = output<{
    columnId: string;
    multi: boolean;
    direction?: 'asc' | 'desc' | null;
  }>();

  /**
   * Emitted continuously during a resize drag, and once per keyboard step.
   * `live` marks a drag frame, which is an intermediate width rather than a
   * width the user settled on.
   */
  readonly resized = output<{ columnId: string; delta: number; live: boolean }>();

  /** Emitted once when a resize drag lets go. */
  readonly resizeEnded = output();

  /**
   * Emitted while a drag passes over another header unit, which is when the
   * swap happens — the drop only settles what the user already sees. Both ids
   * name a column, or both name a band; a drag never crosses the two.
   */
  readonly reordered = output<{ columnId: string; overId: string; kind: HeaderUnitKind }>();

  /** Emitted once when a reorder drag lets go. */
  readonly reorderEnded = output();

  /**
   * A reorder drag has passed its threshold and wants a ghost.
   *
   * The shell draws it, not the header: the header sits inside the scroll
   * viewport, which clips, so a ghost drawn here could never travel to the
   * group panel above it. `grabX` / `grabY` are the pointer's offset inside
   * the grabbed cell, so the copy keeps the grip the user took.
   */
  readonly dragStarted = output<{
    columnId: string;
    kind: HeaderUnitKind;
    caption: string;
    width: number;
    grabX: number;
    grabY: number;
  }>();

  /**
   * Where an active reorder drag has reached, in client coordinates. The shell
   * moves the ghost with it and hit-tests it against the group panel; nothing
   * else needs it.
   */
  readonly dragMoved = output<{ columnId: string; clientX: number; clientY: number }>();

  /** Emitted for a keyboard reorder, which moves past one sibling at a time. */
  readonly moved = output<{ columnId: string; overId: string; kind: HeaderUnitKind }>();

  readonly pinned = output<{ columnId: string; side: 'start' | 'end' | false }>();

  readonly hidden = output<{ columnId: string }>();

  /** The column menu asked to group by, or to stop grouping by, this column. */
  readonly grouped = output<{ columnId: string; grouped: boolean }>();

  /** The column menu asked to drop every grouping level. */
  readonly groupingCleared = output();

  /** The column menu asked to show or hide the row number column. */
  readonly rowNumbersToggled = output<boolean>();

  /**
   * The user asked for the header filter of a column, from the pointer-only
   * affordance or from the column menu. The anchor travels with it: the grid
   * owns the overlay, and only the header knows which element the panel hangs
   * from.
   */
  readonly headerFilterRequested = output<{ columnId: string; anchor: HTMLElement }>();

  /** The column menu asked to drop this column's filter. */
  readonly filterCleared = output<{ columnId: string }>();

  readonly selectAllToggled = output<boolean>();

  private readonly menuRef = viewChild<ContextMenu>('columnMenu');

  /** The column whose id owns the header's roving tabindex. */
  private readonly rovingSig = signal<string | null>(null);

  /** The column a drag holds, whose cell is left empty while the ghost carries it. */
  protected readonly dragging = signal<string | null>(null);

  /** The column being resized, so the header can show a live guide. */
  protected readonly resizing = signal<string | null>(null);

  private resizeDrag: ResizeDrag | null = null;
  private reorderDrag: ReorderDrag | null = null;
  private draggedSinceDown = false;
  private menuColumnId: string | null = null;

  /**
   * The header, row by row, bands and columns merged and in column order.
   *
   * A banded header is two-dimensional: bands sit above, and a column with
   * fewer bands over it than the deepest one starts higher up and reaches down
   * to the bottom. Merging the two into one ordered list per row is what keeps
   * the DOM order the reading order — a screen reader walks a row as it is
   * written, whatever the grid places where.
   *
   * With no bands this is one row holding every column, which is the markup
   * the header has always produced.
   */
  protected readonly renderRows = computed<readonly HeaderRow<TRow>[]>(() => {
    const bands = this.bands();
    const rows: HeaderRowCell<TRow>[][] = Array.from({ length: bands.length + 1 }, () => []);
    for (const band of bands) {
      for (const cell of band.cells) {
        rows[cell.row].push({ kind: 'band', band: cell, colIndex: cell.colIndex });
      }
    }
    for (const cell of this.cells()) {
      rows[cell.row].push({ kind: 'column', column: cell, colIndex: cell.colIndex });
    }
    for (const row of rows) {
      row.sort((a, b) => a.colIndex - b.colIndex);
    }
    return rows.map((cells, index) => ({ ariaRowIndex: index + 1, cells }));
  });

  private readonly navRows = computed<readonly (readonly NavCell[])[]>(() =>
    this.renderRows().map((row, index) =>
      row.cells.map((cell) =>
        cell.kind === 'band'
          ? {
              id: cell.band.bandId,
              parentId: cell.band.parentId,
              row: index,
              colIndex: cell.colIndex,
              reorderable: cell.band.reorderable,
            }
          : {
              id: cell.column.columnId,
              parentId: cell.column.parentId,
              row: index,
              colIndex: cell.colIndex,
              reorderable: cell.column.reorderable,
            },
      ),
    ),
  );

  private readonly navById = computed(() => {
    const map = new Map<string, NavCell>();
    for (const row of this.navRows()) {
      for (const cell of row) {
        map.set(cell.id, cell);
      }
    }
    return map;
  });

  /**
   * The id holding the tabindex, defaulting to the first column.
   *
   * The leaf row rather than the outermost band: the columns are what the
   * header's keys act on, and a band is reached by walking up to it.
   */
  protected readonly roving = computed(() => {
    const current = this.rovingSig();
    if (current != null && this.navById().has(current)) {
      return current;
    }
    return this.cells()[0]?.columnId ?? null;
  });

  protected readonly menuItems = signal<readonly MenuItem[]>([]);

  protected ariaSort(cell: DatagridRenderHeaderCell<TRow>): string | null {
    if (!cell.sortable) {
      return null;
    }
    if (cell.sort === 'asc') {
      return 'ascending';
    }
    return cell.sort === 'desc' ? 'descending' : 'none';
  }

  protected onCellClick(cell: DatagridRenderHeaderCell<TRow>, event: MouseEvent): void {
    if (this.consumedDrag()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-resize-handle]') != null) {
      return;
    }
    if (target?.closest('[data-header-filter]') != null) {
      this.requestHeaderFilter(cell.columnId);
      return;
    }
    if (!cell.sortable) {
      return;
    }
    this.rovingSig.set(cell.columnId);
    this.sortToggled.emit({
      columnId: cell.columnId,
      multi: event.shiftKey || event.ctrlKey || event.metaKey,
    });
  }

  protected onCellKeydown(cell: DatagridRenderHeaderCell<TRow>, event: KeyboardEvent): void {
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    if (cell.kind === 'selection') {
      // The cell forwards activation to the checkbox it draws, which is not
      // itself a tab stop.
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.selectAllToggled.emit(cell.selectAll !== 'all');
        return;
      }
    }
    if (event.key === 'Enter' && cell.sortable) {
      event.preventDefault();
      this.sortToggled.emit({ columnId: cell.columnId, multi: event.shiftKey });
      return;
    }
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      this.openMenu(cell);
      return;
    }
    // A modified arrow resizes or reorders the column; a bare arrow walks the
    // header. The two must not both fire from one press.
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && modified) {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      if (event.shiftKey) {
        this.moveUnit(cell.columnId, direction, 'column');
        return;
      }
      if (cell.resizable) {
        this.resized.emit({
          columnId: cell.columnId,
          delta: direction * KEYBOARD_RESIZE_STEP,
          live: false,
        });
      }
      return;
    }
    this.navigate(cell.columnId, event);
  }

  /** A band cell sorts nothing and filters nothing; it moves and it is walked. */
  protected onBandKeydown(cell: DatagridRenderBandCell<TRow>, event: KeyboardEvent): void {
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && modified && event.shiftKey) {
      event.preventDefault();
      this.moveUnit(cell.bandId, event.key === 'ArrowRight' ? 1 : -1, 'band');
      return;
    }
    this.navigate(cell.bandId, event);
  }

  /** Arrow, Home and End over the header grid. Bands are a row above. */
  private navigate(id: string, event: KeyboardEvent): void {
    const cell = this.navById().get(id);
    if (cell === undefined) {
      return;
    }
    const rows = this.navRows();
    const row = rows[cell.row];
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = row[row.indexOf(cell) + (event.key === 'ArrowRight' ? 1 : -1)] as
        | NavCell
        | undefined;
      if (next !== undefined) {
        this.focusColumn(next.id);
      }
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const target = rows[cell.row + (event.key === 'ArrowDown' ? 1 : -1)] as
        | readonly NavCell[]
        | undefined;
      if (target === undefined || target.length === 0) {
        return;
      }
      event.preventDefault();
      // The cell that starts at or before this one's first column: a band
      // covers several columns, so walking up from any of them lands on the
      // band that names it, and walking back down returns to the first.
      const under = target.filter((candidate) => candidate.colIndex <= cell.colIndex).at(-1);
      this.focusColumn((under ?? target[0]).id);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const target = (event.key === 'Home' ? row[0] : row[row.length - 1]) as NavCell | undefined;
      if (target !== undefined) {
        this.focusColumn(target.id);
      }
    }
  }

  /**
   * Moves a column or a band past the sibling beside it.
   *
   * The sibling is what the move names, not a position: a band covers several
   * columns, and stepping by one position would walk a column through the band
   * next to it rather than past it. A unit at the end of its band has no
   * sibling in that direction and stays where it is — which is the confinement
   * a banded header needs.
   */
  private moveUnit(id: string, direction: 1 | -1, kind: HeaderUnitKind): void {
    const cell = this.navById().get(id);
    if (cell?.reorderable !== true) {
      return;
    }
    const row = this.navRows()[cell.row];
    const siblings = row.filter((candidate) => candidate.parentId === cell.parentId);
    const over = siblings[siblings.indexOf(cell) + direction] as NavCell | undefined;
    if (over?.reorderable !== true) {
      return;
    }
    this.moved.emit({ columnId: id, overId: over.id, kind });
    this.refocusAfterRender(id);
  }

  private focusColumn(columnId: string): void {
    this.rovingSig.set(columnId);
    const element = this.hostRef.nativeElement.querySelector<HTMLElement>(
      `[data-header-focus][data-column="${CSS.escape(columnId)}"]`,
    );
    element?.focus();
  }

  /**
   * Re-asserts focus once the render an action triggered has landed.
   *
   * Pinning and reordering move the cell's DOM node, and removing a focused
   * node drops focus to the document body. Focusing in the handler is
   * therefore too early: the move undoes it. This runs after the node is in
   * its new place.
   */
  private refocusAfterRender(columnId: string): void {
    afterNextRender(
      () => {
        this.focusColumn(columnId);
      },
      { injector: this.injector },
    );
  }

  /** The header cell element of a column, which anchors both overlays. */
  private cellElement(columnId: string): HTMLElement | null {
    return this.hostRef.nativeElement.querySelector<HTMLElement>(
      `[data-header-focus][data-column="${CSS.escape(columnId)}"]`,
    );
  }

  private requestHeaderFilter(columnId: string): void {
    const anchor = this.cellElement(columnId);
    if (anchor != null) {
      this.headerFilterRequested.emit({ columnId, anchor });
    }
  }

  /**
   * Returns focus to a column's header cell once the render that follows an
   * overlay closing has landed. Public so the grid, which owns the header
   * filter overlay, restores focus the same way the column menu does.
   */
  refocusColumn(columnId: string): void {
    this.refocusAfterRender(columnId);
  }

  /**
   * Opens the column menu on a header cell.
   *
   * The grid's own columns have nothing to offer: every entry the menu builds
   * is disabled for them, and the pin entries would let a locked column be
   * unpinned. The pointer never reaches this for one — their cells draw no
   * menu trigger — so the guard is what `Alt+Down` needs.
   */
  private openMenu(cell: DatagridRenderHeaderCell<TRow>): void {
    const menu = this.menuRef();
    const anchor = this.cellElement(cell.columnId);
    if (menu === undefined || anchor == null || cell.kind !== 'data') {
      return;
    }
    this.menuColumnId = cell.columnId;
    this.menuItems.set(this.buildMenuItems(cell));
    menu.showAt(anchor, undefined, { focusFirstItem: true });
  }

  /**
   * Right-click opens the same menu at the pointer. The built-in columns have
   * nothing to offer, so they keep the browser's own menu rather than opening
   * an empty panel.
   */
  protected onCellContextmenu(cell: DatagridRenderHeaderCell<TRow>, event: MouseEvent): void {
    const menu = this.menuRef();
    if (menu === undefined || cell.kind !== 'data') {
      return;
    }
    this.menuColumnId = cell.columnId;
    this.menuItems.set(this.buildMenuItems(cell));
    // `show` reads the coordinates, suppresses the native menu, and falls back
    // to anchoring on the cell for Shift+F10, which carries none.
    menu.show(event);
  }

  /**
   * Menu labels are translated imperatively, so they are read through the
   * `menu` scope's keys at open time rather than bound in a template.
   */
  private buildMenuItems(cell: DatagridRenderHeaderCell<TRow>): MenuItem[] {
    const columnId = cell.columnId;
    const items: MenuItem[] = [];
    if (cell.sortable) {
      // `checked`, not `disabled`: the direction in force is the user's
      // current choice, not an entry they cannot have.
      items.push(
        {
          label: this.label('datagrid.menu.sortAsc'),
          icon: LucideArrowUpNarrowWide,
          checked: cell.sort === 'asc',
          command: () => {
            this.sortToggled.emit({ columnId, multi: false, direction: 'asc' });
          },
        },
        {
          label: this.label('datagrid.menu.sortDesc'),
          icon: LucideArrowDownWideNarrow,
          checked: cell.sort === 'desc',
          command: () => {
            this.sortToggled.emit({ columnId, multi: false, direction: 'desc' });
          },
        },
      );
      if (cell.sort != null) {
        items.push({
          label: this.label('datagrid.menu.clearSort'),
          icon: LucideArrowUpDown,
          command: () => {
            this.sortToggled.emit({ columnId, multi: true, direction: null });
          },
        });
      }
      items.push({ separator: true });
    }
    if (cell.filterable) {
      items.push(
        {
          label: this.label('datagrid.menu.filter'),
          icon: LucideFunnel,
          command: () => {
            this.requestHeaderFilter(columnId);
          },
        },
        {
          label: this.label('datagrid.menu.clearFilter'),
          icon: LucideFunnelX,
          disabled: !cell.filtered,
          command: () => {
            this.filterCleared.emit({ columnId });
          },
        },
        { separator: true },
      );
    }
    // Pinning moves a column to an edge, so it answers to the same permission
    // reordering does — and a withheld one has no entry rather than a dead one.
    if (cell.reorderable) {
      items.push(
        {
          label: this.label('datagrid.menu.pinStart'),
          icon: LucideArrowLeftToLine,
          checked: cell.pinned === 'start',
          command: () => {
            this.pinned.emit({ columnId, side: 'start' });
          },
        },
        {
          label: this.label('datagrid.menu.pinEnd'),
          icon: LucideArrowRightToLine,
          checked: cell.pinned === 'end',
          command: () => {
            this.pinned.emit({ columnId, side: 'end' });
          },
        },
        {
          // `disabled`, not `checked`: unpinning is an action, and an unpinned
          // column is the default state, so the row must never read as selected.
          label: this.label('datagrid.menu.unpin'),
          icon: LucidePinOff,
          disabled: cell.pinned === false,
          command: () => {
            this.pinned.emit({ columnId, side: false });
          },
        },
      );
    }
    if (this.groupable() && cell.groupable) {
      items.push({ separator: true });
      items.push(
        cell.grouped
          ? {
              label: this.label('datagrid.menu.ungroup'),
              icon: LucideUngroup,
              command: () => {
                this.grouped.emit({ columnId, grouped: false });
              },
            }
          : {
              label: this.label('datagrid.menu.groupBy'),
              icon: LucideGroup,
              command: () => {
                this.grouped.emit({ columnId, grouped: true });
              },
            },
      );
      items.push({
        label: this.label('datagrid.menu.clearGrouping'),
        icon: LucideListX,
        disabled: !this.anyGrouped(),
        command: () => {
          this.groupingCleared.emit();
        },
      });
    }
    if (this.allowRowNumbers()) {
      const numbered = this.showRowNumbers();
      items.push(
        { separator: true },
        {
          label: this.label(
            numbered ? 'datagrid.menu.hideRowNumbers' : 'datagrid.menu.showRowNumbers',
          ),
          icon: LucideListOrdered,
          command: () => {
            this.rowNumbersToggled.emit(!numbered);
          },
        },
      );
    }
    if (cell.hideable) {
      items.push(
        { separator: true },
        {
          label: this.label('datagrid.menu.hide'),
          icon: LucideEyeOff,
          command: () => {
            this.hidden.emit({ columnId });
          },
        },
      );
    }
    return items;
  }

  private anyGrouped(): boolean {
    return this.cells().some((cell) => cell.grouped);
  }

  private label(key: string): string {
    return this.translate()(key);
  }

  protected onSelectAll(state: boolean): void {
    this.selectAllToggled.emit(state);
  }

  // --- Pointer drags ---------------------------------------------------

  protected onHandlePointerdown(cell: DatagridRenderHeaderCell<TRow>, event: PointerEvent): void {
    if (!cell.resizable) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const handle = event.target as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    this.resizeDrag = {
      columnId: cell.columnId,
      pointerId: event.pointerId,
      startX: event.clientX,
    };
    this.resizing.set(cell.columnId);
  }

  protected onHandlePointermove(event: PointerEvent): void {
    const drag = this.resizeDrag;
    if (drag == null) {
      return;
    }
    if (drag.pointerId !== event.pointerId) {
      return;
    }
    const delta = event.clientX - drag.startX;
    if (delta === 0) {
      return;
    }
    // The start moves with each emission, so the deltas are incremental and
    // the grid never has to remember where the drag began.
    drag.startX = event.clientX;
    this.resized.emit({ columnId: drag.columnId, delta, live: true });
  }

  protected onHandlePointerup(event: PointerEvent): void {
    if (this.resizeDrag?.pointerId !== event.pointerId) {
      return;
    }
    this.resizeDrag = null;
    this.resizing.set(null);
    this.resizeEnded.emit();
  }

  protected onCellPointerdown(cell: DatagridRenderHeaderCell<TRow>, event: PointerEvent): void {
    // The click that ends a drag is retargeted to the element holding the
    // pointer capture — this host — so it never reaches a cell to clear the
    // flag it set. Clearing on the next press is what stops a stale flag from
    // eating a later, genuine click.
    this.draggedSinceDown = false;
    this.startReorder(event, {
      id: cell.columnId,
      kind: 'column',
      row: cell.row,
      parentId: cell.parentId,
      caption: cell.caption,
      reorderable: cell.reorderable,
    });
  }

  /** Grabbing a band grabs every column under it. */
  protected onBandPointerdown(cell: DatagridRenderBandCell<TRow>, event: PointerEvent): void {
    this.draggedSinceDown = false;
    this.startReorder(event, {
      id: cell.bandId,
      kind: 'band',
      row: cell.row,
      parentId: cell.parentId,
      caption: cell.caption,
      reorderable: cell.reorderable,
    });
  }

  private startReorder(
    event: PointerEvent,
    unit: {
      id: string;
      kind: HeaderUnitKind;
      row: number;
      parentId: string | null;
      caption: string;
      reorderable: boolean;
    },
  ): void {
    if (!unit.reorderable || event.button !== 0) {
      return;
    }
    // Deliberately no pointer capture yet. Capturing here would retarget the
    // click that follows to this cell, and the click handler routes by what
    // was actually hit — so a press on the menu trigger would arrive looking
    // like a press on the cell and sort the column instead of opening it.
    // Capture starts in `onPointermove`, once this is really a drag.
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.reorderDrag = {
      columnId: unit.id,
      kind: unit.kind,
      row: unit.row,
      parentId: unit.parentId,
      pointerId: event.pointerId,
      grabX: event.clientX - bounds.left,
      grabY: event.clientY - bounds.top,
      caption: unit.caption,
      width: bounds.width,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      pendingOffset: null,
    };
  }

  protected onPointermove(event: PointerEvent): void {
    const drag = this.reorderDrag;
    if (drag == null) {
      return;
    }
    if (drag.pointerId !== event.pointerId) {
      return;
    }
    // Both axes. A drag straight up onto the group panel barely moves the
    // pointer sideways, and a horizontal-only threshold never lets it start.
    if (
      !drag.active &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD
    ) {
      return;
    }
    const host = this.hostRef.nativeElement;
    if (!drag.active) {
      drag.active = true;
      this.dragging.set(drag.columnId);
      this.dragStarted.emit({
        columnId: drag.columnId,
        kind: drag.kind,
        caption: drag.caption,
        width: drag.width,
        grabX: drag.grabX,
        grabY: drag.grabY,
      });
      // Now that this is a drag, capture so it survives the pointer leaving
      // the header and so the matching release always arrives. Capture throws
      // when the id names no active pointer; the drag degrades to header-only
      // tracking without it, so it must not take the handler down.
      try {
        host.setPointerCapture(event.pointerId);
      } catch {
        // No capture available. Moves still arrive while the pointer is over
        // the header, which is where a reorder happens anyway.
      }
    }
    const bounds = host.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    this.dragMoved.emit({
      columnId: drag.columnId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    // The pointer has left the header row, so the gesture is aimed at some
    // other drop target — the group panel above it, most likely. The test is
    // geometric rather than a reading of `suppressReorder` because that input
    // answers a change-detection pass late, and one late frame is one column
    // swapped on the way out.
    const outside = event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside || this.suppressReorder()) {
      drag.pendingOffset = null;
      return;
    }
    this.swapUnder(drag, x);
  }

  /**
   * Takes the place of the column the pointer has moved onto, while it is
   * still moving. The user sees the outcome during the drag, so nothing has to
   * promise one for the drop.
   */
  private swapUnder(drag: ReorderDrag, x: number): void {
    const boxes = this.columnBoxes(drag);
    const dragged = boxes.find((box) => box.id === drag.columnId);
    if (dragged === undefined) {
      return;
    }
    // The layout changes on the emit, but the DOM catches up a render later. A
    // move arriving in between would read the old places and swap the same
    // pair straight back.
    if (drag.pendingOffset === dragged.start) {
      return;
    }
    drag.pendingOffset = null;
    const overId = swapTarget(boxes, drag.columnId, x);
    if (overId == null) {
      return;
    }
    drag.pendingOffset = dragged.start;
    this.reordered.emit({ columnId: drag.columnId, overId, kind: drag.kind });
  }

  /**
   * Where the drag's own siblings sit, in the header's own coordinate space.
   *
   * Only the cells in the grabbed cell's row and under the same band are
   * offered, so a drag can reach every position inside its band and none
   * outside it. In an unbanded header that is every column, exactly as before.
   *
   * `offsetLeft`, not `getBoundingClientRect`: a transform does not move it, so
   * a swap still sliding into place is measured where it lands rather than
   * where it is drawn — otherwise one swap reads as the next and the columns
   * oscillate.
   */
  private columnBoxes(drag: ReorderDrag): ColumnBox[] {
    const siblings = new Map(
      this.navRows()
        [drag.row].filter((cell) => cell.parentId === drag.parentId)
        .map((cell) => [cell.id, cell.reorderable]),
    );
    const boxes: ColumnBox[] = [];
    for (const cell of this.hostRef.nativeElement.querySelectorAll<HTMLElement>(
      '[role="columnheader"][data-column]',
    )) {
      const id = cell.getAttribute('data-column');
      const reorderable = id == null ? undefined : siblings.get(id);
      if (id != null && reorderable !== undefined) {
        boxes.push({ id, start: cell.offsetLeft, width: cell.offsetWidth, reorderable });
      }
    }
    return boxes;
  }

  protected onPointerup(event: PointerEvent): void {
    const drag = this.reorderDrag;
    // A release from some other pointer must not end this drag.
    if (drag != null && drag.pointerId !== event.pointerId) {
      return;
    }
    this.reorderDrag = null;
    this.dragging.set(null);
    // Read by the click that follows this release. The drag record cannot
    // answer that question because it has already been cleared by then.
    this.draggedSinceDown = drag?.active === true;
    if (drag?.active !== true) {
      return;
    }
    this.reorderEnded.emit();
    this.refocusAfterRender(drag.columnId);
  }

  /** True when the press that just ended was a drag, so it must not also sort. */
  private consumedDrag(): boolean {
    const dragged = this.draggedSinceDown;
    this.draggedSinceDown = false;
    return dragged;
  }

  protected isRoving(columnId: string): boolean {
    return this.roving() === columnId;
  }

  protected onMenuClosed(): void {
    const columnId = this.menuColumnId;
    this.menuColumnId = null;
    if (columnId != null) {
      this.refocusAfterRender(columnId);
    }
  }
}

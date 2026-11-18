import type { Signal, WritableSignal } from '@angular/core';
import type { GridCapabilityMask } from './capabilities.types';
import type { ResolvedDatagridView } from './types/card.types';
import type { SortDirection } from './sort-cycle.types';
import type { ExportOptions } from './types/export.types';
import type { SelectionMode } from './selection.store.types';
import type {
  ToolbarComponentRenderer,
  ToolbarLocation,
  ToolbarOverflowPolicy,
} from './toolbar.types';

/**
 * What the host said about one entry beyond which entry it is.
 *
 * The grid gives every built-in item the placement it considers natural, and
 * these override it. `iconOnly` also carries the bar-wide default down, so an
 * item that states nothing still follows the toolbar.
 */
export interface ToolbarEntryOverrides {
  readonly location?: ToolbarLocation;
  readonly order?: number;
  readonly overflow?: ToolbarOverflowPolicy;
  readonly iconOnly?: boolean;
  /** The grid loads. A host item with `busy: 'reload'` is blocked for as long. */
  readonly loading?: boolean;
  /** The grid reloads. A host item with `busy: 'reload'` spins for as long. */
  readonly refreshing?: boolean;
}

/**
 * One column the sort menu offers.
 *
 * Flattened by the shell rather than passed as a `ColumnDef`: the menu needs
 * the caption and the direction in force, and an entry holding a column would
 * let the toolbar reach the whole column model.
 */
export interface SortMenuColumn {
  readonly id: string;
  readonly caption: string;
  /** The direction in force on this column, or `null` when it is unsorted. */
  readonly direction: SortDirection | null;
}

/**
 * What the built-in toolbar items read and do.
 *
 * The shell supplies it once. Stated as one contract because a built-in item is
 * the only place the toolbar reaches into the grid at all: everything else the
 * bar draws arrives as a declared {@link ToolbarItem}.
 */
export interface ToolbarEntryDeps {
  /** Whether a capability is granted, so a withheld item resolves to nothing. */
  readonly allows: (capability: keyof GridCapabilityMask) => boolean;
  readonly loading: Signal<boolean>;
  /** A load of data the grid has already shown. The first load is not one. */
  readonly refreshing: Signal<boolean>;
  readonly selectionMode: Signal<SelectionMode>;
  /** `Infinity` for an `allMatching` selection, which has no count. */
  readonly selectedCount: Signal<number>;
  readonly hasSelection: Signal<boolean>;
  readonly hasFilterRow: Signal<boolean>;
  readonly filterRowShown: WritableSignal<boolean>;
  readonly groupPanelShown: WritableSignal<boolean>;
  readonly canExport: Signal<boolean>;
  readonly exportFormats: Signal<readonly string[]>;
  /** An export is running, so every export affordance is inert. */
  readonly exportBusy: Signal<boolean>;
  readonly autoRefresh: WritableSignal<boolean>;
  readonly autoRefreshInterval: WritableSignal<number>;
  readonly refreshIntervals: Signal<readonly number[]>;
  readonly refreshSuspended: Signal<boolean>;
  readonly reload: () => void;
  readonly toggleAutoRefresh: () => void;
  readonly resetArrangement: () => void;
  readonly clearSelection: () => void;
  readonly exportGrid: (format: string, options?: ExportOptions) => void;
  /** Columns the sort menu offers, in visible order. Empty withholds the item. */
  readonly sortColumns: Signal<readonly SortMenuColumn[]>;
  readonly hasSort: Signal<boolean>;
  /** Advances one column through asc, desc and unsorted. */
  readonly cycleSort: (columnId: string) => void;
  readonly clearSort: () => void;
  /** Whether the grid offers the expression editor at all. */
  readonly hasFilterBuilder: Signal<boolean>;
  /** Opens the expression editor, anchored on the press that asked for it. */
  readonly openFilterBuilder: (event: MouseEvent) => void;
  readonly view: Signal<ResolvedDatagridView>;
  readonly setView: (view: ResolvedDatagridView) => void;
  /**
   * The views strip as a renderer, or `null` when views are off or its chunk
   * has not landed. The strip is reached by a dynamic import, so the entry has
   * to be able to resolve to nothing for a render or two.
   */
  readonly viewsRenderer: Signal<ToolbarComponentRenderer | null>;
}

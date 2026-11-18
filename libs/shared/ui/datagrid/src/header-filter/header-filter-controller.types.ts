import type { Injector } from '@angular/core';
import type { PopoverService } from '@ui/popover';
import type { ColumnDef } from '../core/types/column.types';
import type { DistinctValuesRequest } from '../core/types/query.types';
import type { DistinctLoadResult, ValueBounds } from '../core/data.store.types';
import type { FilterNode } from '../core/types/filter.types';

/**
 * What the header filter surface needs from the grid.
 *
 * Narrow functions rather than the stores themselves: the panel loads a value
 * domain, reads one column's filter slot and writes it back, and nothing here
 * should let it reach further than that.
 */
export interface HeaderFilterDeps<TRow> {
  readonly injector: Injector;
  readonly popover: PopoverService;
  /** Resolves an i18n key. Returns the key while the scope is still loading. */
  readonly translate: (key: string, params: Record<string, unknown>) => string;
  readonly columnById: (columnId: string) => ColumnDef<TRow> | undefined;
  /** Entries the panel shows before it offers "show more". */
  readonly pageSize: () => number;
  /** Loaded rows, which is all a remote source has sent. */
  readonly dataRows: () => readonly TRow[];
  /** Renders a value the way its column displays it. */
  readonly formatValue: () => (value: unknown, column: ColumnDef<TRow> | undefined) => string;
  /** A lookup's caption for a raw value, or `undefined` when there is none. */
  readonly displayOf: (columnId: string, value: unknown) => unknown;
  readonly loadDistinct: (request: DistinctValuesRequest) => Promise<DistinctLoadResult>;
  readonly loadValueBounds: (field: string, signal?: AbortSignal) => Promise<ValueBounds | null>;
  readonly cancelDistinctLoad: () => void;
  readonly headerFilterOf: (columnId: string) => FilterNode | null;
  readonly setHeaderFilter: (columnId: string, node: FilterNode | null) => void;
  /** Reports whether the panel is up, which suspends auto-refresh. */
  readonly setOpen: (open: boolean) => void;
  /** True once the view is gone, so the close handler renders nothing. */
  readonly isDestroyed: () => boolean;
  /** Returns focus to the header cell the panel hung from. */
  readonly refocusColumn: (columnId: string) => void;
  readonly announceApplied: (columnId: string) => void;
  readonly announceCleared: (columnId: string) => void;
}

/** The subset of the panel's component reference the loading code writes to. */
export interface PanelInputs {
  setInput(name: string, value: unknown): void;
}

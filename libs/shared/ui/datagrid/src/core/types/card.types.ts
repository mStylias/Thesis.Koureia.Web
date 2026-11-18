/**
 * The card view (§5.4).
 *
 * A grid with more columns than a phone can show has no honest table form, so
 * the same grid draws one card per row instead. The card reads the columns the
 * table reads — nothing is declared twice — and this file holds only what the
 * card presentation adds on top of {@link ColumnDef}.
 */
import type { GridApi } from './api.types';
import type { ColumnDef, RendererRef } from './column.types';
import type { GridKey } from './key.types';

/**
 * Where a column's value sits on a card.
 *
 * Resolved from the column when it says nothing: the primary column is the
 * title, and everything else is a labelled field row in visible-column order.
 * `'none'` drops the column from the card while it stays in the table, which
 * is what an id or a sort helper wants.
 */
export type CardFieldRole = 'title' | 'subtitle' | 'meta' | 'field' | 'actions' | 'media' | 'none';

/** How one column draws on a card. Every key refines a resolved default. */
export interface CardColumnSpec {
  role?: CardFieldRole;
  /** Position among entries of the same role. Falls back to column order. */
  order?: number;
  /** Draw the value without its caption. Default `true` for every role but `'field'`. */
  hideLabel?: boolean;
  /** Let the entry span both tracks of the card's field grid. */
  wide?: boolean;
}

/** Card view behavior. Structure only — every measure resolves from tokens. */
export interface CardViewConfig {
  /**
   * Narrowest a card may be drawn, in pixels. The flow fits as many cards of
   * at least this width as the grid is wide, so the column count follows the
   * container rather than the viewport. Default 280.
   */
  minWidth?: number;
  /** Draw field captions. Off leaves values alone, which suits a dense card. */
  showLabels?: boolean;
  /** Renderer for the whole card, replacing the resolved fields. */
  renderer?: RendererRef;
}

/** Which presentation the grid draws. `'auto'` follows the viewport width. */
export type DatagridView = 'table' | 'cards' | 'auto';

/** The presentation in force, once `'auto'` has resolved. */
export type ResolvedDatagridView = 'table' | 'cards';

/** A breakpoint name, mirroring `$breakpoints` in the core SCSS scale. */
export type DatagridBreakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Context of a whole-card renderer. */
export interface CardContext<TRow = unknown> {
  row: TRow;
  key: GridKey;
  /** Absolute index in the dataset, not the rendered index. */
  rowIndex: number;
  selected: boolean;
  /** Whether the card's detail region is open. `null` when it has none. */
  expanded: boolean | null;
  /** The columns the card would have drawn, in card order. */
  columns: readonly ColumnDef<TRow>[];
  api: GridApi<TRow>;
}

/** What a card `ng-template` receives. */
export interface CardTemplateContext<TRow = unknown> extends CardContext<TRow> {
  $implicit: CardContext<TRow>;
}

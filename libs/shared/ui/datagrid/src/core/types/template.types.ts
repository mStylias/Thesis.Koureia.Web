/**
 * The renderer slot map (§6.1).
 *
 * Every slot the grid draws is addressable as a value here, in addition to the
 * `ng-template` directive that names it. A slot reachable only by projection
 * is unusable from a wrapper — a content query matches by declaration site, so
 * a template written inside `<app-grid>` belongs to the app's view however many
 * projection hops it takes — and it fails silently, with an empty region and no
 * error. One binding of this map carries every renderer across that boundary.
 *
 * Resolution order, the same for every slot:
 *
 * 1. the `ng-template` directive written on this grid,
 * 2. this map,
 * 3. the reference on the `ColumnDef`, `SummaryConfig` or `DetailConfig`.
 *
 * A directive and this map are both written on this grid, so the more specific
 * declaration wins; a definition reference may come from shared configuration
 * that knows nothing about this screen, so it loses to both.
 */
import type { RendererRef } from './column.types';

/** Host renderers for every slot, as values. */
export interface GridTemplates {
  /** Cell renderers by column id. */
  cell?: Readonly<Record<string, RendererRef>>;
  /** Header renderers by column id. */
  header?: Readonly<Record<string, RendererRef>>;
  /** Group header renderers by grouped column id; `''` draws every group. */
  group?: Readonly<Record<string, RendererRef>>;
  /** Summary cell renderers by the column id the summary aligns under. */
  summary?: Readonly<Record<string, RendererRef>>;
  /** Toolbar item renderers by item id. */
  toolbarItem?: Readonly<Record<string, RendererRef>>;
  /** The expanded row detail. Supplying one is what makes rows expandable. */
  detail?: RendererRef;
  /** A whole card in the card view, replacing the fields resolved from columns. */
  card?: RendererRef;
  /** Replaces the "no data at all" state. */
  empty?: RendererRef;
  /** Replaces the "no results for the current filter" state. */
  noResults?: RendererRef;
  /** Replaces the load-failure state, including its retry affordance. */
  error?: RendererRef;
  /** Replaces the initial-load skeleton. */
  loading?: RendererRef;
}

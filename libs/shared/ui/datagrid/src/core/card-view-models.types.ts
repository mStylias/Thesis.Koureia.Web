import type { CardFieldPlan } from './card-fields.types';
import type { ResolvedRenderer } from './renderer-ref.types';
import type { GridApi } from './types/api.types';
import type { CardTemplateContext } from './types/card.types';
import type { ColumnDef } from './types/column.types';
import type { Decoration } from './types/config.types';
import type {
  CellTemplateContext,
  DetailTemplateContext,
  GroupRowTemplateContext,
} from './types/context.types';
import type { GridKey } from './types/key.types';
import type { DatagridRenderCard } from '../datagrid.types';

/** One data row handed to the card builder. */
export interface CardViewModelItem<TRow> {
  key: GridKey;
  row: TRow;
  dataIndex: number;
}

/**
 * A cached card, with everything the builder compares before handing the same
 * object back. Narrower than the table's row cache: a card carries no layout,
 * no ARIA index and no flash history, because it has no column tracks to hold
 * them.
 */
export interface CachedCard<TRow> {
  row: TRow;
  index: number;
  selected: boolean;
  expanded: boolean | null;
  plan: CardFieldPlan<TRow>;
  renderVersion: number;
  vm: DatagridRenderCard<TRow>;
}

/** What the card builder reads. Every entry is a getter, as the shell's are. */
export interface CardViewModelDeps<TRow> {
  readonly api: () => GridApi<TRow>;
  readonly plan: () => CardFieldPlan<TRow>;
  readonly isSelected: (key: GridKey) => boolean;
  readonly isExpanded: (key: GridKey) => boolean;
  /** `false` leaves cards unexpandable, as it leaves rows unexpandable. */
  readonly hasDetail: () => boolean;
  readonly cellRenderers: () => ReadonlyMap<string, ResolvedRenderer<CellTemplateContext<TRow>>>;
  readonly groupRenderers: () => ReadonlyMap<
    string,
    ResolvedRenderer<GroupRowTemplateContext<TRow>>
  >;
  readonly detailRenderer: () => ResolvedRenderer<DetailTemplateContext<TRow>>;
  /** Replaces the resolved fields with the host's own card. */
  readonly cardRenderer: () => ResolvedRenderer<CardTemplateContext<TRow>>;
  readonly decorateRow: () => ((row: TRow) => Decoration | null) | null | undefined;
  readonly decorateCell: () =>
    | ((row: TRow, columnId: string) => Decoration | null)
    | null
    | undefined;
  readonly booleanLabels: () => { true: string; false: string } | undefined;
  /** IANA zone dates render in. `undefined` is the host environment's. */
  readonly timezone: () => string | undefined;
  /** BCP 47 tag values are formatted in. `undefined` is the host environment's. */
  readonly locale: () => string | undefined;
  /** The value a field shows, after `display`, a lookup and a formatter. */
  readonly displayFor: (row: TRow, column: ColumnDef<TRow>, value: unknown) => unknown;
  readonly columnsByField: () => ReadonlyMap<string, ColumnDef<TRow>>;
  readonly toggleGroup: (path: readonly unknown[]) => void;
  readonly collapseRow: (key: GridKey) => void;
}

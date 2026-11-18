import type { CardFieldRole } from './types/card.types';
import type { ColumnDef } from './types/column.types';

/** One column, resolved to its place on the card. */
export interface CardFieldEntry<TRow> {
  column: ColumnDef<TRow>;
  id: string;
  /** The column's caption, which is the field's label. */
  label: string;
  hideLabel: boolean;
  wide: boolean;
}

/**
 * Every column the card draws, grouped by role and ordered within each.
 *
 * Built once per column set rather than per row: a card is built for each row
 * in the page, and resolving roles there would repeat the same work.
 */
export interface CardFieldPlan<TRow> {
  title: CardFieldEntry<TRow> | null;
  subtitle: CardFieldEntry<TRow> | null;
  media: CardFieldEntry<TRow> | null;
  meta: readonly CardFieldEntry<TRow>[];
  fields: readonly CardFieldEntry<TRow>[];
  actions: readonly CardFieldEntry<TRow>[];
  /** Every entry above in one list, which is what a whole-card renderer gets. */
  all: readonly CardFieldEntry<TRow>[];
}

/** What {@link planCardFields} is told beyond the columns. */
export interface CardFieldPlanOptions {
  /** Whether a column is the record's identifier, which defaults it to the title. */
  readonly isPrimary: (id: string) => boolean;
  /** Draw field captions at all. */
  readonly showLabels: boolean;
}

/** A resolved role paired with the column that carries it. */
export interface RoleAssignment<TRow> {
  role: CardFieldRole;
  entry: CardFieldEntry<TRow>;
  order: number;
}

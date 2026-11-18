/**
 * The primary column (§5.1): the column that renders the record's identifier.
 *
 * §5.1 states its behaviour rather than leaving it to the host — pinned,
 * non-hideable, non-reorderable — so the grid writes those rules onto the
 * definition instead of trusting each caller to repeat them.
 */
import { isDevMode } from '@angular/core';
import type { ColumnDef, PrimarySpec } from './types/column.types';

/** The primary declaration of a column, or `null` when it is an ordinary one. */
export function primarySpecOf<TRow>(column: ColumnDef<TRow>): PrimarySpec<TRow> | null {
  const primary = column.primary;
  if (primary == null || primary === false) {
    return null;
  }
  return primary === true ? {} : primary;
}

/**
 * Applies §5.1's rules to whichever column declares itself primary.
 *
 * Returns the input array when no column does, so an ordinary grid allocates
 * nothing. A second primary column is reported and left as an ordinary one:
 * "the record's identifier" is singular, and picking a winner silently would
 * hide the mistake.
 */
export function applyPrimaryRules<TRow>(
  columns: readonly ColumnDef<TRow>[],
  reported: Set<string>,
): readonly ColumnDef<TRow>[] {
  const first = columns.findIndex((column) => primarySpecOf(column) != null);
  if (first < 0) {
    return columns;
  }
  return columns.map((column, index) => {
    if (primarySpecOf(column) == null) {
      return column;
    }
    if (index !== first) {
      warnOnce(column.id, `datagrid: column "${column.id}" is a second primary column.`, reported);
      return { ...column, primary: false };
    }
    return {
      ...column,
      // The declared edge is honoured; a primary column that declares none
      // goes to the start, where a record's identifier is read first.
      pinned: column.pinned === 'end' ? 'end' : 'start',
      allow: { ...column.allow, hiding: false, reordering: false },
    };
  });
}

function warnOnce(id: string, message: string, reported: Set<string>): void {
  if (!isDevMode() || reported.has(id)) {
    return;
  }
  reported.add(id);
  console.warn(message);
}

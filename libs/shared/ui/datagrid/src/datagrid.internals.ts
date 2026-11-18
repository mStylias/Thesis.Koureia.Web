/** Pure helpers the grid shell uses. None of them reads component state. */
import type { Type } from '@angular/core';
import {
  DETAIL_COLUMN_ID,
  ROW_NUMBER_COLUMN_ID,
  SELECTION_COLUMN_ID,
} from './core/builtin-columns';
import type { GridLoadError } from './core/types/query.types';
import type { DatagridCellKind, DatagridComponentRenderer } from './datagrid.types';

/**
 * Adds `$implicit` so a renderer can bind the whole context with `let-cell`
 * while named bindings such as `let-row="row"` keep working.
 */
export function withImplicit<T extends object>(context: T): T & { $implicit: T } {
  return { ...context, $implicit: context };
}

/**
 * An export failure as data, like every other failure the grid reports (§4.3).
 * The query is empty: an export spans many queries, so naming one would be
 * misleading rather than helpful.
 */
export function toExportError(cause: unknown, format: string): GridLoadError {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'Export failed';
  return { message: `${format}: ${message}`, cause, query: {} };
}

/**
 * Whether a rejection is the export's own cancellation.
 *
 * Repeated here rather than imported from the export modules: importing a
 * one-line predicate would pull the whole export chunk into the shell's
 * bundle, which is what the dynamic imports exist to prevent.
 */
export function isExportAbort(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

/** What a header cell draws: a host caption, or one of the grid's own controls. */
export function headerCellKind(columnId: string): DatagridCellKind {
  switch (columnId) {
    case SELECTION_COLUMN_ID:
      return 'selection';
    case ROW_NUMBER_COLUMN_ID:
      return 'rowNumber';
    case DETAIL_COLUMN_ID:
      return 'detailToggle';
    default:
      return 'data';
  }
}

/**
 * Packs a component renderer for `NgComponentOutlet`. The input map is built
 * once with the view model, so the outlet diffs inputs on an existing
 * instance instead of recreating it — renderers are recycled.
 */
export function componentRenderer(
  component: Type<unknown> | null,
  context: unknown,
): DatagridComponentRenderer | null {
  return component == null ? null : { type: component, inputs: { context } };
}

/**
 * Whether two cell values are the same for the purpose of flashing.
 *
 * Only comparable values can be judged. A computed `display` returning a fresh
 * object every render would never equal its predecessor, and the cell would
 * flash on every pass — so anything that is not a primitive or a date is
 * treated as unchanged rather than guessed at.
 */
export function sameCellValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (isComparable(a) && isComparable(b)) {
    return Object.is(a, b);
  }
  return true;
}

function isComparable(value: unknown): boolean {
  return (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  );
}

/**
 * A readable account of what is filtering the grid.
 *
 * The filter panel renders these entries, and the filter row reads
 * {@link FilterSummaryEntry.representable} to know when a column carries an
 * expression it cannot show — §7.3 requires the grid to indicate that rather
 * than drop it.
 */
import { columnField } from '../column.store';
import { flattenAnd, readColumnFilter } from './column-filter';
import { filterOperatorArity, filterOperatorLabelKey, relativeFilterLabelKey } from './operators';
import { isConditionNode } from './filter-node';
import type { ColumnDef } from '../types/column.types';
import type { FilterOperator } from '../types/filter.types';
import type { FilterSummaryEntry, FilterSummaryInput } from './filter-summary.types';

/** Every active filter, in the order the panel lists them. */
export function describeFilters<TRow>(
  input: FilterSummaryInput<TRow>,
): readonly FilterSummaryEntry[] {
  const byId = new Map(input.columns.map((column) => [column.id, column]));
  const byField = new Map(input.columns.map((column) => [columnField(column), column]));
  const entries: FilterSummaryEntry[] = [];

  for (const [columnId, node] of input.columnFilters) {
    const column = byId.get(columnId);
    const field = column == null ? columnId : columnField(column);
    const read = readColumnFilter(node, field);
    entries.push({
      id: `column:${columnId}`,
      source: 'column',
      columnId,
      caption: captionOf(column, columnId),
      labelKey: read == null ? 'datagrid.filterPanel.expression' : filterOperatorLabelKey(read.op),
      labelParams: {},
      text: read == null ? '' : formatOperand(read.op, read.value, column, input.formatValue),
      representable: read != null,
    });
  }

  // A header filter is a set the user assembled from a value list. It is not
  // an expression the filter row failed to show, so it carries no warning:
  // `representable` marks an anomaly, and a filter living in its own surface
  // is not one. A host option list compiles to an `or` that reads as no single
  // condition, and that is still a normal selection.
  for (const [columnId, node] of input.headerFilters ?? []) {
    const column = byId.get(columnId);
    const field = column == null ? columnId : columnField(column);
    const read = readColumnFilter(node, field);
    entries.push({
      id: `header:${columnId}`,
      source: 'header',
      columnId,
      caption: captionOf(column, columnId),
      labelKey: read == null ? 'datagrid.filterPanel.values' : filterOperatorLabelKey(read.op),
      labelParams: {},
      text: read == null ? '' : formatOperand(read.op, read.value, column, input.formatValue),
      representable: true,
    });
  }

  for (const [columnId, relative] of input.relativeFilters) {
    const column = byId.get(columnId);
    entries.push({
      id: `relative:${columnId}`,
      source: 'relative',
      columnId,
      caption: captionOf(column, columnId),
      labelKey: relativeFilterLabelKey(relative.filter),
      labelParams: { amount: relative.filter.amount },
      text: '',
      representable: true,
    });
  }

  flattenAnd(input.tree).forEach((node, index) => {
    const column = isConditionNode(node) ? byField.get(node.field) : undefined;
    const read = column == null ? null : readColumnFilter(node, columnField(column));
    entries.push({
      id: `tree:${index.toString()}`,
      source: 'tree',
      columnId: column?.id ?? null,
      caption: column?.caption ?? (isConditionNode(node) ? node.field : ''),
      labelKey: read == null ? 'datagrid.filterPanel.expression' : filterOperatorLabelKey(read.op),
      labelParams: {},
      text: read == null ? '' : formatOperand(read.op, read.value, column, input.formatValue),
      representable: read != null,
    });
  });

  if (input.search != null && input.search !== '') {
    entries.push({
      id: 'search',
      source: 'search',
      columnId: null,
      caption: '',
      labelKey: 'datagrid.filterPanel.search',
      labelParams: {},
      text: input.search,
      representable: true,
    });
  }

  return entries;
}

function captionOf<TRow>(column: ColumnDef<TRow> | undefined, fallback: string): string {
  return column?.caption ?? column?.field ?? fallback;
}

/** The operand as text: a range joins its bounds, a list joins its members. */
function formatOperand<TRow>(
  op: FilterOperator,
  value: unknown,
  column: ColumnDef<TRow> | undefined,
  format: (value: unknown, column: ColumnDef<TRow> | undefined) => string,
): string {
  const arity = filterOperatorArity(op);
  if (arity === 'none') {
    return '';
  }
  if (arity === 'range' || arity === 'list') {
    const values = Array.isArray(value) ? value : [];
    return values
      .filter((entry) => entry != null && entry !== '')
      .map((entry) => format(entry, column))
      .join(' – ');
  }
  return format(value, column);
}

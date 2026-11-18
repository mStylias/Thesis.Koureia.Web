/**
 * Which operators a column offers, and what each one asks the user for.
 *
 * The sets are ordered by how often a column of that type is filtered with
 * them, because the first entry is the operator a fresh filter row cell
 * starts on.
 */
import type { ColumnDataType, ColumnDef } from '../types/column.types';
import type {
  FilterOperator,
  FilterOperatorArity,
  RelativeDateFilter,
} from '../types/filter.types';

const TEXT_OPERATORS: readonly FilterOperator[] = [
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'eq',
  'ne',
  'isNull',
  'isNotNull',
];

const NUMBER_OPERATORS: readonly FilterOperator[] = [
  'eq',
  'ne',
  'lt',
  'le',
  'gt',
  'ge',
  'between',
  'isNull',
  'isNotNull',
];

// No `ne`: a date editor collects a day, and "not on this day" over a
// `datetime` column would have to negate a range. The set stays to what one
// condition can say truthfully; the expression editor covers the rest.
const DATE_OPERATORS: readonly FilterOperator[] = [
  'eq',
  'between',
  'lt',
  'le',
  'gt',
  'ge',
  'isNull',
  'isNotNull',
];

const BOOLEAN_OPERATORS: readonly FilterOperator[] = ['eq', 'isNull', 'isNotNull'];

const BY_DATA_TYPE: Readonly<Record<ColumnDataType, readonly FilterOperator[]>> = {
  string: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  datetime: DATE_OPERATORS,
  time: DATE_OPERATORS,
};

/**
 * Presets a date column offers when it declares none. Amounts stay above one,
 * so no label has to read "the last 1 day".
 */
export const DEFAULT_RELATIVE_PRESETS: readonly RelativeDateFilter[] = [
  { direction: 'last', amount: 7, unit: 'day' },
  { direction: 'last', amount: 30, unit: 'day' },
  { direction: 'last', amount: 3, unit: 'month' },
  { direction: 'next', amount: 7, unit: 'day' },
  { direction: 'next', amount: 30, unit: 'day' },
];

/** Operators offered for a data type. Unknown types are treated as text. */
export function filterOperatorsForType(
  dataType: ColumnDataType | undefined,
): readonly FilterOperator[] {
  return dataType == null ? TEXT_OPERATORS : BY_DATA_TYPE[dataType];
}

/** Operators a column offers: its own declaration, or its data type's set. */
export function filterOperatorsFor<TRow>(column: ColumnDef<TRow>): readonly FilterOperator[] {
  const declared = column.filter?.operators;
  return declared != null && declared.length > 0
    ? declared
    : filterOperatorsForType(column.dataType);
}

/** The operator a fresh filter row cell starts on. */
export function defaultFilterOperator<TRow>(column: ColumnDef<TRow>): FilterOperator {
  const operators = filterOperatorsFor(column);
  const declared = column.filter?.defaultOperator;
  return declared != null && operators.includes(declared) ? declared : operators[0];
}

/** How many values the operator's editor collects. */
export function filterOperatorArity(op: FilterOperator): FilterOperatorArity {
  switch (op) {
    case 'isNull':
    case 'isNotNull':
      return 'none';
    case 'between':
      return 'range';
    case 'in':
    case 'notIn':
      return 'list';
    default:
      return 'single';
  }
}

/** Message key naming an operator. Translated by a pipe, never imperatively. */
export function filterOperatorLabelKey(op: FilterOperator): string {
  return `datagrid.filterOperator.${op}`;
}

/**
 * Message key naming a relative preset.
 *
 * One key per direction and unit rather than one per direction: Greek inflects
 * the adjective with the gender of the unit, so "last {{amount}}" cannot be
 * composed from two fragments.
 */
export function relativeFilterLabelKey(filter: RelativeDateFilter): string {
  const named = NAMED_DAY_PERIODS.get(`${filter.direction}:${filter.amount.toString()}`);
  if (filter.unit === 'day' && named !== undefined) {
    return `datagrid.relative.${named}`;
  }
  const unit = filter.unit.charAt(0).toUpperCase() + filter.unit.slice(1);
  return `datagrid.relative.${filter.direction}${unit}`;
}

/** Day-aligned periods that read better by name than by count. */
const NAMED_DAY_PERIODS: ReadonlyMap<string, string> = new Map([
  ['on:0', 'today'],
  ['on:1', 'tomorrow'],
  ['on:-1', 'yesterday'],
  ['from:0', 'fromToday'],
  ['before:0', 'beforeToday'],
]);

/** Relative presets a column offers on its filter row cell. */
export function relativePresetsFor<TRow>(column: ColumnDef<TRow>): readonly RelativeDateFilter[] {
  if (!isDateColumn(column)) {
    return [];
  }
  return column.filter?.relativePresets ?? DEFAULT_RELATIVE_PRESETS;
}

/** True for a column whose values are instants. */
export function isDateColumn<TRow>(column: ColumnDef<TRow>): boolean {
  return column.dataType === 'date' || column.dataType === 'datetime' || column.dataType === 'time';
}

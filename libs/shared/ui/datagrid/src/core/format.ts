/**
 * Cell value pipeline.
 *
 * The formatter path is a pure value-to-string function and is the default:
 * a cell renders text through it without instantiating a renderer.
 */
import { getPath } from './paths';
import type { ColumnDef, FormatSpec } from './types/column.types';
import type { FormatOptions } from './format.types';
// Constructing an Intl formatter costs far more than using one, and a scroll
// frame formats hundreds of cells. The distinct option sets are bounded by the
// column definitions, so caching them outright is safe.
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const cacheKey = `${locale ?? ''}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

function dateFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cacheKey = `${locale ?? ''}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

/** Reads the underlying value of a cell. */
export function resolveCellValue<TRow>(row: TRow, column: ColumnDef<TRow>): unknown {
  if (column.value) {
    return column.value(row);
  }
  return column.field == null ? undefined : getPath(row, column.field);
}

/** Reads the display value, falling back to the underlying value. */
export function resolveDisplayValue<TRow>(
  row: TRow,
  column: ColumnDef<TRow>,
  value: unknown,
): unknown {
  const display = column.display;
  if (typeof display === 'function') {
    return display(row);
  }
  if (typeof display === 'string') {
    return getPath(row, display);
  }
  return value;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatNumeric(
  value: unknown,
  spec: Exclude<FormatSpec, (value: unknown) => string>,
  locale: string | undefined,
): string | null {
  if (spec.type !== 'number' && spec.type !== 'currency' && spec.type !== 'percent') {
    return null;
  }
  const numeric = toNumber(value);
  if (numeric == null) {
    return null;
  }
  const options: Intl.NumberFormatOptions = {};
  if (spec.type === 'currency') {
    options.style = 'currency';
    options.currency = spec.currency ?? 'EUR';
  } else if (spec.type === 'percent') {
    options.style = 'percent';
  }
  if (spec.precision != null) {
    options.minimumFractionDigits = spec.precision;
    options.maximumFractionDigits = spec.precision;
  }
  return numberFormatter(locale, options).format(numeric);
}

function formatTemporal(
  value: unknown,
  spec: Exclude<FormatSpec, (value: unknown) => string>,
  options: FormatOptions,
): string | null {
  if (spec.type !== 'date' && spec.type !== 'datetime' && spec.type !== 'time') {
    return null;
  }
  const date = toDate(value);
  if (date == null) {
    return null;
  }
  const intlOptions: Intl.DateTimeFormatOptions = {};
  if (options.timezone != null) {
    intlOptions.timeZone = options.timezone;
  }
  if (spec.type === 'date' || spec.type === 'datetime') {
    intlOptions.dateStyle = 'medium';
  }
  if (spec.type === 'time' || spec.type === 'datetime') {
    intlOptions.timeStyle = 'short';
    intlOptions.hourCycle = 'h23';
  }
  return dateFormatter(options.locale, intlOptions).format(date);
}

/**
 * Renders a cell value as text. Null and undefined render as an empty
 * string, so an absent value never prints `null`.
 */
export function formatCellText<TRow>(
  value: unknown,
  column: ColumnDef<TRow>,
  options: FormatOptions = {},
): string {
  const format = column.format;
  if (typeof format === 'function') {
    return format(value);
  }
  if (value == null) {
    return '';
  }
  if (format != null) {
    const formatted =
      formatNumeric(value, format, options.locale) ?? formatTemporal(value, format, options);
    if (formatted != null) {
      return formatted;
    }
  }
  if (typeof value === 'boolean') {
    const labels = options.booleanLabels;
    return labels ? (value ? labels.true : labels.false) : String(value);
  }
  if (value instanceof Date) {
    return dateFormatter(options.locale, {
      dateStyle: 'medium',
      ...(options.timezone == null ? {} : { timeZone: options.timezone }),
    }).format(value);
  }
  if (typeof value === 'number') {
    return numberFormatter(options.locale, {}).format(value);
  }
  if (typeof value === 'bigint') {
    return numberFormatter(options.locale, {}).format(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  // An object or symbol has no useful text form. Printing "[object Object]"
  // into a cell helps nobody: such a column needs a `format` function or a
  // cell renderer.
  return '';
}

/**
 * The value of a group level, formatted as its column would display it.
 *
 * Falls back to a bare column identified only by the field, so a group on a
 * field no column reads still renders its value as text.
 */
export function formatGroupValue<TRow>(
  value: unknown,
  field: string | undefined,
  columnsByField: ReadonlyMap<string, ColumnDef<TRow>>,
  booleanLabels: { true: string; false: string } | undefined,
): string {
  const column = field == null ? undefined : columnsByField.get(field);
  return formatCellText(value, column ?? { id: field ?? '' }, { booleanLabels });
}

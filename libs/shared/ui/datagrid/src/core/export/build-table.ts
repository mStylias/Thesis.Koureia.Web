/**
 * The normalized table model (§15).
 *
 * Headless: definitions and rows in, an {@link ExportTable} out. Every
 * adapter — delimited text, the clipboard, the spreadsheet writer and the
 * print view — reads this one model, so what an export contains is decided
 * once and tested without a view.
 *
 * The model honors what the grid shows: visible columns in their current
 * order, the current grouping and its aggregates, the current formatting, and
 * `allow.exporting`. Filters and sorting reach it through the rows the caller
 * hands over, which are the result of the current query.
 */
import { indexColumnBands } from '../column-bands';
import type { BandIndex } from '../column-bands.types';
import { formatCellText, resolveCellValue, resolveDisplayValue } from '../format';
import type { FormatOptions } from '../format.types';
import { formatSummary, summaryKey } from '../summaries';
import type { GroupNode } from '../grouping/group-nodes.types';
import type { ColumnDef, FormatSpec } from '../types/column.types';
import type { SummaryConfig } from '../types/config.types';
import type {
  ExportCell,
  ExportColumn,
  ExportRow,
  ExportTable,
  ExportValueType,
} from '../types/export.types';
import type { ExportTableInput } from './build-table.types';

/** A header cell is bold, so a spreadsheet's first row reads as a header. */
const HEADER_STYLE = { bold: true } as const;

function emptyCell(colSpan = 1): ExportCell {
  return { value: null, text: '', type: 'empty', colSpan, indent: 0, style: null };
}

function textCell(text: string, colSpan = 1, indent = 0): ExportCell {
  return { value: text, text, type: 'string', colSpan, indent, style: null };
}

/**
 * The type a value takes in a format that distinguishes types.
 *
 * A `format` **function** forces `'string'`: the host owns the text and no
 * number format reproduces it, so writing the raw number into a spreadsheet
 * would show something the grid never displayed.
 */
export function exportValueType<TRow>(value: unknown, column: ColumnDef<TRow>): ExportValueType {
  if (value == null || value === '') {
    return 'empty';
  }
  if (typeof column.format === 'function') {
    return 'string';
  }
  const declared =
    column.dataType ?? (typeof column.format === 'object' ? column.format.type : undefined);
  if (declared === 'date' || declared === 'datetime' || declared === 'time') {
    return declared;
  }
  if (value instanceof Date) {
    return 'datetime';
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (declared === 'number' && typeof value === 'string' && Number.isFinite(Number(value.trim()))) {
    return 'number';
  }
  return 'string';
}

/**
 * A spreadsheet number format for a column, or `undefined` when the default
 * for its type will do. The currency symbol and the side it sits on come from
 * `Intl`, so a Greek grid exports the symbol it displayed rather than a
 * guessed prefix.
 */
export function numberFormatOf(spec: FormatSpec | undefined, locale?: string): string | undefined {
  if (spec == null || typeof spec === 'function') {
    return undefined;
  }
  const decimals = (precision: number | undefined, fallback: number): string => {
    const digits = precision ?? fallback;
    return digits > 0 ? `.${'0'.repeat(digits)}` : '';
  };
  switch (spec.type) {
    case 'number':
      return `#,##0${decimals(spec.precision, 0)}`;
    case 'percent':
      return `0${decimals(spec.precision, 0)}%`;
    case 'currency':
      return currencyFormat(spec.currency ?? 'EUR', decimals(spec.precision, 2), locale);
    case 'date':
      return 'yyyy-mm-dd';
    case 'datetime':
      return 'yyyy-mm-dd hh:mm';
    case 'time':
      return 'hh:mm';
  }
}

function currencyFormat(currency: string, decimals: string, locale?: string): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1);
  const index = parts.findIndex((part) => part.type === 'currency');
  const symbol = index < 0 ? currency : parts[index].value;
  const quoted = `"${symbol.replace(/"/g, '')}"`;
  const number = `#,##0${decimals}`;
  return index > 0 ? `${number} ${quoted}` : `${quoted}${number}`;
}

/** Builds the table. Pure — nothing here reads a signal or the DOM. */
export function buildExportTable<TRow>(input: ExportTableInput<TRow>): ExportTable {
  const options = input.options ?? {};
  const formatOptions = input.formatOptions ?? {};
  const columns = input.columns;
  const widths = input.widths;
  const readValue =
    input.cellValue ??
    ((row: TRow, column: ColumnDef<TRow>): unknown => resolveCellValue(row, column));
  const readText =
    input.cellText ??
    ((row: TRow, column: ColumnDef<TRow>): string =>
      formatCellText(
        resolveDisplayValue(row, column, resolveCellValue(row, column)),
        column,
        formatOptions,
      ));
  const readDisplay =
    input.cellDisplay ??
    ((row: TRow, column: ColumnDef<TRow>): unknown =>
      resolveDisplayValue(row, column, resolveCellValue(row, column)));

  const exportColumns: ExportColumn[] = columns.map((column) => ({
    id: column.id,
    caption: column.caption ?? column.field ?? column.id,
    dataType: column.dataType,
    width: widths?.get(column.id) ?? 0,
  }));

  const rows: ExportRow[] = [];
  if (options.bands !== false) {
    rows.push(...bandRows(columns, input.declaredColumns));
  }
  if (options.headers !== false) {
    rows.push({
      kind: 'header',
      level: 0,
      key: null,
      cells: exportColumns.map((column) => ({
        value: column.caption,
        text: column.caption,
        type: 'string' as const,
        colSpan: 1,
        indent: 0,
        style: { ...HEADER_STYLE },
      })),
    });
  }

  const dataRow = (row: TRow, level: number): ExportRow => ({
    kind: 'data',
    level,
    key: input.keyOf?.(row) ?? null,
    cells: columns.map((column) => {
      const value = readValue(row, column);
      const numberFormat = numberFormatOf(column.format, formatOptions.locale);
      const visual = column.exportVisual?.(row, readDisplay(row, column)) ?? null;
      return {
        value,
        text: readText(row, column),
        type: exportValueType(value, column),
        colSpan: 1,
        indent: 0,
        style: numberFormat == null ? null : { numberFormat },
        ...(visual == null ? {} : { visual }),
      };
    }),
  });

  const groups = options.groups === false ? null : (input.groups ?? null);
  if (groups == null) {
    for (const row of input.rows) {
      rows.push(dataRow(row, 0));
    }
  } else {
    const groupSummaries = input.groupSummaries ?? [];
    const aligned = groupSummaries.filter((summary) => summary.placement === 'column');
    const footers = groupSummaries.filter((summary) => summary.placement === 'footer');
    const inline = groupSummaries.filter((summary) => (summary.placement ?? 'header') === 'header');
    const walk = (nodes: readonly GroupNode<TRow>[]): void => {
      for (const node of nodes) {
        rows.push(groupRow(node, columns, aligned, inline, input, formatOptions));
        for (const row of node.rows) {
          rows.push(dataRow(row, node.level + 1));
        }
        walk(node.children);
        if (footers.length > 0) {
          rows.push({
            kind: 'groupFooter',
            level: node.level,
            key: null,
            cells: summaryCells(footers, node.aggregates, columns, formatOptions, ''),
          });
        }
      }
    };
    walk(groups);
  }

  const totals = options.summaries === false ? [] : (input.totals ?? []);
  if (totals.length > 0) {
    rows.push({
      kind: 'summary',
      level: 0,
      key: null,
      cells: summaryCells(
        totals,
        input.totalAggregates ?? null,
        columns,
        formatOptions,
        input.totalsLabel ?? '',
      ),
    });
  }

  return {
    format: input.format,
    fileName: options.fileName ?? input.fileName,
    sheetName: options.sheetName ?? input.sheetName,
    columns: exportColumns,
    rows,
  };
}

/**
 * Band caption rows, one per band level.
 *
 * A column with no band above it at a level contributes an empty cell rather
 * than a spanning one, so every row stays the width of the table and the
 * writers need no occupancy tracking to lay one out.
 */
function bandRows<TRow>(
  columns: readonly ColumnDef<TRow>[],
  declared: readonly ColumnDef<TRow>[] | undefined,
): ExportRow[] {
  if (declared == null) {
    return [];
  }
  const index: BandIndex<TRow> = indexColumnBands(declared);
  if (index.depth === 0) {
    return [];
  }
  const rows: ExportRow[] = [];
  for (let level = 0; level < index.depth; level += 1) {
    const cells: ExportCell[] = [];
    let start = 0;
    while (start < columns.length) {
      const bandId = index.pathOf.get(columns[start].id)?.[level];
      if (bandId === undefined) {
        cells.push(emptyCell());
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < columns.length && index.pathOf.get(columns[end].id)?.[level] === bandId) {
        end += 1;
      }
      const band = index.bands.get(bandId);
      const caption = band?.caption ?? band?.field ?? bandId;
      cells.push({
        value: caption,
        text: caption,
        type: 'string',
        colSpan: end - start,
        indent: 0,
        style: { ...HEADER_STYLE, align: 'center' },
      });
      start = end;
    }
    rows.push({ kind: 'band', level, key: null, cells });
  }
  return rows;
}

/**
 * One group header row: the label, spanning until the first aligned summary,
 * then a cell per remaining column.
 */
function groupRow<TRow>(
  node: GroupNode<TRow>,
  columns: readonly ColumnDef<TRow>[],
  aligned: readonly SummaryConfig[],
  inline: readonly SummaryConfig[],
  input: ExportTableInput<TRow>,
  formatOptions: FormatOptions,
): ExportRow {
  const column = columns.find((candidate) => (candidate.field ?? candidate.id) === node.field);
  const caption = column?.caption ?? column?.field ?? node.field;
  const value = formatCellText(node.value, column ?? { id: node.field }, formatOptions);
  const base =
    input.groupLabel?.(node, caption, value) ?? `${caption}: ${value} (${node.count.toString()})`;
  const summaries = inline
    .map((summary) => formatSummary(summary, node.aggregates?.[summaryKey(summary)], formatOptions))
    .filter((text) => text !== '');
  const label = summaries.length === 0 ? base : `${base} — ${summaries.join(', ')}`;

  const cells = summaryCells(aligned, node.aggregates, columns, formatOptions, '');
  // The label absorbs every leading cell no aligned summary claims, so a
  // spreadsheet merges it exactly as far as the grid's group row spans.
  let span = 0;
  while (span < cells.length && cells[span].type === 'empty') {
    span += 1;
  }
  const head: ExportCell = {
    ...textCell(label, Math.max(1, span), node.level),
    style: { bold: true },
  };
  return { kind: 'group', level: node.level, key: null, cells: [head, ...cells.slice(span)] };
}

/**
 * A full-width row carrying each summary under its own column. `label` fills
 * the first cell when no summary claims it, so a total row is never anonymous.
 */
function summaryCells<TRow>(
  summaries: readonly SummaryConfig[],
  aggregates: Readonly<Record<string, unknown>> | null,
  columns: readonly ColumnDef<TRow>[],
  formatOptions: FormatOptions,
  label: string,
): ExportCell[] {
  const cells = columns.map(() => emptyCell());
  for (const summary of summaries) {
    const columnId =
      summary.columnId ?? columns.find((column) => column.field === summary.field)?.id;
    const index = columns.findIndex((column) => column.id === columnId);
    if (index < 0) {
      continue;
    }
    const raw = aggregates?.[summaryKey(summary)];
    const text = formatSummary(summary, raw, formatOptions);
    cells[index] = {
      value: raw ?? text,
      text,
      type: typeof raw === 'number' ? 'number' : 'string',
      colSpan: 1,
      indent: 0,
      style: { bold: true },
    };
  }
  if (label !== '' && cells.length > 0 && cells[0].type === 'empty') {
    cells[0] = { ...textCell(label), style: { bold: true } };
  }
  return cells;
}

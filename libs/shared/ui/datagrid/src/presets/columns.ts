/**
 * Column presets (§6.2).
 *
 * Each preset is a factory returning a {@link ColumnDef}, not an option bag the
 * grid interprets. Two consequences follow, and both are the point:
 *
 * - A factory composes by spread, so varying one property re-states nothing:
 *   `{ ...tagColumn({ id: 'status', field: 'status' }, spec), width: 120 }`.
 * - The renderer travels attached to the definition, as a component type. A
 *   component type is a symbol another module imports, so a preset built in a
 *   shared file and passed through a wrapper renders — where a template would
 *   belong to the view that declared it and silently draw nothing.
 *
 * ```ts
 * export const BOOKING_COLUMNS: ColumnDef<Booking>[] = [
 *   textColumn({ id: 'code', field: 'code', caption: 'Code' }),
 *   dateColumn({ id: 'day', field: 'startsAt', caption: 'Day' }),
 *   currencyColumn({ id: 'price', field: 'price' }, { currency: 'EUR' }),
 *   tagColumn({ id: 'status', field: 'status' }, {
 *     tone: { confirmed: 'success', pending: 'warning', canceled: 'error' },
 *   }),
 *   actionsColumn({ id: 'actions' }, { actions: [ … ] }),
 * ];
 * ```
 */
import { isDevMode } from '@angular/core';
import { getPath } from '../core/paths';
import type { ColumnDef, FormatSpec } from '../core/types/column.types';
import { DatagridActionsCell } from './datagrid-actions-cell';
import { DatagridBooleanCell } from './datagrid-boolean-cell';
import { DatagridLinkCell } from './datagrid-link-cell';
import { DatagridTagCell } from './datagrid-tag-cell';
import { checkVisual, linkVisual, tagsVisual } from './export-visuals';
import { withPresetOptions } from './preset-options';
import type { ActionsSpec, BooleanSpec, LinkSpec, TagSpec } from './preset.types';
import type {
  NumberColumnOptions,
  CurrencyColumnOptions,
  DateColumnOptions,
} from './columns.types';

/** A text column: the default rendering, declared for symmetry with the rest. */
export function textColumn<TRow>(column: ColumnDef<TRow>): ColumnDef<TRow> {
  return { dataType: 'string', ...column };
}

/** A right-aligned, locale-formatted number column. */
export function numberColumn<TRow>(
  column: ColumnDef<TRow>,
  options: NumberColumnOptions = {},
): ColumnDef<TRow> {
  return {
    dataType: 'number',
    format: numberFormat('number', options),
    ...column,
  };
}

/** A currency column. Defaults to euro, which is this product's currency. */
export function currencyColumn<TRow>(
  column: ColumnDef<TRow>,
  options: CurrencyColumnOptions = {},
): ColumnDef<TRow> {
  return {
    dataType: 'number',
    format: { type: 'currency', currency: options.currency ?? 'EUR', ...precision(options) },
    ...column,
  };
}

/** A percentage column. The stored value is a ratio, so `0.2` prints as 20%. */
export function percentColumn<TRow>(
  column: ColumnDef<TRow>,
  options: NumberColumnOptions = {},
): ColumnDef<TRow> {
  return { dataType: 'number', format: numberFormat('percent', options), ...column };
}

/** A date column, formatted for the grid's locale and timezone. */
export function dateColumn<TRow>(
  column: ColumnDef<TRow>,
  options: DateColumnOptions = {},
): ColumnDef<TRow> {
  return { dataType: 'date', format: { type: 'date', ...options }, ...column };
}

/** A date-and-time column. */
export function datetimeColumn<TRow>(
  column: ColumnDef<TRow>,
  options: DateColumnOptions = {},
): ColumnDef<TRow> {
  return { dataType: 'datetime', format: { type: 'datetime', ...options }, ...column };
}

/**
 * A boolean column.
 *
 * `'labels'` prints the translated yes/no text through the formatter fast
 * path, so it costs no renderer. `'check'` draws a glyph and keeps the same
 * text as the cell's accessible name.
 */
export function booleanColumn<TRow>(
  column: ColumnDef<TRow>,
  options: BooleanSpec = {},
): ColumnDef<TRow> {
  const base: ColumnDef<TRow> = { dataType: 'boolean', ...column };
  return options.display === 'check'
    ? { exportVisual: checkVisual, ...base, cell: DatagridBooleanCell }
    : base;
}

/**
 * A tag / badge column. Draws one tag per value, or several when the cell
 * value is an array.
 */
export function tagColumn<TRow>(
  column: ColumnDef<TRow>,
  options: TagSpec<TRow> = {},
): ColumnDef<TRow> {
  const built = withPresetOptions({ cell: DatagridTagCell, ...column }, options);
  return { exportVisual: tagsVisual(built, options), ...built };
}

/**
 * A row-actions column.
 *
 * Not sortable, not groupable and not filterable: it shows no value, so every
 * one of those would act on nothing. It pins to the end by default, where a
 * list of actions belongs.
 */
export function actionsColumn<TRow>(
  column: ColumnDef<TRow>,
  options: ActionsSpec<TRow>,
): ColumnDef<TRow> {
  return withPresetOptions(
    {
      cell: DatagridActionsCell,
      pinned: 'end',
      width: 96,
      // Buttons hold no data, so a file would carry an empty column.
      allow: {
        sorting: false,
        filtering: false,
        grouping: false,
        headerFiltering: false,
        exporting: false,
      },
      // The card view's actions strip. Declared by the preset rather than
      // recognized by the card builder, which would have to know what a
      // preset renders to guess it.
      card: { role: 'actions' },
      ...column,
    },
    options,
  );
}

/**
 * A link column. Renders a real anchor, so middle-click and modifier-click
 * open a new tab and the browser's own link commands work.
 */
export function linkColumn<TRow>(
  column: ColumnDef<TRow>,
  options: LinkSpec<TRow>,
): ColumnDef<TRow> {
  const built = withPresetOptions({ cell: DatagridLinkCell, ...column }, options);
  return { exportVisual: linkVisual(built, options), ...built };
}

/**
 * Reports columns whose `field` resolves on no row, once per column.
 *
 * A mistyped path is otherwise invisible: the cell renders empty and looks
 * like missing data. The check runs in development only, over the first
 * loaded row, and says nothing for a column that declares `value` instead.
 */
export function checkColumnFields<TRow>(
  columns: readonly ColumnDef<TRow>[],
  row: TRow,
  reported: Set<string>,
): void {
  if (!isDevMode() || row == null || typeof row !== 'object') {
    return;
  }
  for (const column of columns) {
    if (column.field == null || column.value != null || reported.has(column.id)) {
      continue;
    }
    if (getPath(row, column.field) === undefined) {
      reported.add(column.id);
      console.warn(
        `datagrid: column "${column.id}" reads field "${column.field}", which is absent from the loaded rows`,
      );
    }
  }
}

function precision(options: NumberColumnOptions): { precision?: number } {
  return options.precision == null ? {} : { precision: options.precision };
}

function numberFormat(type: 'number' | 'percent', options: NumberColumnOptions): FormatSpec {
  return { type, ...precision(options) };
}

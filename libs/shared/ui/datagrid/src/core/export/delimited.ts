/**
 * Delimited text: the CSV adapter and the TSV the clipboard carries (§15).
 *
 * Both read the same {@link ExportTable}, so a copied selection and an
 * exported file never disagree about what a cell says.
 */

import type { ExportTable } from '../types/export.types';
import type { DelimitedOptions } from './delimited.types';

const NEEDS_QUOTING = /["\r\n]/;

/**
 * Quotes one field.
 *
 * The delimiter is tested rather than assumed, so switching to a tab does not
 * start quoting every field that happens to contain a comma.
 */
function quote(text: string, delimiter: string): string {
  if (text === '') {
    return '';
  }
  if (!text.includes(delimiter) && !NEEDS_QUOTING.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Renders the table as delimited text.
 *
 * A cell spanning several columns writes its text once and pads the columns it
 * covers with empty fields, so every line has the same field count and a
 * banded or grouped export still opens as a rectangle.
 */
export function toDelimitedText(table: ExportTable, options: DelimitedOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const newline = options.newline ?? '\r\n';
  const skip = new Set(options.skip ?? []);
  const lines: string[] = [];
  for (const row of table.rows) {
    if (skip.has(row.kind)) {
      continue;
    }
    const fields: string[] = [];
    for (const cell of row.cells) {
      const indent = cell.indent > 0 ? '  '.repeat(cell.indent) : '';
      fields.push(quote(indent + cell.text, delimiter));
      for (let extra = 1; extra < cell.colSpan; extra += 1) {
        fields.push('');
      }
    }
    lines.push(fields.join(delimiter));
  }
  return lines.join(newline);
}

/** The table as a CSV blob. The BOM is what makes Excel read UTF-8. */
export function toCsvBlob(table: ExportTable, options: DelimitedOptions = {}): Blob {
  const text = toDelimitedText(table, { delimiter: ',', ...options });
  const bom = options.bom === false ? '' : '\uFEFF';
  return new Blob([bom + text], { type: 'text/csv;charset=utf-8' });
}

/** The table as clipboard text. Tab-separated, LF, no byte-order mark. */
export function toClipboardText(table: ExportTable): string {
  return toDelimitedText(table, { delimiter: '\t', newline: '\n' });
}

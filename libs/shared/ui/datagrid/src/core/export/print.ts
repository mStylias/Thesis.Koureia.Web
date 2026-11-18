/**
 * The print view.
 *
 * A virtualized grid prints whatever few rows happen to be mounted, so
 * printing renders the export model instead. The document carries structure
 * only — borders, weights and alignment — and no colour: it is printed on
 * paper, and a colour written here could not come from the theme tokens
 * anyway, since the print document is its own document.
 */

import type { ExportTable } from '../types/export.types';
import type { PrintLabels } from './print.types';

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; font-size: 11px; margin: 12mm; }
  h1 { font-size: 14px; font-weight: 600; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid; padding: 3px 6px; text-align: start; vertical-align: top; }
  thead th { font-weight: 700; }
  tr[data-kind='group'] td, tr[data-kind='groupFooter'] td, tr[data-kind='summary'] td { font-weight: 700; }
  td[data-type='number'] { text-align: end; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The print document for one table. */
export function toPrintHtml(table: ExportTable, labels: PrintLabels): string {
  const head: string[] = [];
  const body: string[] = [];
  let inHead = true;
  for (const row of table.rows) {
    const isHead = row.kind === 'band' || row.kind === 'header';
    inHead = inHead && isHead;
    const tag = inHead ? 'th' : 'td';
    const cells = row.cells
      .map((cell) => {
        const span = cell.colSpan > 1 ? ` colspan="${cell.colSpan.toString()}"` : '';
        const indent =
          cell.indent > 0
            ? ` style="padding-inline-start:${(cell.indent * 12 + 6).toString()}px"`
            : '';
        return `<${tag}${span} data-type="${cell.type}"${indent}>${escapeHtml(cell.text)}</${tag}>`;
      })
      .join('');
    const markup = `<tr data-kind="${row.kind}">${cells}</tr>`;
    if (inHead) {
      head.push(markup);
    } else {
      body.push(markup);
    }
  }
  const title = escapeHtml(labels.title);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body><h1>${title}</h1><table><thead>${head.join('')}</thead><tbody>${body.join('')}</tbody></table></body></html>`;
}

/**
 * Prints the table through an offscreen frame.
 *
 * A frame rather than a window: a popup blocker refuses `window.open` when the
 * call is one `await` away from the click that started it, and the grid's own
 * page must not be replaced by a table.
 */
export async function printExportTable(
  ownerDocument: Document,
  table: ExportTable,
  labels: PrintLabels,
): Promise<void> {
  const frame = ownerDocument.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.position = 'fixed';
  frame.style.inset = 'auto auto 0 0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  ownerDocument.body.appendChild(frame);

  try {
    // `srcdoc` rather than `document.write`: the frame's load event then
    // genuinely reports the document being ready, and a long table prints laid
    // out rather than half measured.
    const loaded = new Promise<void>((resolve) => {
      frame.addEventListener(
        'load',
        () => {
          resolve();
        },
        { once: true },
      );
    });
    frame.srcdoc = toPrintHtml(table, labels);
    await loaded;
    const view = frame.contentWindow;
    if (view == null) {
      return;
    }
    view.focus();
    view.print();
  } finally {
    // The dialog is modal and synchronous in every browser that has one, so
    // the frame has done its work by the time this runs.
    frame.remove();
  }
}

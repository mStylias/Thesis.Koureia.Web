/**
 * One export, end to end (§15).
 *
 * This module is the grid's lazy entry point: the shell reaches it with
 * `import()` at the moment an export starts, so a grid that never exports
 * carries neither the model builder, nor the writers, nor the print view.
 *
 * The run is: fetch the rows the scope asks for → build the model → let the
 * host mutate or veto it → write it → save it. Cancellation and progress live
 * in the fetch step, which is the only one that can take a noticeable time.
 */
import { buildExportTable } from './build-table';
import { isAbortError } from './collect-rows';
import { toCsvBlob, toClipboardText, toDelimitedText } from './delimited';
import { printExportTable } from './print';
import type { PrintLabels } from './print.types';
import type { ExportAdapter, ExportTable } from '../types/export.types';
import type { ExportRunContext, ExportOutcome } from './run-export.types';
export { buildExportTable } from './build-table';
export { collectExportRows, isAbortError, exportAbortError } from './collect-rows';
export { toClipboardText, toDelimitedText, toCsvBlob } from './delimited';
export { toPrintHtml, printExportTable } from './print';

/** The text formats the library always offers. */
export const BUILT_IN_EXPORT_ADAPTERS: readonly ExportAdapter[] = [
  {
    format: 'csv',
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8',
    write: (table) => toCsvBlob(table),
  },
  {
    format: 'tsv',
    extension: 'tsv',
    mimeType: 'text/tab-separated-values;charset=utf-8',
    write: (table) =>
      new Blob(['\uFEFF', toDelimitedText(table, { delimiter: '\t' })], {
        type: 'text/tab-separated-values;charset=utf-8',
      }),
  },
];

/**
 * The adapter for a format. A host registration wins over a built-in of the
 * same name, so replacing the CSV dialect needs no new format name.
 */
export function resolveExportAdapter(
  format: string,
  registered: readonly ExportAdapter[],
): ExportAdapter | null {
  const name = format.toLowerCase();
  // Searched from the end so the last registration of a format wins, which is
  // what a provider added closer to the grid means.
  for (let index = registered.length - 1; index >= 0; index -= 1) {
    if (registered[index].format.toLowerCase() === name) {
      return registered[index];
    }
  }
  return BUILT_IN_EXPORT_ADAPTERS.find((adapter) => adapter.format === name) ?? null;
}

/** Runs one export. Errors other than cancellation propagate to the caller. */
export async function runExport<TRow>(context: ExportRunContext<TRow>): Promise<ExportOutcome> {
  const adapter = resolveExportAdapter(context.format, context.adapters);
  if (adapter == null) {
    return { status: 'unsupported', format: context.format };
  }
  let rows: readonly TRow[];
  try {
    rows = await context.collect();
  } catch (cause) {
    if (isAbortError(cause)) {
      return { status: 'canceled' };
    }
    throw cause;
  }

  const table = buildExportTable({
    ...context.table,
    format: adapter.format,
    rows,
    groups: context.groupsOf(rows),
    totalAggregates: context.aggregatesOf(rows),
    options: context.options,
  });

  // Synchronous by contract (§20): the host vetoes by mutating the payload
  // before the emission returns, and mutates the model in the same call.
  if (!context.beforeExport(table)) {
    return { status: 'vetoed' };
  }

  const blob = await adapter.write(table, context.options.adapterOptions);
  const fileName = withExtension(table.fileName, adapter.extension);
  await context.save(blob, fileName);
  return { status: 'done', fileName, rowCount: rows.length };
}

/** Appends the adapter's extension unless the host already wrote one. */
export function withExtension(fileName: string, extension: string): string {
  const name = fileName.trim() === '' ? 'export' : fileName.trim();
  return name.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? name : `${name}.${extension}`;
}

/**
 * Copies the table as tab-separated text.
 *
 * `navigator.clipboard` rather than a `copy` event: the model is built behind
 * a dynamic import, and a synchronous clipboard event cannot wait for one.
 * The transient activation a keypress grants outlives a module load by
 * several seconds, so the write still counts as user-initiated.
 */
export async function copyTableToClipboard(table: ExportTable): Promise<boolean> {
  const text = toClipboardText(table);
  // Read through a partial view of `Navigator`: the DOM types promise a
  // clipboard unconditionally, and a server render and a test environment both
  // disagree.
  const { clipboard } = globalThis.navigator as Partial<Navigator>;
  if (clipboard == null) {
    return false;
  }
  await clipboard.writeText(text);
  return true;
}

/** Prints the table. Re-exported so the shell needs one dynamic import. */
export async function printTable(
  ownerDocument: Document,
  table: ExportTable,
  labels: PrintLabels,
): Promise<void> {
  await printExportTable(ownerDocument, table, labels);
}

/** The built-in download: an object URL and a synthetic click, then revoked. */
export function downloadBlob(ownerDocument: Document, blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = ownerDocument.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  ownerDocument.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next task: revoking in the same one races the navigation
  // the click started, and the download arrives empty.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

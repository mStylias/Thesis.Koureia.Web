/**
 * Export, clipboard and print, end to end (§15).
 *
 * One instance per grid. It owns the progress of the run in flight and the
 * controller that aborts it, because nothing else reads either: the shell shows
 * the progress and hears the outcome through the events it passed in.
 *
 * Every writer is reached with `import()`, so a grid that never exports carries
 * neither the model builder nor the writers.
 */
import { isDevMode, signal, type Signal } from '@angular/core';
import { buildGroups } from '../grouping/group-nodes';
import type { GroupNode } from '../grouping/group-nodes.types';
import { computeAggregates } from '../local-engine/aggregate';
import { isExportAbort, toExportError } from '../../datagrid.internals';
import { DEFAULT_EXPORT_MAX_ROWS, DEFAULT_EXPORT_PAGE_SIZE } from '../../datagrid.constants';
import type { Query } from '../types/query.types';
import type { ExportOptions, ExportScope } from '../types/export.types';
import type { ExportTableInput } from './build-table.types';
import type { ExportOutcome } from './run-export.types';
import type { ExportControllerDeps, ExportProgress } from './export-controller.types';

export class ExportController<TRow> {
  private readonly progress = signal<ExportProgress | null>(null);
  private abort: AbortController | null = null;

  constructor(private readonly deps: ExportControllerDeps<TRow>) {}

  /** Progress of the run in flight, or `null` when nothing is exporting. */
  get state(): Signal<ExportProgress | null> {
    return this.progress.asReadonly();
  }

  /** Stops the run in flight. Nothing is written and no file is saved. */
  cancel(): void {
    this.abort?.abort();
    this.abort = null;
    this.progress.set(null);
  }

  /**
   * Runs one export.
   *
   * Resolves when the file has been handed to the saver, and also when the run
   * was vetoed or canceled: both are ordinary outcomes, reported as events. A
   * run in flight is canceled before a second one starts, so two clicks never
   * produce two competing fetches of the same dataset.
   */
  async run(format: string, options?: ExportOptions): Promise<void> {
    if (!this.deps.permitted() || this.deps.config()?.enabled === false) {
      return;
    }
    this.cancel();
    const controller = new AbortController();
    this.abort = controller;
    const resolved = this.optionsFor(options);
    this.progress.set({ format, loaded: 0, total: 0 });
    try {
      const { runExport } = await import('./run-export');
      const outcome = await runExport<TRow>({
        format,
        options: resolved,
        table: this.tableInput(),
        adapters: this.deps.adapters,
        collect: () =>
          this.collectRows(resolved.scope ?? 'all', controller.signal, (loaded, total) => {
            this.progress.set({ format, loaded, total: total ?? 0 });
            this.deps.onProgress(loaded, total);
          }),
        groupsOf: (rows) => this.groupsOf(rows),
        aggregatesOf: (rows) => this.aggregatesOf(rows),
        beforeExport: (model) => {
          const fileName = this.deps.beforeExport(model);
          if (fileName == null) {
            return false;
          }
          // A host renames the file by writing either the model or the payload.
          // The payload is what it reaches first, so the payload wins.
          model.fileName = fileName;
          return true;
        },
        save: (blob, fileName) => this.save(blob, fileName),
      });
      this.report(format, outcome);
    } catch (cause) {
      this.deps.onFailed(toExportError(cause, format));
      this.deps.announce(this.deps.translate('datagrid.export.failed'));
    } finally {
      if (this.abort === controller) {
        this.abort = null;
        this.progress.set(null);
      }
    }
  }

  /**
   * Copies rows as tab-separated text (§15).
   *
   * The selection when there is one, the focused row otherwise: that is what a
   * user who has just selected rows and pressed the shortcut expects, and it
   * is what keeps the shortcut useful before anything is selected.
   */
  async copy(options?: ExportOptions): Promise<boolean> {
    if (!this.deps.allowed()) {
      return false;
    }
    const rows = this.rowsToCopy(options?.scope);
    if (rows.length === 0) {
      return false;
    }
    try {
      const { buildExportTable, copyTableToClipboard } = await import('./run-export');
      const table = buildExportTable<TRow>({
        ...this.tableInput(),
        format: 'tsv',
        rows,
        groups: null,
        totalAggregates: null,
        options: { bands: false, summaries: false, ...options },
      });
      const copied = await copyTableToClipboard(table);
      if (copied) {
        this.deps.announce(this.deps.translate('datagrid.export.copied', { count: rows.length }));
      }
      return copied;
    } catch (cause) {
      this.deps.onFailed(toExportError(cause, 'tsv'));
      return false;
    }
  }

  /**
   * Whether a copy would produce anything.
   *
   * The shortcut is claimed only when it would: a grid with nothing selected
   * and nothing focused must let the browser copy the user's own text
   * selection instead.
   */
  canCopy(scope?: ExportScope): boolean {
    return this.rowsToCopy(scope).length > 0;
  }

  /**
   * Prints the dataset (§15).
   *
   * Rendered from the export model into a frame of its own, because the body
   * mounts a window of rows and printing the page would print that window.
   */
  async print(): Promise<void> {
    if (!this.deps.permitted()) {
      return;
    }
    this.cancel();
    const controller = new AbortController();
    this.abort = controller;
    this.progress.set({ format: 'print', loaded: 0, total: 0 });
    try {
      const { buildExportTable, printTable } = await import('./run-export');
      const rows = await this.collectRows('all', controller.signal, (loaded, total) => {
        this.progress.set({ format: 'print', loaded, total: total ?? 0 });
      });
      const table = buildExportTable<TRow>({
        ...this.tableInput(),
        format: 'print',
        rows,
        groups: this.groupsOf(rows),
        totalAggregates: this.aggregatesOf(rows),
        options: this.optionsFor(undefined),
      });
      await printTable(this.deps.document(), table, { title: table.sheetName });
    } catch (cause) {
      if (!isExportAbort(cause)) {
        this.deps.onFailed(toExportError(cause, 'print'));
      }
    } finally {
      if (this.abort === controller) {
        this.abort = null;
        this.progress.set(null);
      }
    }
  }

  /**
   * Everything the model builder needs except the rows.
   *
   * The cell callbacks are the grid's own display path, lookups included, so
   * an exported cell says exactly what the cell on screen said. That identity
   * is what §15's "honor current formatting" asks for, and a second formatting
   * path here is what would quietly break it.
   */
  private tableInput(): Omit<
    ExportTableInput<TRow>,
    'rows' | 'groups' | 'format' | 'options' | 'totalAggregates'
  > {
    const formatOptions = {
      booleanLabels: this.deps.booleanLabels(),
      timezone: this.deps.timezone(),
      locale: this.deps.locale(),
    };
    const keyOf = this.deps.keyOf();
    return {
      fileName: this.deps.config()?.fileName ?? 'export',
      sheetName: this.deps.config()?.sheetName ?? this.deps.gridLabel(),
      columns: this.deps.exportColumns(),
      widths: this.deps.widths(),
      declaredColumns: this.deps.declaredColumns(),
      ...(keyOf == null ? {} : { keyOf }),
      cellValue: (row, column) => this.deps.cellValue(row, column),
      cellText: (row, column) => this.deps.cellText(row, column),
      cellDisplay: (row, column) => this.deps.cellDisplay(row, column),
      totals: this.deps.totalSummaries(),
      groupSummaries: this.deps.groupSummaries(),
      totalsLabel: this.deps.translate('datagrid.summary.total'),
      groupLabel: (node, caption, value) =>
        this.deps.translate('datagrid.export.groupRow', {
          column: caption,
          value,
          count: node.count,
        }),
      formatOptions,
    };
  }

  /** The options of one run: the call's own, over the config's. */
  private optionsFor(options: ExportOptions | undefined): ExportOptions {
    const config = this.deps.config();
    return {
      scope: options?.scope ?? config?.scope ?? 'all',
      ...(config?.bands === undefined ? {} : { bands: config.bands }),
      ...(config?.groups === undefined ? {} : { groups: config.groups }),
      ...(config?.summaries === undefined ? {} : { summaries: config.summaries }),
      ...(config?.adapterOptions === undefined ? {} : { adapterOptions: config.adapterOptions }),
      ...options,
    };
  }

  /**
   * The rows one scope covers.
   *
   * `'all'` pages through the dataset with the current query minus its paging
   * and its grouping: a grouped query answers with a hierarchy the pager
   * cannot walk, and the export re-groups the fetched rows itself so the
   * aggregates cover the file rather than the loaded page.
   */
  private async collectRows(
    scope: ExportScope,
    signal: AbortSignal,
    onProgress: (loaded: number, total?: number) => void,
  ): Promise<readonly TRow[]> {
    if (scope === 'page') {
      return this.deps.loadedRows();
    }
    const selection = this.deps.selection();
    if (scope === 'selected' && selection.kind === 'keys') {
      return selection.keys
        .map((key) => this.deps.rowFor(key))
        .filter((row): row is TRow => row !== undefined);
    }

    const { collectExportRows } = await import('./run-export');
    const base: Query = { ...this.deps.effectiveQuery() };
    delete base.skip;
    delete base.take;
    delete base.group;
    delete base.aggregates;
    delete base.signal;
    if (scope === 'selected' && selection.kind === 'allMatching') {
      // A predicate selection is the filter it was taken under, not the one in
      // force now: the user selected a result set and may then have narrowed
      // the view.
      base.filter = selection.filter;
      base.search = selection.search;
    }
    const config = this.deps.config();
    const excluded =
      scope === 'selected' && selection.kind === 'allMatching'
        ? new Set(selection.exclusions)
        : null;
    const keyOf = this.deps.keyOf();
    const rows = await collectExportRows<TRow>({
      pageSize: Math.max(1, config?.pageSize ?? DEFAULT_EXPORT_PAGE_SIZE),
      maxRows: Math.max(1, config?.maxRows ?? DEFAULT_EXPORT_MAX_ROWS),
      signal,
      onProgress,
      load: async (skip, take) => {
        const result = await this.deps.fetch(
          { ...base, skip, take, requireTotalCount: true },
          signal,
        );
        return result.totalCount == null
          ? { rows: result.rows }
          : { rows: result.rows, totalCount: result.totalCount };
      },
    });
    if (excluded == null || keyOf == null) {
      return rows;
    }
    return rows.filter((row) => !excluded.has(keyOf(row)));
  }

  /** Selected rows, or the focused one. An explicit `'page'` takes them all. */
  private rowsToCopy(scope: ExportScope | undefined): readonly TRow[] {
    if (scope === 'page') {
      return this.deps.loadedRows();
    }
    const selected = this.deps
      .selectedKeys()
      .map((key) => this.deps.rowFor(key))
      .filter((row): row is TRow => row !== undefined);
    if (selected.length > 0) {
      return selected;
    }
    const key = this.deps.focusedKey();
    const focused = key == null ? undefined : this.deps.rowFor(key);
    return focused === undefined ? [] : [focused];
  }

  /** The group tree over the exported rows, or `null` when the grid is flat. */
  private groupsOf(rows: readonly TRow[]): readonly GroupNode<TRow>[] | null {
    const specs = this.deps.groupSpecs();
    if (specs.length === 0) {
      return null;
    }
    return buildGroups(rows, specs, {
      getValue: this.deps.fieldValue(),
      aggregates: this.deps.aggregateSpecs(this.deps.groupSummaries()),
      customAggregates: this.deps.customAggregates(),
    });
  }

  /**
   * Totals over the exported rows rather than over the loaded page.
   *
   * Computed locally even when the source aggregates remotely: the export
   * already holds every row, and a total covering the file is worth more than
   * one covering a page the file does not represent.
   */
  private aggregatesOf(rows: readonly TRow[]): Readonly<Record<string, unknown>> | null {
    const summaries = this.deps.totalSummaries();
    if (summaries.length === 0) {
      return null;
    }
    return computeAggregates(rows, this.deps.aggregateSpecs(summaries), {
      getValue: this.deps.fieldValue(),
      customAggregates: this.deps.customAggregates(),
    });
  }

  /** Hands the file to the registered saver, or downloads it. */
  private async save(blob: Blob, fileName: string): Promise<void> {
    if (this.deps.fileSaver != null) {
      await this.deps.fileSaver(blob, fileName);
      return;
    }
    const { downloadBlob } = await import('./run-export');
    downloadBlob(this.deps.document(), blob, fileName);
  }

  /** Announces and reports what one finished run did. */
  private report(format: string, outcome: ExportOutcome): void {
    switch (outcome.status) {
      case 'done':
        this.deps.onExported(format, outcome.fileName, outcome.rowCount);
        this.deps.announce(
          this.deps.translate('datagrid.export.done', {
            count: outcome.rowCount,
            file: outcome.fileName,
          }),
        );
        return;
      case 'canceled':
      case 'vetoed':
        this.deps.onCanceled(format);
        this.deps.announce(this.deps.translate('datagrid.export.canceled'));
        return;
      case 'unsupported':
        this.deps.onFailed({
          message: `datagrid: no export adapter is registered for "${outcome.format}"`,
          cause: null,
          query: {},
        });
        if (isDevMode()) {
          console.warn(
            `datagrid: no export adapter for "${outcome.format}". The library ships csv and tsv; xlsx needs provideDatagridExcel() and pdf needs provideDatagridPdf().`,
          );
        }
        return;
    }
  }
}

/**
 * The per-column value-list popup (§7.2).
 *
 * One instance per grid. It owns the overlay, the entries it has loaded and the
 * load token that makes a late page discard itself, because nothing else in the
 * grid reads any of that — the shell only opens the panel and hears the result
 * through the query store.
 */
import type { PopoverComponentRef } from '@ui/popover';
import { columnField } from '../core/column.store';
import { buildColumnFilter, combineFilterOptions } from '../core/filter/column-filter';
import { buildDateBuckets, dateBucketFilter } from '../core/filter/date-buckets';
import type { DateBucket } from '../core/filter/date-buckets.types';
import { distinctValues } from '../core/filter/distinct-values';
import { and, isConditionNode, where } from '../core/filter/filter-node';
import { resolveCellValue, resolveDisplayValue } from '../core/format';
import { structurallyEqual } from '../core/equality';
import { taggedValueKey } from '../core/grouping/group-nodes';
import type { ColumnDef } from '../core/types/column.types';
import type { FilterNode, HeaderFilterSource } from '../core/types/filter.types';
import type { DataKey } from '@ui/data-source';
import type { DistinctInterval, DistinctValue } from '../core/types/query.types';
import { HEADER_FILTER_POSITIONS } from '../datagrid.constants';
import { DatagridHeaderFilter } from './datagrid-header-filter';
import type { HeaderFilterEntry } from './datagrid-header-filter.types';
import type { HeaderFilterDeps, PanelInputs } from './header-filter-controller.types';
import { flattenHeaderFilterEntries, selectedHeaderFilterNodes } from './header-filter-entries';

export class HeaderFilterController<TRow> {
  private overlay: PopoverComponentRef<DatagridHeaderFilter> | null = null;
  private options: readonly HeaderFilterEntry[] = [];
  private roots: readonly HeaderFilterEntry[] = [];
  private readonly knownOptions = new Map<string, HeaderFilterEntry>();
  private tree = false;
  /** Bumped per load, so a page that arrives after the next one is discarded. */
  private loadToken = 0;
  /** Rows read from a header-filter source for the current search, which "show more" skips. */
  private sourceRead = 0;
  private abort: AbortController | null = null;

  constructor(private readonly deps: HeaderFilterDeps<TRow>) {}

  /** Opens the panel against a header cell, replacing one already up. */
  open(event: { columnId: string; anchor: HTMLElement }): void {
    const column = this.deps.columnById(event.columnId);
    if (column == null) {
      return;
    }
    this.abort?.abort();
    this.deps.cancelDistinctLoad();
    void this.overlay?.ref.close();
    this.options = [];
    this.roots = [];
    this.knownOptions.clear();
    this.tree = false;
    this.sourceRead = 0;
    const caption = column.caption ?? column.field ?? column.id;
    const overlay = this.deps.popover.openComponent(DatagridHeaderFilter, {
      anchor: event.anchor,
      positions: HEADER_FILTER_POSITIONS,
      injector: this.deps.injector,
      onClose: () => {
        if (this.overlay !== overlay) {
          return;
        }
        this.loadToken += 1;
        this.abort?.abort();
        this.abort = null;
        this.deps.cancelDistinctLoad();
        this.overlay = null;
        this.deps.setOpen(false);
        // The panel took focus; the header cell it hangs from is where focus
        // belongs when it goes, and moving a column can relocate that cell.
        // Not after destruction, where the grid closes its own overlay and
        // there is no view left to render into.
        if (!this.deps.isDestroyed()) {
          this.deps.refocusColumn(event.columnId);
        }
      },
    });
    this.overlay = overlay;
    this.deps.setOpen(true);
    const panel = overlay.componentRef;
    panel.setInput('caption', caption);
    panel.setInput(
      'dialogLabel',
      this.deps.translate('datagrid.headerFilter.title', { column: caption }),
    );
    panel.setInput('entries', []);
    panel.setInput('selected', []);
    panel.setInput('loading', true);
    const sourced = column.filter?.headerFilterSource != null;
    panel.setInput('selectAll', !sourced);
    panel.setInput('localSearch', !sourced);
    const pageSize = this.deps.pageSize();
    panel.setInput('pageSize', pageSize);
    panel.instance.applied.subscribe((keys) => {
      this.apply(column, keys);
      void overlay.ref.close();
    });
    panel.instance.canceled.subscribe(() => {
      void overlay.ref.close();
    });
    panel.instance.loadRequested.subscribe((request) => {
      void this.load(column, panel, request.search, request.skip, pageSize);
    });
    void this.load(column, panel, '', 0, pageSize);
  }

  /** Closes the panel without returning focus. For the grid's own teardown. */
  close(): void {
    this.abort?.abort();
    void this.overlay?.ref.close();
  }

  /**
   * Resolves one initial or appended value-domain page.
   *
   * The list is a host-supplied option set where the column declares one,
   * otherwise the distinct values the source answers with — falling back to the
   * loaded rows, which is all a remote source has sent.
   */
  private async load(
    column: ColumnDef<TRow>,
    panel: PanelInputs,
    search: string,
    skip: number,
    pageSize: number,
  ): Promise<void> {
    const token = ++this.loadToken;
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    panel.setInput('loading', true);

    try {
      const sourced = column.filter?.headerFilterSource;
      if (sourced != null) {
        await this.loadFromSource(column, panel, sourced, {
          search,
          skip,
          pageSize,
          token,
          signal: controller.signal,
        });
        return;
      }
      const options = column.filter?.headerFilterOptions;
      if (options != null) {
        const needle = search.trim().toLocaleLowerCase();
        const matching = options.filter(
          (option) => needle === '' || option.label.toLocaleLowerCase().includes(needle),
        );
        const entries = matching.slice(skip, skip + pageSize).map((option, index) => ({
          key: `o${(skip + index).toString()}`,
          label: option.label,
          count: null,
          blank: false,
          node: option.node,
        }));
        this.commit(column, panel, entries, {
          skip,
          hasMore: skip + entries.length < matching.length,
          partial: false,
          generated: false,
          token,
        });
        return;
      }

      const field = columnField(column);
      const tree = column.dataType === 'date' || column.dataType === 'datetime';
      const result = await this.deps.loadDistinct({
        field,
        interval: this.intervalOf(column),
        filter: null,
        search: tree || search === '' ? null : search,
        skip: tree ? 0 : skip,
        take: tree ? undefined : pageSize + 1,
        signal: controller.signal,
      });
      if (controller.signal.aborted || token !== this.loadToken) {
        return;
      }

      let entries: readonly HeaderFilterEntry[];
      let generated = false;
      if (tree && result.origin !== 'loaded') {
        const sourceIgnoredDay =
          column.dataType === 'datetime' &&
          result.values.length > 0 &&
          !result.values.every((value) => value.interval === 'day');
        let buckets: readonly DateBucket[];
        if (sourceIgnoredDay) {
          const bounds = await this.deps.loadValueBounds(field, controller.signal);
          if (token !== this.loadToken) {
            return;
          }
          buckets =
            bounds == null
              ? []
              : buildDateBuckets([], { generatedRange: { min: bounds.min, max: bounds.max } });
          generated = bounds != null;
        } else {
          buckets = buildDateBuckets(result.values);
        }
        entries = buckets.map((bucket) => this.dateBucketEntry(field, bucket));
      } else if (result.origin === 'loaded') {
        const needle = search.trim().toLocaleLowerCase();
        entries = this.localEntries(column)
          .filter((entry) => needle === '' || entry.label.toLocaleLowerCase().includes(needle))
          .slice(skip, skip + pageSize);
      } else {
        entries = this.flatEntries(
          column,
          result.values.slice(0, pageSize),
          result.representativeRows as readonly TRow[] | undefined,
        );
      }
      this.commit(column, panel, entries, {
        skip: tree ? 0 : skip,
        hasMore: !tree && (result.values.length > pageSize || result.hasMore === true),
        partial: result.partial,
        generated,
        token,
      });
    } catch (cause) {
      if (!controller.signal.aborted && token === this.loadToken) {
        panel.setInput('loading', false);
        panel.setInput('entries', []);
      }
      void cause;
    }
  }

  /** Writes one resolved page into the panel, appending when `skip` is past 0. */
  private commit(
    column: ColumnDef<TRow>,
    panel: PanelInputs,
    entries: readonly HeaderFilterEntry[],
    page: {
      skip: number;
      hasMore: boolean;
      partial: boolean;
      generated: boolean;
      token: number;
    },
  ): void {
    if (page.token !== this.loadToken) {
      return;
    }
    const roots = page.skip === 0 ? entries : [...this.roots, ...entries];
    this.roots = roots;
    this.options = flattenHeaderFilterEntries(roots);
    this.tree = this.options.some((entry) => entry.children != null);
    for (const entry of this.options) {
      this.knownOptions.set(entry.key, entry);
    }
    panel.setInput('entries', roots);
    panel.setInput('selected', this.checkedKeys(column, this.options));
    panel.setInput('hasMore', page.hasMore);
    panel.setInput('partial', page.partial);
    panel.setInput('generated', page.generated);
    panel.setInput('loading', false);
  }

  /** Entries for values the source answered with. */
  private flatEntries(
    column: ColumnDef<TRow>,
    values: readonly DistinctValue[],
    rows?: readonly TRow[],
  ): readonly HeaderFilterEntry[] {
    const field = columnField(column);
    const format = this.deps.formatValue();
    return values.map((entry, index) => {
      const blank = entry.value == null || entry.value === '';
      const interval = entry.interval;
      if (typeof interval === 'object' && typeof entry.value === 'number') {
        const end = entry.value + interval.step;
        return {
          key: `n:${entry.value.toString()}:${interval.step.toString()}`,
          label: `${format(entry.value, column)} – ${format(end, column)}`,
          count: entry.count ?? null,
          blank: false,
          node:
            and(where(field, 'ge', entry.value), where(field, 'lt', end)) ??
            where(field, 'eq', entry.value),
        };
      }
      const row = rows?.[index];
      // The label is the display value and the condition tests the raw one, so
      // a lookup or a `display` mapping never becomes the value compared.
      const mapped =
        column.lookup == null ? undefined : this.deps.displayOf(column.id, entry.value);
      const display =
        mapped ?? (row === undefined ? entry.value : resolveDisplayValue(row, column, entry.value));
      return {
        key: taggedValueKey(blank ? null : entry.value),
        label: blank ? '' : format(display, column),
        count: entry.count ?? null,
        blank,
        node: blank
          ? where(field, 'isNull')
          : (buildColumnFilter(column, 'eq', entry.value) ?? where(field, 'eq', entry.value)),
      };
    });
  }

  private dateBucketEntry(field: string, bucket: DateBucket): HeaderFilterEntry {
    return {
      key: bucket.key,
      label: bucket.label,
      count: bucket.count,
      blank: false,
      node: dateBucketFilter(field, bucket),
      children: bucket.children.map((child) => this.dateBucketEntry(field, child)),
    };
  }

  /**
   * One page of a header-filter source.
   *
   * The first page of an opening also lists the values the column filters by now and the page
   * does not hold, resolved through `byKeys`, so a reader always sees what is ticked.
   */
  private async loadFromSource(
    column: ColumnDef<TRow>,
    panel: PanelInputs,
    sourced: HeaderFilterSource,
    request: {
      search: string;
      skip: number;
      pageSize: number;
      token: number;
      signal: AbortSignal;
    },
  ): Promise<void> {
    const field = headerFilterField(column);
    const term = request.search.trim();
    // A function, not an inline test: each read must see the state after the await before it.
    const stale = (): boolean => request.signal.aborted || request.token !== this.loadToken;
    const from = request.skip === 0 ? 0 : this.sourceRead;
    const result = await sourced.source.load({
      search: term === '' ? null : request.search,
      skip: from,
      take: request.pageSize + 1,
      signal: request.signal,
    });
    if (stale()) {
      return;
    }
    const page = result.rows.slice(0, request.pageSize);
    this.sourceRead = from + page.length;
    const shown = new Set(request.skip === 0 ? [] : this.roots.map((entry) => entry.key));
    let entries = page
      .map((item) => sourcedEntry(field, sourced, item))
      .filter((entry) => !shown.has(entry.key));

    if (request.skip === 0 && term === '') {
      const listed = new Set(entries.map((entry) => entry.key));
      const missing = this.filteredValues(column, field).filter(
        (value) => !listed.has(taggedValueKey(value)),
      );
      if (missing.length > 0 && sourced.source.byKeys !== undefined) {
        const restored = await sourced.source.byKeys(missing as DataKey[], request.signal);
        if (stale()) {
          return;
        }
        entries = [...restored.map((item) => sourcedEntry(field, sourced, item)), ...entries];
      }
    }

    const total = result.totalCount;
    this.commit(column, panel, entries, {
      skip: request.skip,
      hasMore:
        result.rows.length > request.pageSize ||
        result.hasMore === true ||
        (total != null && this.sourceRead < total),
      partial: false,
      generated: false,
      token: request.token,
    });
  }

  /** The values the column's header filter holds now, for a filter the popup wrote. */
  private filteredValues(column: ColumnDef<TRow>, field: string): readonly unknown[] {
    const node = this.deps.headerFilterOf(column.id);
    if (node == null || !isConditionNode(node) || node.field !== field) {
      return [];
    }
    if (node.op === 'eq') {
      return [node.value];
    }
    return node.op === 'in' && Array.isArray(node.value) ? (node.value as unknown[]) : [];
  }

  private intervalOf(column: ColumnDef<TRow>): DistinctInterval | undefined {
    if (column.dataType === 'date' || column.dataType === 'datetime') {
      return 'day';
    }
    return column.filter?.groupInterval;
  }

  /** Entries derived from the loaded rows, for a source that answers nothing. */
  private localEntries(column: ColumnDef<TRow>): readonly HeaderFilterEntry[] {
    const options = column.filter?.headerFilterOptions;
    if (options != null) {
      return options.map((option, index) => ({
        key: `o${index.toString()}`,
        label: option.label,
        count: null,
        blank: false,
        node: option.node,
      }));
    }
    const field = columnField(column);
    const format = this.deps.formatValue();
    return distinctValues<TRow>(this.deps.dataRows(), {
      // The entry stands for the raw cell value, because that is what its
      // condition tests. Labelling it with the display value and then
      // filtering on that label would compare "Active" against a field
      // holding `1`.
      getValue: (row) => resolveCellValue(row, column),
      format: (value, row) => format(resolveDisplayValue(row, column, value), column),
    }).map((entry) => ({
      key: entry.key,
      label: entry.text,
      count: entry.count,
      blank: entry.blank,
      node: entry.blank
        ? where(field, 'isNull')
        : (buildColumnFilter(column, 'eq', entry.value) ?? where(field, 'eq', entry.value)),
    }));
  }

  /**
   * Which entries the column's current filter already checks. An `in` is
   * expanded back into its members, because that is what checking several of
   * them produced in the first place.
   */
  private checkedKeys(
    column: ColumnDef<TRow>,
    entries: readonly HeaderFilterEntry[],
  ): readonly string[] {
    const node = this.deps.headerFilterOf(column.id);
    if (node == null) {
      return [];
    }
    const field = headerFilterField(column);
    let current: readonly FilterNode[];
    if (node.op === 'or') {
      current = node.nodes;
    } else if (isConditionNode(node) && node.op === 'in' && Array.isArray(node.value)) {
      current = node.value.map((value) => where(field, 'eq', value));
    } else {
      current = [node];
    }
    return entries
      .filter((entry) => current.some((candidate) => structurallyEqual(candidate, entry.node)))
      .flatMap((entry) => flattenHeaderFilterEntries([entry]).map((descendant) => descendant.key));
  }

  /**
   * Writes the checked values into the column's header filter slot.
   *
   * Deliberately leaves the filter row alone. The two surfaces hold separate
   * slots that combine with `and`, so a value selection no longer destroys a
   * condition the user typed in the row — which is what made the two feel like
   * one another's undo.
   */
  private apply(column: ColumnDef<TRow>, keys: readonly string[]): void {
    const checked = new Set(keys);
    const nodes = this.tree
      ? selectedHeaderFilterNodes(this.roots, checked)
      : keys.flatMap((key) => {
          const entry = this.knownOptions.get(key);
          return entry === undefined ? [] : [entry.node];
        });
    this.deps.setHeaderFilter(column.id, combineFilterOptions(nodes));
    if (nodes.length === 0) {
      this.deps.announceCleared(column.id);
    } else {
      this.deps.announceApplied(column.id);
    }
  }
}

/** The field a column's header filter tests: its source's, or the column's own. */
function headerFilterField<TRow>(column: ColumnDef<TRow>): string {
  return column.filter?.headerFilterSource?.field ?? columnField(column);
}

/** One entry of a header-filter source. */
function sourcedEntry(
  field: string,
  sourced: HeaderFilterSource,
  item: unknown,
): HeaderFilterEntry {
  const value = sourced.value(item);
  return {
    key: taggedValueKey(value),
    label: sourced.label(item),
    count: null,
    blank: false,
    node: where(field, 'eq', value),
  };
}

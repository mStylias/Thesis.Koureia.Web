/**
 * Query facets and their composition into one declarative descriptor.
 *
 * All facet mutations are plain signal writes, so any number of synchronous
 * changes — a `setState()` call included — collapse into one recomputation
 * and one data request downstream.
 */
import { computed, signal, type Signal } from '@angular/core';
import { structurallyEqual } from './equality';
import { normalizePageIndex, normalizePageSize } from './paging';
import { and } from './filter/filter-node';
import { resolveRelativeDateFilter } from './filter/relative-date';
import type { FilterNode } from './types/filter.types';
import type { AggregateSpec, GroupSpec, Query, SortSpec } from './types/query.types';
import type { RelativeColumnFilter, QueryStoreInit } from './query.store.types';

/** Holds every query facet and derives the query descriptor. */
export class QueryStore {
  private readonly initial: Required<QueryStoreInit>;

  private readonly sortSig;
  private readonly groupSig;
  private readonly filterSig;
  private readonly baseFilterSig;
  private readonly columnFiltersSig = signal<ReadonlyMap<string, FilterNode>>(new Map());
  private readonly headerFiltersSig = signal<ReadonlyMap<string, FilterNode>>(new Map());
  private readonly relativeFiltersSig = signal<ReadonlyMap<string, RelativeColumnFilter>>(
    new Map(),
  );
  private readonly searchSig;
  private readonly pageIndexSig = signal(0);
  private readonly pageSizeSig;
  private readonly aggregatesSig;
  private readonly requireTotalCountSig;
  private readonly selectSig = signal<readonly string[] | null>(null);
  private readonly expandSig = signal<readonly string[] | null>(null);
  private readonly reloadTickSig = signal(0);
  private timezoneOf: () => string | undefined = () => undefined;

  constructor(init: QueryStoreInit = {}) {
    this.initial = {
      sort: init.sort ?? [],
      group: init.group ?? [],
      filter: init.filter ?? null,
      baseFilter: init.baseFilter ?? null,
      search: init.search ?? null,
      pageSize: init.pageSize ?? null,
      aggregates: init.aggregates ?? [],
      requireTotalCount: init.requireTotalCount ?? true,
    };
    this.sortSig = signal(this.initial.sort);
    this.groupSig = signal(this.initial.group);
    this.filterSig = signal(this.initial.filter);
    this.baseFilterSig = signal(this.initial.baseFilter);
    this.searchSig = signal(this.initial.search);
    this.pageSizeSig = signal(this.initial.pageSize);
    this.aggregatesSig = signal(this.initial.aggregates);
    this.requireTotalCountSig = signal(this.initial.requireTotalCount);
  }

  readonly sort: Signal<readonly SortSpec[]> = computed(() => this.sortSig());
  readonly group: Signal<readonly GroupSpec[]> = computed(() => this.groupSig());
  /** The user filter tree not owned by a single column. */
  readonly filter: Signal<FilterNode | null> = computed(() => this.filterSig());
  /**
   * Per-column filter sub-trees the filter row owns, keyed by column id.
   *
   * A column has two slots, and this is one of them. The header filter owns
   * {@link headerFilters}, and the two combine with `and` — so a column can
   * carry a typed condition and a value selection at once, and neither surface
   * destroys what the other set.
   */
  readonly columnFilters: Signal<ReadonlyMap<string, FilterNode>> = computed(() =>
    this.columnFiltersSig(),
  );

  /** Per-column filter sub-trees the header filter owns, keyed by column id. */
  readonly headerFilters: Signal<ReadonlyMap<string, FilterNode>> = computed(() =>
    this.headerFiltersSig(),
  );
  /** Relative date descriptors, keyed by column id. Materialized per query. */
  readonly relativeDateFilters: Signal<ReadonlyMap<string, RelativeColumnFilter>> = computed(() =>
    this.relativeFiltersSig(),
  );
  readonly search: Signal<string | null> = computed(() => this.searchSig());
  readonly pageIndex: Signal<number> = computed(() => this.pageIndexSig());
  readonly pageSize: Signal<number | null> = computed(() => this.pageSizeSig());
  /**
   * The IANA zone the day-aligned relative filters count days in. A getter, so the first
   * query already reads the host's zone and no effect has to copy it in first.
   */
  timezone(): string | undefined {
    return this.timezoneOf();
  }

  /** Names where {@link timezone} reads from. */
  useTimezone(read: () => string | undefined): void {
    this.timezoneOf = read;
  }

  /** Bumped by {@link reload}. A watcher re-issues the query with `force`. */
  readonly reloadTick: Signal<number> = computed(() => this.reloadTickSig());

  /** The combined user filter: both per-column slots plus the free tree. */
  readonly userFilter: Signal<FilterNode | null> = computed(() =>
    and(...this.columnFiltersSig().values(), ...this.headerFiltersSig().values(), this.filterSig()),
  );

  /**
   * The query descriptor. Relative date filters are not materialized here —
   * {@link effectiveQuery} resolves them against the current instant so a
   * reload re-evaluates them.
   */
  readonly query: Signal<Query> = computed(() => {
    const query: Query = {};
    const sort = this.sortSig();
    if (sort.length > 0) {
      query.sort = sort;
    }
    const group = this.groupSig();
    if (group.length > 0) {
      query.group = group;
    }
    const filter = and(this.baseFilterSig(), this.userFilter());
    if (filter != null) {
      query.filter = filter;
    }
    const search = this.searchSig();
    if (search != null && search !== '') {
      query.search = search;
    }
    const pageSize = this.pageSizeSig();
    if (pageSize != null) {
      query.skip = this.pageIndexSig() * pageSize;
      query.take = pageSize;
    }
    const aggregates = this.aggregatesSig();
    if (aggregates.length > 0) {
      query.aggregates = aggregates;
    }
    if (this.requireTotalCountSig()) {
      query.requireTotalCount = true;
    }
    const select = this.selectSig();
    if (select != null && select.length > 0) {
      query.select = select;
    }
    const expand = this.expandSig();
    if (expand != null && expand.length > 0) {
      query.expand = expand;
    }
    return query;
  });

  /** The descriptor with relative date filters materialized against `now`. */
  effectiveQuery(now: Date = new Date()): Query {
    const query = this.query();
    const relatives = [...this.relativeFiltersSig().values()].map((entry) =>
      resolveRelativeDateFilter(entry.field, entry.filter, now, this.timezone()),
    );
    if (relatives.length === 0) {
      return query;
    }
    const filter = and(query.filter, ...relatives);
    return filter == null ? query : { ...query, filter };
  }

  setSort(specs: readonly SortSpec[]): void {
    if (structurallyEqual(specs, this.sortSig())) {
      return;
    }
    this.sortSig.set(specs);
    this.pageIndexSig.set(0);
  }

  setGroup(specs: readonly GroupSpec[]): void {
    if (structurallyEqual(specs, this.groupSig())) {
      return;
    }
    this.groupSig.set(specs);
    this.pageIndexSig.set(0);
  }

  setFilter(node: FilterNode | null): void {
    if (structurallyEqual(node, this.filterSig())) {
      return;
    }
    this.filterSig.set(node);
    this.pageIndexSig.set(0);
  }

  /** The base filter is invisible to the user and survives {@link clearFilters}. */
  setBaseFilter(node: FilterNode | null): void {
    if (structurallyEqual(node, this.baseFilterSig())) {
      return;
    }
    this.baseFilterSig.set(node);
    this.pageIndexSig.set(0);
  }

  setColumnFilter(columnId: string, node: FilterNode | null): void {
    const current = this.columnFiltersSig();
    if (structurallyEqual(node, current.get(columnId) ?? null)) {
      return;
    }
    const next = new Map(current);
    if (node == null) {
      next.delete(columnId);
    } else {
      next.set(columnId, node);
    }
    this.columnFiltersSig.set(next);
    this.pageIndexSig.set(0);
  }

  /** Replaces every column filter at once. Used by state application. */
  setColumnFilters(filters: ReadonlyMap<string, FilterNode>): void {
    if (structurallyEqual([...filters], [...this.columnFiltersSig()])) {
      return;
    }
    this.columnFiltersSig.set(new Map(filters));
    this.pageIndexSig.set(0);
  }

  /** Sets or clears the header filter slot of one column. */
  setHeaderFilter(columnId: string, node: FilterNode | null): void {
    const current = this.headerFiltersSig();
    if (structurallyEqual(node, current.get(columnId) ?? null)) {
      return;
    }
    const next = new Map(current);
    if (node == null) {
      next.delete(columnId);
    } else {
      next.set(columnId, node);
    }
    this.headerFiltersSig.set(next);
    this.pageIndexSig.set(0);
  }

  /** Replaces every header filter at once. Used by state application. */
  setHeaderFilters(filters: ReadonlyMap<string, FilterNode>): void {
    if (structurallyEqual([...filters], [...this.headerFiltersSig()])) {
      return;
    }
    this.headerFiltersSig.set(new Map(filters));
    this.pageIndexSig.set(0);
  }

  /**
   * Sets or clears a column's relative date filter. An explicit range edit
   * must clear the descriptor through this method, so the two never
   * oscillate — the most recent explicit action wins.
   */
  setRelativeDateFilter(columnId: string, entry: RelativeColumnFilter | null): void {
    const current = this.relativeFiltersSig();
    if (structurallyEqual(entry, current.get(columnId) ?? null)) {
      return;
    }
    const next = new Map(current);
    if (entry == null) {
      next.delete(columnId);
    } else {
      next.set(columnId, entry);
    }
    this.relativeFiltersSig.set(next);
    this.pageIndexSig.set(0);
  }

  /** Replaces every relative date filter at once. Used by state application. */
  setRelativeDateFilters(filters: ReadonlyMap<string, RelativeColumnFilter>): void {
    if (structurallyEqual([...filters], [...this.relativeFiltersSig()])) {
      return;
    }
    this.relativeFiltersSig.set(new Map(filters));
    this.pageIndexSig.set(0);
  }

  setSearch(search: string | null): void {
    const normalized = search === '' ? null : search;
    if (normalized === this.searchSig()) {
      return;
    }
    this.searchSig.set(normalized);
    this.pageIndexSig.set(0);
  }

  /** Clears every user filter: both column slots, relative filters, the free tree and the search. */
  clearFilters(): void {
    this.filterSig.set(null);
    this.columnFiltersSig.set(new Map());
    this.headerFiltersSig.set(new Map());
    this.relativeFiltersSig.set(new Map());
    this.searchSig.set(null);
    this.pageIndexSig.set(0);
  }

  setPageIndex(index: number): void {
    this.pageIndexSig.set(normalizePageIndex(index));
  }

  /**
   * Sets the page size, or disables paging with `null`. A number that cannot
   * be a page size is refused rather than normalized: guessing at it would
   * page the grid by a size the host never asked for.
   */
  setPageSize(size: number | null): void {
    const normalized = normalizePageSize(size);
    if (size != null && normalized == null) {
      return;
    }
    if (normalized === this.pageSizeSig()) {
      return;
    }
    this.pageSizeSig.set(normalized);
    this.pageIndexSig.set(0);
  }

  setAggregates(specs: readonly AggregateSpec[]): void {
    if (!structurallyEqual(specs, this.aggregatesSig())) {
      this.aggregatesSig.set(specs);
    }
  }

  setRequireTotalCount(require: boolean): void {
    this.requireTotalCountSig.set(require);
  }

  /** Sets the projection computed from the visible columns plus the key. */
  setProjection(select: readonly string[] | null, expand: readonly string[] | null): void {
    if (!structurallyEqual(select, this.selectSig())) {
      this.selectSig.set(select);
    }
    if (!structurallyEqual(expand, this.expandSig())) {
      this.expandSig.set(expand);
    }
  }

  /** Requests a re-run of the current query, bypassing deduplication. */
  reload(): void {
    this.reloadTickSig.update((tick) => tick + 1);
  }

  /** Returns every facet to its initial value. */
  reset(): void {
    this.sortSig.set(this.initial.sort);
    this.groupSig.set(this.initial.group);
    this.filterSig.set(this.initial.filter);
    this.baseFilterSig.set(this.initial.baseFilter);
    this.columnFiltersSig.set(new Map());
    this.headerFiltersSig.set(new Map());
    this.relativeFiltersSig.set(new Map());
    this.searchSig.set(this.initial.search);
    this.pageIndexSig.set(0);
    this.pageSizeSig.set(this.initial.pageSize);
    this.aggregatesSig.set(this.initial.aggregates);
    this.requireTotalCountSig.set(this.initial.requireTotalCount);
  }
}

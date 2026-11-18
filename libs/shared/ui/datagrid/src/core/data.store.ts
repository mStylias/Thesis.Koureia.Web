/**
 * Data loading: mode resolution, request coalescing, abortion of superseded
 * requests, interception hooks, and load results as signals.
 *
 * Errors are data — a failed load sets the `error` signal and never throws
 * into the caller.
 */
import {
  PendingTasks,
  computed,
  effect,
  isDevMode,
  signal,
  untracked,
  type EffectRef,
  type Injector,
  type Signal,
} from '@angular/core';
import { normalizeRemote, remoteMatrixWarning, splitRequest } from '@ui/data-source';
import { structurallyEqual } from './equality';
import { compileFilterPredicate } from './filter/compile-predicate';
import { collectDistinctValues } from './filter/distinct-values';
import { createLocalDataSource, applyQueryLocally } from './local-engine/apply-query';
import type { LocalEngineOptions } from './local-engine/apply-query.types';
import { getPath } from './paths';
import { isPageAdvance } from './paging';
import type { QueryStore } from './query.store';
import type {
  DataConfig,
  DataInput,
  DistinctValuesRequest,
  GridDataSource,
  GridLoadError,
  GroupResult,
  Query,
  QueryResult,
  RemoteOperations,
} from './types/query.types';
import type {
  NormalizedData,
  DataAccumulation,
  DistinctLoadResult,
  ValueBounds,
} from './data.store.types';

function isDataConfig<TRow>(input: DataInput<TRow> | DataConfig<TRow>): input is DataConfig<TRow> {
  return !Array.isArray(input) && !('load' in input);
}

const ALL_REMOTE: Required<RemoteOperations> = normalizeRemote(true);

/**
 * Reports a remote matrix whose local half cannot produce dataset-wide
 * results. The rule is `@ui/data-source`'s; the dev-mode gate and the console
 * are the grid's, because the shared lib has no framework to ask.
 */
function checkRemoteMatrix(remote: Required<RemoteOperations>): void {
  if (!isDevMode()) {
    return;
  }
  const warning = remoteMatrixWarning(remote, 'datagrid');
  if (warning !== null) {
    console.error(warning);
  }
}

function normalizeData<TRow>(
  input: DataInput<TRow> | DataConfig<TRow>,
  engineOptions: () => LocalEngineOptions<TRow> | undefined,
): NormalizedData<TRow> {
  const config: DataConfig<TRow> = isDataConfig(input) ? input : { source: input };
  const normalized: NormalizedData<TRow> = Array.isArray(config.source)
    ? // An array source runs the full local engine and looks all-remote here.
      {
        source: createLocalDataSource<TRow>(() => config.source as readonly TRow[], engineOptions),
        array: config.source as readonly TRow[],
        remote: ALL_REMOTE,
      }
    : {
        source: config.source as GridDataSource<TRow>,
        array: null,
        remote: normalizeRemote(config.remote),
      };
  if (config.transformQuery) {
    normalized.transformQuery = config.transformQuery;
  }
  if (config.transformResult) {
    normalized.transformResult = config.transformResult;
  }
  if (config.onLoadError) {
    normalized.onLoadError = config.onLoadError;
  }
  checkRemoteMatrix(normalized.remote);
  return normalized;
}

/**
 * Splits a query into the remote part and the part the grid runs locally.
 *
 * `splitRequest` is generic over the request, so the grid's `group` and
 * `aggregates` — members no plain `LoadRequest` has — travel through the same
 * code every other control uses.
 */
function splitQuery(
  query: Query,
  remote: Required<RemoteOperations>,
): { outgoing: Query; local: Query } {
  return splitRequest(query, remote);
}

function toLoadError(cause: unknown, query: Query): GridLoadError {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'Data load failed';
  const { signal: _signal, ...rest } = query;
  void _signal;
  return { message, cause, query: rest };
}

/** Loads data for a query store and exposes the results as signals. */
export class DataStore<TRow = unknown> {
  private data: NormalizedData<TRow>;
  private engineOptions: LocalEngineOptions<TRow> | undefined;
  private accumulation: DataAccumulation = 'replace';
  private minRefreshDuration = 0;
  private initialLoadingFloor = 0;

  private readonly rowsSig = signal<readonly TRow[]>([]);
  private readonly groupsSig = signal<readonly GroupResult<TRow>[] | null>(null);
  private readonly totalCountSig = signal<number | null>(null);
  private readonly aggregatesSig = signal<Readonly<Record<string, unknown>> | null>(null);
  private readonly loadingSig = signal(false);
  private readonly errorSig = signal<GridLoadError | null>(null);
  private readonly settledSig = signal(false);
  private readonly reportedSig = signal(false);

  /**
   * A signal, unlike the floor beside it: {@link initialLoadingVisible} reads a
   * different source when the gate is off, so the switch has to be tracked.
   */
  private readonly initialLoadingGated = signal(false);

  /** The rows of the latest settled load. */
  readonly rows: Signal<readonly TRow[]> = computed(() => this.rowsSig());
  /** Hierarchical groups when the source grouped remotely. */
  readonly groups: Signal<readonly GroupResult<TRow>[] | null> = computed(() => this.groupsSig());
  readonly totalCount: Signal<number | null> = computed(() => this.totalCountSig());
  readonly aggregates: Signal<Readonly<Record<string, unknown>> | null> = computed(() =>
    this.aggregatesSig(),
  );
  readonly loading: Signal<boolean> = computed(() => this.loadingSig());
  readonly error: Signal<GridLoadError | null> = computed(() => this.errorSig());
  /**
   * True once the first load (success or failure) completed for the current
   * data source identity. Never reverts until the source is replaced.
   */
  readonly settled: Signal<boolean> = computed(() => this.settledSig());
  /** True only during the first load of the current source. */
  readonly initialLoading: Signal<boolean> = computed(
    () => this.loadingSig() && !this.settledSig(),
  );
  /**
   * True while the first load draws a placeholder: from the moment it is
   * pending until it commits. Equal to {@link initialLoading} until
   * {@link setInitialLoadingFloor} sets a floor.
   */
  readonly initialLoadingVisible: Signal<boolean> = computed(() =>
    this.initialLoadingGated() ? this.reportedSig() : this.initialLoading(),
  );

  private lastIssued: Query | null = null;
  private pending: { query: Query; force: boolean } | null = null;
  private batch: { promise: Promise<void>; resolve: () => void } | null = null;
  private inFlight: AbortController | null = null;
  private distinctInFlight: AbortController | null = null;
  /** Instant the first load was reported. Null while nothing reports it. */
  private reportedAt: number | null = null;
  private readonly distinctCache = new Map<string, DistinctLoadResult>();
  private readonly boundsCache = new Map<string, ValueBounds | null>();

  constructor(data: DataInput<TRow> | DataConfig<TRow>, engineOptions?: LocalEngineOptions<TRow>) {
    this.engineOptions = engineOptions;
    this.data = normalizeData(data, () => this.engineOptions);
  }

  /**
   * Replaces the data source. Resets the settled flag — the next load fires
   * a new first-settled — and forgets the deduplication baseline.
   */
  setData(
    data: DataInput<TRow> | DataConfig<TRow>,
    engineOptions?: LocalEngineOptions<TRow>,
  ): void {
    if (engineOptions !== undefined) {
      this.engineOptions = engineOptions;
    }
    this.data = normalizeData(data, () => this.engineOptions);
    this.inFlight?.abort();
    this.distinctInFlight?.abort();
    this.inFlight = null;
    this.distinctInFlight = null;
    this.distinctCache.clear();
    this.boundsCache.clear();
    this.lastIssued = null;
    this.settledSig.set(false);
    this.loadingSig.set(false);
    // A report already up stays up: a replaced source is the same first load to
    // the reader. Array data answers at once and draws no placeholder.
    if (this.data.array != null) {
      this.lowerReport();
    }
  }

  /**
   * Replaces the loaded rows without issuing a query. Backs
   * `GridApi.applyTransaction`.
   *
   * `totalDelta` moves a known total by the rows a transaction added or
   * removed, so the pager and `aria-rowcount` stay truthful until the next
   * load. A source that reported no total keeps reporting none.
   */
  setRows(rows: readonly TRow[], options?: { totalDelta?: number }): void {
    this.rowsSig.set(rows);
    const delta = options?.totalDelta ?? 0;
    const total = this.totalCountSig();
    if (delta !== 0 && total != null) {
      this.totalCountSig.set(Math.max(0, total + delta));
    }
  }

  /** Replaces the local engine options without touching the source or the loaded rows. */
  setEngineOptions(engineOptions: LocalEngineOptions<TRow>): void {
    this.engineOptions = engineOptions;
    this.distinctCache.clear();
    this.boundsCache.clear();
  }

  /**
   * Loads one page of a column's dataset-wide value domain.
   *
   * Resolution is remote capability, whole array, then loaded rows. Calls are
   * cached without their abort signal, and a newer uncached request aborts the
   * previous one.
   */
  async loadDistinct(request: DistinctValuesRequest): Promise<DistinctLoadResult> {
    const key = distinctRequestKey(request);
    const cached = this.distinctCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    this.distinctInFlight?.abort();
    const controller = new AbortController();
    this.distinctInFlight = controller;
    const abort = (): void => {
      controller.abort();
    };
    request.signal?.addEventListener('abort', abort, { once: true });

    try {
      const sent = { ...request, signal: controller.signal };
      let resolved: DistinctLoadResult;
      if (this.data.source.loadDistinct != null && this.data.array == null) {
        try {
          const result = await this.data.source.loadDistinct(sent);
          if (controller.signal.aborted) {
            throw abortError();
          }
          resolved = {
            values: result.values,
            ...(result.hasMore === undefined ? {} : { hasMore: result.hasMore }),
            partial: false,
            origin: 'source',
          };
        } catch (cause) {
          if (controller.signal.aborted) {
            throw cause;
          }
          resolved = this.collectDistinct(this.rowsSig(), sent, true, 'loaded');
        }
      } else if (this.data.array != null) {
        resolved = this.collectDistinct(this.data.array, sent, false, 'array');
      } else {
        resolved = this.collectDistinct(this.rowsSig(), sent, true, 'loaded');
      }
      this.distinctCache.set(key, resolved);
      return resolved;
    } finally {
      request.signal?.removeEventListener('abort', abort);
      if (this.distinctInFlight === controller) {
        this.distinctInFlight = null;
      }
    }
  }

  /** Stops a header-filter request when its panel closes. */
  cancelDistinctLoad(): void {
    this.distinctInFlight?.abort();
    this.distinctInFlight = null;
  }

  /** Loads the unfiltered minimum and maximum used by a generated date calendar. */
  async loadValueBounds(field: string, signal?: AbortSignal): Promise<ValueBounds | null> {
    if (this.boundsCache.has(field)) {
      return this.boundsCache.get(field) ?? null;
    }
    if (signal?.aborted === true) {
      throw abortError();
    }
    const getValue =
      this.engineOptions?.getValue ?? ((row: TRow, path: string) => getPath(row, path));
    if (this.data.array != null) {
      const bounds = boundsOf(this.data.array.map((row) => getValue(row, field)));
      this.boundsCache.set(field, bounds);
      return bounds;
    }

    const loadEdge = async (desc: boolean): Promise<unknown> => {
      let query: Query = { sort: [{ field, desc }], take: 1, select: [field], signal };
      if (this.data.transformQuery) {
        query = this.data.transformQuery(query);
      }
      let result = await this.data.source.load(query);
      if (signal?.aborted === true) {
        throw abortError();
      }
      if (this.data.transformResult) {
        result = this.data.transformResult(result, query);
      }
      const row = result.rows[0];
      return row === undefined ? undefined : getValue(row, field);
    };
    const [min, max] = await Promise.all([loadEdge(false), loadEdge(true)]);
    const bounds = min === undefined || max === undefined ? null : { min, max };
    this.boundsCache.set(field, bounds);
    return bounds;
  }

  /**
   * Runs one query without touching the loaded rows, the loading flag or the
   * error signal.
   *
   * Export pages through the whole dataset this way (§15), so fetching every
   * row never disturbs what is on screen and never competes with the load the
   * viewport is waiting for. Failures reach the caller as a rejection: this is
   * one host-initiated request, not the state of the grid.
   */
  async fetch(query: Query, signal?: AbortSignal): Promise<QueryResult<TRow>> {
    const split = splitQuery(query, this.data.remote);
    let sent: Query = signal == null ? { ...split.outgoing } : { ...split.outgoing, signal };
    if (this.data.transformQuery) {
      sent = this.data.transformQuery(sent);
    }
    let result = await this.data.source.load(sent);
    if (this.data.transformResult) {
      result = this.data.transformResult(result, sent);
    }
    return this.postProcess(result, split.local);
  }

  /** Switches between replacing the rows on each load and extending them. */
  setAccumulation(mode: DataAccumulation): void {
    this.accumulation = mode;
  }

  /**
   * Floor on how long a forced load takes before it commits, in milliseconds.
   *
   * A refresh is the one load whose result can be identical to what is already
   * on screen, so the only thing that tells the user it ran is the indicator.
   * An endpoint that answers in 80ms would flash it and swap nothing. The
   * floor holds `loading` up — and the rows unchanged — until it elapses, so
   * the indicator is legible and the new rows arrive with it, not before.
   *
   * Forced loads only. A sort or a page change is a load whose result the user
   * can see, and delaying those would be latency the grid invented.
   */
  setMinRefreshDuration(milliseconds: number): void {
    this.minRefreshDuration = positiveMilliseconds(milliseconds);
  }

  /**
   * How long the first load's placeholder stays up at minimum.
   *
   * A first load has no rows behind it, so what reports it is a placeholder
   * the size of the grid. The placeholder goes up as soon as the load is
   * pending, and the commit waits until it has been up `minDuration`, so an
   * endpoint that answers in 60ms does not build the shape and tear it down
   * inside one blink. The request itself is never held.
   *
   * Array data is exempt. It answers at once and has nothing to wait for.
   *
   * Zero turns the gate off and reports every first load as it runs. Leave it
   * off on the server, where a render is one shot and the gate could only
   * hold the response back.
   */
  setInitialLoadingFloor(minDuration: number): void {
    this.initialLoadingFloor = positiveMilliseconds(minDuration);
    this.initialLoadingGated.set(this.initialLoadingFloor > 0);
  }

  /**
   * Puts the first-load placeholder up before the first query goes out, for a
   * wait the host owns, such as a saved arrangement that is still loading. The
   * floor counts from here. Does nothing once the report is up or the first
   * load has settled.
   */
  reportInitialLoad(): void {
    if (
      !this.initialLoadingGated() ||
      this.data.array != null ||
      this.settledSig() ||
      this.reportedAt != null
    ) {
      return;
    }
    this.reportedAt = Date.now();
    this.reportedSig.set(true);
  }

  /**
   * Requests a load. Calls in the same microtask coalesce into one request
   * carrying the latest query; a query identical to the last issued one is
   * skipped unless `force` is set. Resolves when the batch settles.
   */
  schedule(query: Query, options?: { force?: boolean }): Promise<void> {
    const force = (this.pending?.force ?? false) || (options?.force ?? false);
    this.pending = { query, force };
    if (this.batch == null) {
      let resolve = (): void => undefined;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      this.batch = { promise, resolve };
      queueMicrotask(() => {
        void this.run();
      });
    }
    return this.batch.promise;
  }

  private async run(): Promise<void> {
    const batch = this.batch;
    const pending = this.pending;
    this.batch = null;
    this.pending = null;
    try {
      if (pending == null) {
        return;
      }
      if (
        !pending.force &&
        this.lastIssued != null &&
        structurallyEqual(pending.query, this.lastIssued)
      ) {
        return;
      }
      await this.execute(pending.query, pending.force);
    } finally {
      batch?.resolve();
    }
  }

  /**
   * Runs one query end to end.
   *
   * The whole pipeline sits inside one boundary, not just the source call: a
   * `transformQuery`, a `transformResult`, a comparator and a custom aggregate
   * can all throw, and every one of them is a failed load rather than a
   * rejected promise. The `finally` is what guarantees `loading` comes back
   * down whichever way the pipeline ended.
   */
  private async execute(query: Query, forced = false): Promise<void> {
    const startedAt = Date.now();
    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;
    const append = this.accumulation === 'accumulate' && isPageAdvance(this.lastIssued, query);
    this.lastIssued = query;
    this.loadingSig.set(true);
    if (!this.settledSig()) {
      this.reportInitialLoad();
    }
    // Reported with the error, so it names the query the host issued rather
    // than whatever a failing transform left behind.
    let outgoing: Query = query;
    try {
      const split = splitQuery(query, this.data.remote);
      outgoing = split.outgoing;
      let sent: Query = { ...split.outgoing, signal: controller.signal };
      if (this.data.transformQuery) {
        sent = this.data.transformQuery(sent);
      }
      let result = await this.data.source.load(sent);
      if (controller.signal.aborted) {
        return;
      }
      if (this.data.transformResult) {
        result = this.data.transformResult(result, sent);
      }
      result = this.postProcess(result, split.local);
      if (!(await this.holdRefreshFloor(forced, startedAt, controller.signal))) {
        return;
      }
      if (!(await this.holdReportFloor(controller.signal))) {
        return;
      }
      this.errorSig.set(null);
      this.rowsSig.set(append ? [...this.rowsSig(), ...result.rows] : result.rows);
      this.groupsSig.set(result.groups ?? null);
      this.totalCountSig.set(result.totalCount ?? null);
      this.aggregatesSig.set(result.aggregates ?? null);
      this.settledSig.set(true);
    } catch (cause) {
      // A superseded request has a successor on the way, so it reports
      // nothing: its failure is not the state of the grid.
      if (controller.signal.aborted) {
        return;
      }
      // Held as long as a success is: a failure that lands before the
      // indicator does reads as a click that broke something.
      if (!(await this.holdRefreshFloor(forced, startedAt, controller.signal))) {
        return;
      }
      if (!(await this.holdReportFloor(controller.signal))) {
        return;
      }
      const error = toLoadError(cause, outgoing);
      this.errorSig.set(error);
      this.data.onLoadError?.(error);
      this.settledSig.set(true);
    } finally {
      // A superseded request leaves the report up: its successor is the same
      // first load as far as the reader is concerned, and it carries it on.
      if (this.inFlight === controller) {
        this.inFlight = null;
        this.loadingSig.set(false);
        this.lowerReport();
      }
    }
  }

  private lowerReport(): void {
    this.reportedAt = null;
    this.reportedSig.set(false);
  }

  /**
   * Waits out the rest of the first load's floor before it commits. Answers
   * whether the load may still commit, as {@link holdRefreshFloor} does.
   */
  private async holdReportFloor(signal: AbortSignal): Promise<boolean> {
    if (this.reportedAt == null) {
      return !signal.aborted;
    }
    const remaining = this.initialLoadingFloor - (Date.now() - this.reportedAt);
    if (remaining > 0) {
      await waitOut(remaining, signal);
    }
    return !signal.aborted;
  }

  /**
   * Waits out the rest of {@link setMinRefreshDuration} before a forced load
   * commits. Answers whether the load may still commit: a request superseded
   * while it waited has a successor on the way and nothing to show.
   */
  private async holdRefreshFloor(
    forced: boolean,
    startedAt: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const remaining = this.minRefreshDuration - (Date.now() - startedAt);
    if (!forced || remaining <= 0) {
      return !signal.aborted;
    }
    await waitOut(remaining, signal);
    return !signal.aborted;
  }

  /** Runs the locally-owned operations of a hybrid query over the result. */
  private postProcess(result: QueryResult<TRow>, local: Query): QueryResult<TRow> {
    if (Object.keys(local).length === 0) {
      return result;
    }
    const processed = applyQueryLocally(result.rows, local, this.engineOptions);
    const merged: QueryResult<TRow> = { ...result, rows: processed.rows };
    if (processed.totalCount != null) {
      merged.totalCount = processed.totalCount;
    }
    if (processed.aggregates != null) {
      merged.aggregates = { ...(result.aggregates ?? {}), ...processed.aggregates };
    }
    return merged;
  }

  private collectDistinct(
    sourceRows: readonly TRow[],
    request: DistinctValuesRequest,
    partial: boolean,
    origin: 'array' | 'loaded',
  ): DistinctLoadResult {
    const getValue =
      this.engineOptions?.getValue ?? ((row: TRow, field: string) => getPath(row, field));
    const rows =
      request.filter == null
        ? sourceRows
        : sourceRows.filter(compileFilterPredicate(request.filter, { getValue }));
    const values = collectDistinctValues(rows, request, getValue);
    const skip = Math.max(0, request.skip ?? 0);
    const page = values.slice(skip, request.take == null ? undefined : skip + request.take);
    return {
      values: page,
      representativeRows: page.map((entry) => entry.row),
      hasMore: request.take == null ? false : skip + page.length < values.length,
      partial,
      origin,
    };
  }
}

function positiveMilliseconds(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Resolves after `milliseconds`, or as soon as the load is superseded. */
function waitOut(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    // Declared after `finish` reads it: the read happens when the timer or the
    // abort fires, which is after this line either way.
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}

function distinctRequestKey(request: DistinctValuesRequest): string {
  const { signal: _signal, ...key } = request;
  void _signal;
  return JSON.stringify(key);
}

function abortError(): Error {
  const error = new Error('Distinct-values load aborted');
  error.name = 'AbortError';
  return error;
}

function boundsOf(values: readonly unknown[]): ValueBounds | null {
  const present = values.filter((value) => comparableValue(value) != null);
  if (present.length === 0) {
    return null;
  }
  let min = present[0];
  let max = present[0];
  for (const value of present.slice(1)) {
    if ((comparableValue(value) ?? 0) < (comparableValue(min) ?? 0)) {
      min = value;
    }
    if ((comparableValue(value) ?? 0) > (comparableValue(max) ?? 0)) {
      max = value;
    }
  }
  return { min, max };
}

function comparableValue(value: unknown): number | string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Wires a query store to a data store: every facet change schedules a
 * coalesced load, and `reload()` forces one past deduplication. Relative
 * date filters materialize at schedule time, so every load re-evaluates
 * them against the current instant.
 *
 * `enabled` holds the first query while a saved state is still being restored
 * (§14.2). The effect keeps tracking while it answers false, so the query the
 * state produced is what goes out the moment it opens — not the one the grid
 * would have issued with the wrong projection.
 */
export function connectDataStore<TRow>(
  queryStore: QueryStore,
  dataStore: DataStore<TRow>,
  injector: Injector,
  options?: { enabled?: () => boolean },
): EffectRef {
  let lastTick: number | null = null;
  const pendingTasks = injector.get(PendingTasks);
  return effect(
    () => {
      // Track the descriptor, the relative filter set and the reload tick.
      queryStore.query();
      queryStore.relativeDateFilters();
      queryStore.timezone();
      const tick = queryStore.reloadTick();
      const force = lastTick != null && tick !== lastTick;
      lastTick = tick;
      if (options?.enabled?.() === false) {
        return;
      }
      const query = untracked(() => queryStore.effectiveQuery());
      // Registered as a pending task so the application counts as unstable
      // until the load settles: server rendering waits for real data, and
      // tests can await stability instead of guessing at timings.
      pendingTasks.run(async () => {
        await dataStore.schedule(query, { force });
      });
    },
    { injector },
  );
}

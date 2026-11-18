import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  InjectionToken,
  PLATFORM_ID,
  Service,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type ParamMap, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import {
  AnalyticsApi,
  type AnalyticsQueryParameters,
  type OverviewTabResponse,
} from '@api/analytics';
import { StaffAccessStore } from '@auth/data-access';
import { injectErrorMessageResolver } from '@synax/client';
import type { HttpError, Result } from '@synax/client/core';
import { ToasterService } from '@ui/toaster';
import { todayLocal } from '@ui/date-picker';
import { firstValueFrom, map, type Observable } from 'rxjs';

import type {
  DashboardEntry,
  DashboardTabEntries,
  DashboardTabLoader,
  DashboardTabResponses,
  DashboardToday,
} from './analytics-dashboard.types';
import {
  DASHBOARD_PARAMS,
  DEFAULT_RANGE,
  dashboardQueryRewrite,
  decodeDashboardQuery,
  encodeDashboardQuery,
  resolveDashboardFilters,
  sameFilters,
} from './page/dashboard-filters.query';
import type {
  DashboardFilterValues,
  DashboardQueryParams,
  DashboardQueryPatch,
  DashboardQueryUpdate,
  DashboardTab,
} from './page/dashboard-filters.types';

/**
 * How long the first-load skeleton stays up at minimum. The same floor as the staff page's, so
 * a fast answer does not flash the shape for one frame.
 */
export const SKELETON_MIN_DURATION = 200;

/** The browser's today. A spec provides a fixed day. */
export const DASHBOARD_TODAY = new InjectionToken<DashboardToday>('DASHBOARD_TODAY', {
  providedIn: 'root',
  factory: () => todayLocal,
});

/** The refusals the toolbar cannot cause, and the filter each one resets. */
const REFUSAL_RESETS: Readonly<Partial<Record<string, DashboardQueryPatch>>> = {
  ANALYTICS_INVALID_PERIOD: { range: DEFAULT_RANGE, from: null, to: null, granularity: null },
  ANALYTICS_INVALID_GRANULARITY: { granularity: null },
  ANALYTICS_STAFF_MEMBER_NOT_FOUND: { staff: null },
};

/** The permission the page needs. A 403 means the caller lost it. */
const ANALYTICS_READ = 'analytics:read';

/** The entry of a tab nothing has read yet. */
const UNREAD: DashboardEntry<never> = { key: '', data: null, loading: false, failed: false };

function readParams(params: ParamMap): DashboardQueryParams {
  return Object.fromEntries(DASHBOARD_PARAMS.map((name) => [name, params.get(name)]));
}

/** What a read depends on. The Team tab compares every barber, so it ignores the barber. */
function readKey(filters: DashboardFilterValues, scope: string, ignoreStaff: boolean): string {
  return [
    scope,
    filters.from,
    filters.to,
    filters.compareTo ?? '',
    filters.granularity ?? '',
    ignoreStaff ? '' : (filters.staffMemberId ?? ''),
  ].join('|');
}

/**
 * The dashboard's state: the filters from the URL, the KPI row and one entry per tab.
 *
 * `autoProvided: false` and provided by the page, so each visit starts empty. A tab whose entry
 * was read with the current filters, language and shop draws without a request.
 */
@Service({ autoProvided: false })
export class AnalyticsDashboardStore {
  private readonly api = inject(AnalyticsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly today = inject(DASHBOARD_TODAY);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  private readonly params = toSignal(this.route.queryParamMap.pipe(map(readParams)), {
    initialValue: readParams(this.route.snapshot.queryParamMap),
  });

  /** The active language. Services, categories and every label follow it. */
  readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** The shop's barbers, inactive ones included. */
  readonly staff = this.access.staff;

  /** The URL's state after every rule. A refused value is its default here. */
  readonly query = computed(() =>
    decodeDashboardQuery(this.params(), {
      today: this.today(),
      staffIds: this.access.staff().map((member) => member.id),
    }),
  );

  readonly tab = computed(() => this.query().tab);

  /** The filters with the preset resolved to dates on today. */
  readonly filters = computed(() => resolveDashboardFilters(this.query(), this.today()), {
    equal: sameFilters,
  });

  /** The shop and the language. A change of either reads everything again. */
  private readonly scope = computed(() => `${this.access.company()?.id ?? ''}|${this.language()}`);

  readonly overview = signal<OverviewTabResponse | null>(null);
  readonly overviewLoading = signal(false);
  readonly overviewFailed = signal(false);
  private overviewKey = '';

  /** The entry of every tab read so far. */
  readonly tabs = signal<DashboardTabEntries>({});

  /** The latest read of each target. An older response is dropped. */
  private readonly sequence = new Map<string, number>();

  /** The read whose refusal was reported in this round, so the overview and the tab toast once. */
  private refusedKey = '';

  /** A 403 reloads the workspace once, not once per refused read. */
  private revoking = false;

  private readonly loaders: { readonly [K in DashboardTab]: DashboardTabLoader<K> } = {
    revenue: (query) => this.api.revenue(query),
    demand: (query) => this.api.demand(query),
    team: (query) => this.api.team(query),
    services: (query) => this.api.services(query),
    customers: (query) => this.api.customers(query),
    lost: (query) => this.api.lostBusiness(query),
    quality: (query) => this.api.quality(query),
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    // A refused value is shown as its default. The URL follows, without a history entry.
    effect(() => {
      const rewrite = dashboardQueryRewrite(this.params(), this.query());
      if (rewrite !== null) {
        untracked(() => {
          this.navigate(rewrite, true);
        });
      }
    });

    // A filter, shop or language change reads the overview and the open tab. Other tabs read
    // when they open.
    effect(() => {
      const filters = this.filters();
      const scope = this.scope();
      const tab = this.tab();
      untracked(() => {
        this.refusedKey = '';
        this.ensureOverview(readKey(filters, scope, false));
        this.ensureTab(tab, readKey(filters, scope, tab === 'team'));
      });
    });
  }

  /** A tab's entry. A tab nothing has read yet has no data and is not loading. */
  entry<K extends DashboardTab>(tab: K): DashboardEntry<DashboardTabResponses[K]> {
    return this.tabs()[tab] ?? UNREAD;
  }

  /** Reads the overview again. */
  retryOverview(): void {
    this.refusedKey = '';
    this.readOverview(this.currentKey(false));
  }

  /** Reads a tab again. */
  retryTab(tab: DashboardTab): void {
    this.refusedKey = '';
    this.readTab(tab, this.currentKey(tab === 'team'));
  }

  /** Changes filters. The URL is the state, so this navigates, and the reads follow it. */
  update(patch: DashboardQueryPatch): void {
    this.apply(patch, false);
  }

  /** Opens a tab. `replaceUrl`, so the back button does not walk through every tab. */
  selectTab(tab: DashboardTab): void {
    if (tab === this.tab()) return;
    this.navigate({ tab: encodeDashboardQuery({ ...this.query(), tab })['tab'] }, true);
  }

  private currentKey(ignoreStaff: boolean): string {
    return readKey(this.filters(), this.scope(), ignoreStaff);
  }

  private apply(patch: DashboardQueryPatch, replaceUrl: boolean): void {
    const params = encodeDashboardQuery({ ...this.query(), ...patch });
    // The tab stays as the URL has it.
    delete params['tab'];
    this.navigate(params, replaceUrl);
  }

  private navigate(params: DashboardQueryUpdate, replaceUrl: boolean): void {
    // A destroyed page must not navigate: `relativeTo` still points at the dashboard.
    if (this.destroyed) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private ensureOverview(key: string): void {
    if (key === this.overviewKey && !this.overviewFailed()) return;
    this.readOverview(key);
  }

  private ensureTab(tab: DashboardTab, key: string): void {
    const entry = this.tabs()[tab];
    if (entry?.key === key && !entry.failed) return;
    this.readTab(tab, key);
  }

  private readOverview(key: string): void {
    const seq = this.next('overview');
    this.overviewKey = key;
    this.overviewLoading.set(true);
    this.overviewFailed.set(false);
    void this.fetch(this.api.overview(this.parameters(false)), this.overview() === null).then(
      (result) => {
        if (result === null || this.sequence.get('overview') !== seq) return;
        this.overviewLoading.set(false);
        if (result.isSuccess) {
          this.overview.set(result.data);
        } else {
          this.overviewFailed.set(true);
          this.refused(result.error, key, false);
        }
      },
    );
  }

  private readTab(tab: DashboardTab, key: string): void {
    const seq = this.next(tab);
    const shown = this.tabs()[tab]?.data ?? null;
    this.setEntry(tab, { key, data: shown, loading: true, failed: false });
    const load = this.loaders[tab] as DashboardTabLoader<DashboardTab>;
    void this.fetch(load(this.parameters(tab === 'team')), shown === null).then((result) => {
      if (result === null || this.sequence.get(tab) !== seq) return;
      if (result.isSuccess) {
        this.setEntry(tab, { key, data: result.data, loading: false, failed: false });
      } else {
        const data = this.tabs()[tab]?.data ?? null;
        this.setEntry(tab, { key, data, loading: false, failed: true });
        this.refused(result.error, key, tab === 'team');
      }
    });
  }

  private setEntry(
    tab: DashboardTab,
    entry: DashboardEntry<DashboardTabResponses[DashboardTab]>,
  ): void {
    this.tabs.update((tabs) => ({ ...tabs, [tab]: entry }));
  }

  private next(target: string): number {
    const seq = (this.sequence.get(target) ?? 0) + 1;
    this.sequence.set(target, seq);
    return seq;
  }

  private parameters(ignoreStaff: boolean): AnalyticsQueryParameters {
    const filters = this.filters();
    return {
      from: filters.from,
      to: filters.to,
      granularity: filters.granularity,
      compareTo: filters.compareTo,
      staffMemberId: ignoreStaff ? null : filters.staffMemberId,
      languageCode: this.language(),
    };
  }

  /**
   * The response, held until the first-load skeleton has been up its minimum. Browser only: a
   * server render is one shot, and the floor could only hold it back. `null` when the page
   * is destroyed first: the request is cancelled.
   */
  private async fetch<T>(source: Observable<Result<T>>, first: boolean): Promise<Result<T> | null> {
    const floor =
      this.isBrowser && first
        ? new Promise((resolve) => setTimeout(resolve, SKELETON_MIN_DURATION))
        : null;
    const result = await firstValueFrom(source.pipe(takeUntilDestroyed(this.destroyRef)), {
      defaultValue: null,
    });
    await floor;
    return this.destroyed ? null : result;
  }

  /**
   * A refusal the toolbar cannot cause resets its filter, with a toast, once per round of reads.
   * A 403 reloads the workspace and leaves the page if `analytics:read` is gone.
   */
  private refused(error: HttpError, key: string, ignoreStaff: boolean): void {
    if (this.destroyed) return;
    if (error.httpCode === 403) {
      void this.leaveIfRevoked();
      return;
    }
    const reset = REFUSAL_RESETS[error.errorCode];
    // A read of older filters reports nothing: the reset already moved the filters.
    if (reset === undefined || key !== this.currentKey(ignoreStaff) || this.refusedKey === key) {
      return;
    }
    this.refusedKey = key;
    this.toaster.error(this.errorMessage(error));
    // The barber left the shop. The reload takes them out of the barber list.
    if (error.errorCode === 'ANALYTICS_STAFF_MEMBER_NOT_FOUND') void this.access.reload();
    // `replaceUrl`, so the back button does not return to the refused address.
    this.apply(reset, true);
  }

  /** Nothing else leaves the page: the shell only hides the sidebar entry. */
  private async leaveIfRevoked(): Promise<void> {
    if (this.revoking) return;
    this.revoking = true;
    try {
      await this.access.reload();
    } finally {
      this.revoking = false;
    }
    if (this.destroyed || this.access.has(ANALYTICS_READ)) return;
    // The workspace root sends the caller to the first page they can open.
    void this.router.navigate(['..'], { relativeTo: this.route, replaceUrl: true });
  }
}

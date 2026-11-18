import { createEnvironmentInjector, EnvironmentInjector, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, type NavigationExtras, Router } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { AnalyticsApi, type AnalyticsQueryParameters } from '@api/analytics';
import { StaffAccessStore } from '@auth/data-access';
import { Result } from '@synax/client/core';
import { ToasterService } from '@ui/toaster';
import { BehaviorSubject, Subject } from 'rxjs';

import {
  AnalyticsDashboardStore,
  DASHBOARD_TODAY,
  SKELETON_MIN_DURATION,
} from './analytics-dashboard.store';
import { TEST_PERIOD } from './testing/dashboard.fixtures';
import type { FakeApiCall as Call } from './testing/dashboard.fixtures.types';

const METHODS = [
  'overview',
  'revenue',
  'demand',
  'team',
  'services',
  'customers',
  'lostBusiness',
  'quality',
] as const;

describe('AnalyticsDashboardStore', () => {
  let calls: Call[];
  let params: BehaviorSubject<Record<string, string>>;
  const company = signal<{ id: string; name: string } | null>({ id: 'c1', name: 'Shop' });
  const staff = signal([
    { id: 's1', displayName: 'A', isActive: true },
    { id: 's2', displayName: 'B', isActive: true },
  ]);
  const toaster = { error: vi.fn(), success: vi.fn() };
  const reloadWorkspace = vi.fn();
  let analyticsRead = true;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let route: object;
  let storeInjector: EnvironmentInjector;

  function setup(platform = 'server'): AnalyticsDashboardStore {
    calls = [];
    params = new BehaviorSubject<Record<string, string>>({});
    const api = Object.fromEntries(
      METHODS.map((method) => [
        method,
        (query: AnalyticsQueryParameters) => {
          const response = new Subject<Result<unknown>>();
          calls.push({ method, query, response });
          return response;
        },
      ]),
    );
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    route = { queryParamMap, snapshot: { queryParamMap: convertToParamMap({}) } };
    params.subscribe((value) => {
      queryParamMap.next(convertToParamMap(value));
    });
    // Merges the way the router does: `null` removes a parameter.
    router = {
      navigate: vi.fn((_: unknown, extras: { queryParams: Record<string, string | null> }) => {
        const merged = { ...params.value, ...extras.queryParams };
        params.next(
          Object.fromEntries(
            Object.entries(merged).filter((entry): entry is [string, string] => entry[1] !== null),
          ),
        );
        return Promise.resolve(true);
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideTransloco({ config: { availableLangs: ['el', 'en'], defaultLang: 'el' } }),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AnalyticsApi, useValue: api },
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: router },
        { provide: ToasterService, useValue: toaster },
        { provide: DASHBOARD_TODAY, useValue: () => '2026-10-04' },
        {
          provide: StaffAccessStore,
          useValue: {
            company,
            staff,
            reload: reloadWorkspace,
            has: (permission: string) => permission === 'analytics:read' && analyticsRead,
          },
        },
      ],
    });
    // Its own injector, so a spec can destroy the store the way the page does.
    storeInjector = createEnvironmentInjector(
      [AnalyticsDashboardStore],
      TestBed.inject(EnvironmentInjector),
    );
    const store = storeInjector.get(AnalyticsDashboardStore);
    TestBed.tick();
    return store;
  }

  function answer(call: Call | undefined, data: unknown): Promise<void> {
    call?.response.next(Result.Ok(data));
    call?.response.complete();
    return settle();
  }

  /** Lets the store's awaits run. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function methods(): string[] {
    return calls.map((call) => call.method);
  }

  beforeEach(() => {
    company.set({ id: 'c1', name: 'Shop' });
    toaster.error.mockReset();
    reloadWorkspace.mockReset();
    analyticsRead = true;
  });

  it('reads the overview and the open tab on the first visit', () => {
    setup();
    expect(methods()).toEqual(['overview', 'revenue']);
    expect(calls[0]?.query).toMatchObject({
      from: '2026-09-05',
      to: '2026-10-04',
      languageCode: 'el',
    });
  });

  it('reads the overview and the open tab only on a filter change', () => {
    const store = setup();
    calls = [];
    store.update({ range: 'last7' });
    TestBed.tick();
    expect(methods()).toEqual(['overview', 'revenue']);
    expect(calls[0]?.query.from).toBe('2026-09-28');
  });

  it('makes no request on a return to a tab with the same filters', async () => {
    const store = setup();
    await answer(calls[1], { period: TEST_PERIOD });
    calls = [];

    store.selectTab('demand');
    TestBed.tick();
    expect(methods()).toEqual(['demand']);

    store.selectTab('revenue');
    TestBed.tick();
    expect(methods()).toEqual(['demand']);
    expect(store.entry('revenue').data).toEqual({ period: TEST_PERIOD });
  });

  it('reads a tab again when it opens after the filters changed', async () => {
    const store = setup();
    await answer(calls[1], { period: TEST_PERIOD });
    store.selectTab('demand');
    TestBed.tick();
    store.update({ compareTo: 'PreviousYear' });
    TestBed.tick();
    calls = [];

    store.selectTab('revenue');
    TestBed.tick();
    expect(methods()).toEqual(['revenue']);
    expect(calls[0]?.query.compareTo).toBe('PreviousYear');
  });

  it('drops a late response of an older read', async () => {
    const store = setup();
    const older = calls[1];
    store.update({ range: 'last7' });
    TestBed.tick();
    const newer = calls[3];

    await answer(newer, { period: TEST_PERIOD, tag: 'newer' });
    await answer(older, { period: TEST_PERIOD, tag: 'older' });

    expect(store.entry('revenue').data).toMatchObject({ tag: 'newer' });
    expect(store.entry('revenue').loading).toBe(false);
  });

  it('keeps the old response on screen while a new read runs', async () => {
    const store = setup();
    await answer(calls[1], { period: TEST_PERIOD, tag: 'first' });
    store.update({ range: 'last7' });
    TestBed.tick();
    expect(store.entry('revenue')).toMatchObject({ loading: true, data: { tag: 'first' } });
  });

  it('reads everything again on a shop change and on a language change', () => {
    setup();
    calls = [];
    company.set({ id: 'c2', name: 'Other' });
    TestBed.tick();
    expect(methods()).toEqual(['overview', 'revenue']);

    calls = [];
    TestBed.inject(TranslocoService).setActiveLang('en');
    TestBed.tick();
    expect(methods()).toEqual(['overview', 'revenue']);
    expect(calls[0]?.query.languageCode).toBe('en');
  });

  it('sends no barber to the Team tab, and a barber change does not read it again', () => {
    const store = setup();
    store.update({ staff: 's1' });
    TestBed.tick();
    store.selectTab('team');
    TestBed.tick();
    const team = calls.find((call) => call.method === 'team');
    expect(team?.query.staffMemberId).toBeNull();

    calls = [];
    store.update({ staff: 's2' });
    TestBed.tick();
    expect(methods()).toEqual(['overview']);
  });

  it('clears the barber with a toast when the API does not know them', async () => {
    const store = setup();
    store.update({ staff: 's1' });
    TestBed.tick();
    const refused = Result.Fail({
      errorCode: 'ANALYTICS_STAFF_MEMBER_NOT_FOUND',
      httpCode: 400,
      validationErrors: [],
    });
    calls[2]?.response.next(refused);
    calls[3]?.response.next(refused);
    await settle();

    expect(toaster.error).toHaveBeenCalledTimes(1);
    expect(store.query().staff).toBeNull();
  });

  it('marks a failed read, and a retry reads it again', async () => {
    const store = setup();
    calls[1]?.response.next(
      Result.Fail({ errorCode: 'ANALYTICS_FETCH_FAILED', httpCode: 500, validationErrors: [] }),
    );
    await settle();
    expect(store.entry('revenue').failed).toBe(true);
    expect(toaster.error).not.toHaveBeenCalled();

    calls = [];
    store.retryTab('revenue');
    expect(methods()).toEqual(['revenue']);
    expect(store.entry('revenue')).toMatchObject({ failed: false, loading: true });
  });

  it('clears the barber with a toast each time the API refuses them again', async () => {
    const store = setup();
    const refused = Result.Fail({
      errorCode: 'ANALYTICS_STAFF_MEMBER_NOT_FOUND',
      httpCode: 400,
      validationErrors: [],
    });
    for (const attempt of [1, 2]) {
      calls = [];
      store.update({ staff: 's1' });
      TestBed.tick();
      calls[0]?.response.next(refused);
      calls[1]?.response.next(refused);
      await settle();
      TestBed.tick();

      expect(toaster.error).toHaveBeenCalledTimes(attempt);
      expect(store.query().staff).toBeNull();
      // The reset replaces the refused address in the history.
      const [, extras] = router.navigate.mock.lastCall as [unknown, NavigationExtras];
      expect(extras.queryParams?.['staff']).toBeNull();
      expect(extras.replaceUrl).toBe(true);
    }
  });

  it('does not report a late refusal of filters the reset already left', async () => {
    const store = setup();
    store.update({ staff: 's1' });
    TestBed.tick();
    const revenue = calls.find((call) => call.method === 'revenue' && call.query.staffMemberId);
    store.selectTab('demand');
    TestBed.tick();
    const refused = Result.Fail({
      errorCode: 'ANALYTICS_STAFF_MEMBER_NOT_FOUND',
      httpCode: 400,
      validationErrors: [],
    });
    calls
      .find((call) => call.method === 'overview' && call.query.staffMemberId)
      ?.response.next(refused);
    await settle();
    TestBed.tick();

    revenue?.response.next(refused);
    await settle();
    expect(toaster.error).toHaveBeenCalledTimes(1);
  });

  it('reloads the workspace once on a 403, and stays while analytics:read is kept', async () => {
    setup();
    const forbidden = Result.Fail({ errorCode: 'FORBIDDEN', httpCode: 403, validationErrors: [] });
    calls[0]?.response.next(forbidden);
    calls[1]?.response.next(forbidden);
    await settle();
    expect(reloadWorkspace).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('leaves the page on a 403 when the reloaded workspace lacks analytics:read', async () => {
    setup();
    reloadWorkspace.mockImplementation(() => {
      analyticsRead = false;
      return Promise.resolve();
    });
    calls[0]?.response.next(
      Result.Fail({ errorCode: 'FORBIDDEN', httpCode: 403, validationErrors: [] }),
    );
    await settle();
    expect(router.navigate).toHaveBeenCalledWith(['..'], { relativeTo: route, replaceUrl: true });
  });

  it('cancels its reads and ignores a late refusal once the page is destroyed', async () => {
    const store = setup();
    store.update({ staff: 's1' });
    TestBed.tick();
    const pending = calls.slice(2);
    router.navigate.mockClear();

    storeInjector.destroy();
    for (const call of pending) {
      call.response.next(
        Result.Fail({
          errorCode: 'ANALYTICS_STAFF_MEMBER_NOT_FOUND',
          httpCode: 400,
          validationErrors: [],
        }),
      );
    }
    await settle();

    expect(pending.map((call) => call.response.observed)).toEqual([false, false]);
    expect(toaster.error).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('holds the first read until the skeleton has been up its minimum', async () => {
    vi.useFakeTimers();
    try {
      const store = setup('browser');
      calls[1]?.response.next(Result.Ok({ period: TEST_PERIOD }));
      await vi.advanceTimersByTimeAsync(SKELETON_MIN_DURATION - 1);
      expect(store.entry('revenue').data).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(store.entry('revenue').data).toEqual({ period: TEST_PERIOD });
    } finally {
      vi.useRealTimers();
    }
  });
});

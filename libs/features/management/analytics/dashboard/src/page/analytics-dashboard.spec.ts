import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AnalyticsApi } from '@api/analytics';
import { StaffAccessStore } from '@auth/data-access';
import { Result } from '@synax/client/core';
import { ToasterService } from '@ui/toaster';
import { BehaviorSubject, Subject } from 'rxjs';

import { DASHBOARD_TODAY, SKELETON_MIN_DURATION } from '../analytics-dashboard.store';
import type { FakeApiCall as Call } from '../testing/dashboard.fixtures.types';
import { provideDashboardTesting, setDashboardTranslations } from '../testing/dashboard.testing';
import { AnalyticsDashboard } from './analytics-dashboard';

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

const FAILED = 'Η φόρτωση των δεικτών απέτυχε.';

describe('AnalyticsDashboard', () => {
  let fixture: ComponentFixture<AnalyticsDashboard>;
  let calls: Call[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(selector: string): HTMLElement {
    const found = root().querySelector(selector);
    if (!(found instanceof HTMLElement)) throw new Error(`${selector} not rendered`);
    return found;
  }

  function retryButton(): HTMLButtonElement | null {
    return root().querySelector('.dashboard-notice button');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Fails the last overview read, after the first-load skeleton floor. */
  async function failOverview(): Promise<void> {
    const call = calls.filter((entry) => entry.method === 'overview').at(-1);
    call?.response.next(
      Result.Fail({ errorCode: 'ANALYTICS_FETCH_FAILED', httpCode: 500, validationErrors: [] }),
    );
    call?.response.complete();
    await new Promise((resolve) => setTimeout(resolve, SKELETON_MIN_DURATION + 20));
    await settle();
  }

  beforeEach(async () => {
    // The tab strip watches its size. jsdom has no layout, so a stub does.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {
          /* no layout */
        }
        unobserve(): void {
          /* no layout */
        }
        disconnect(): void {
          /* no layout */
        }
      },
    );
    calls = [];
    const api = Object.fromEntries(
      METHODS.map((method) => [
        method,
        (parameters: Call['query']) => {
          const response = new Subject<Result<unknown>>();
          calls.push({ method, query: parameters, response });
          return response;
        },
      ]),
    );
    const params = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        ...provideDashboardTesting(),
        { provide: AnalyticsApi, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: new BehaviorSubject(params),
            snapshot: { queryParamMap: params },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
        { provide: ToasterService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: DASHBOARD_TODAY, useValue: () => '2026-10-04' },
        {
          provide: StaffAccessStore,
          useValue: {
            company: signal({ id: 'c1', name: 'Shop' }),
            staff: signal([]),
            reload: vi.fn(),
            has: () => true,
          },
        },
      ],
    });
    setDashboardTranslations();
    fixture = TestBed.createComponent(AnalyticsDashboard);
    document.body.append(fixture.nativeElement as HTMLElement);
    await settle();
  });

  afterEach(() => {
    (fixture.nativeElement as HTMLElement).remove();
    vi.unstubAllGlobals();
  });

  it('announces a failed overview politely, not as an alert', async () => {
    const status = query('.dashboard-kpis [role="status"]');
    expect(status.textContent.trim()).toBe('');

    await failOverview();
    expect(retryButton()).not.toBeNull();
    expect(status.textContent.trim()).toBe(FAILED);
    expect(root().querySelector('.dashboard-kpis [role="alert"]')).toBeNull();
    expect(query('.dashboard-notice').hasAttribute('role')).toBe(false);
    expect(query('.dashboard-notice').getAttribute('data-tone')).toBe('error');
  });

  it('moves focus to the KPI section when the retry removes its button', async () => {
    await failOverview();
    const section = query('section.dashboard-kpis');
    expect(section.getAttribute('tabindex')).toBe('-1');

    const button = retryButton();
    button?.focus();
    const before = calls.filter((entry) => entry.method === 'overview').length;
    button?.click();
    await settle();

    expect(retryButton()).toBeNull();
    expect(document.activeElement).toBe(section);
    expect(calls.filter((entry) => entry.method === 'overview')).toHaveLength(before + 1);
    expect(query('.dashboard-kpis [role="status"]').textContent.trim()).toBe('');
  });
});

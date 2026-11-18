import {
  signal,
  type EnvironmentProviders,
  type Provider,
  type WritableSignal,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { StaffAccessStore, type WorkspaceStaffMemberViewDto } from '@auth/data-access';
import { CHART_LOADER, type ChartModule, ChartSkeleton } from '@ui/chart';

import { AnalyticsDashboardStore } from '../analytics-dashboard.store';
import { ChartCard } from '../charts/chart-card';
import el from '../i18n/el';
import type { DashboardFilterValues } from '../page/dashboard-filters.types';
import type { CardSkeletonView } from './dashboard.fixtures.types';

/** The shop of the specs: five active barbers and one who left. */
export const TEST_STAFF: readonly WorkspaceStaffMemberViewDto[] = [
  { id: 's1', displayName: 'Παύλος Χ.', isActive: true },
  { id: 's2', displayName: 'Γιάννης Ρ.', isActive: true },
  { id: 's3', displayName: 'Αλέξανδρος Σ.', isActive: true },
  { id: 's4', displayName: 'Νίκος Β.', isActive: true },
  { id: 's5', displayName: 'Μάρκος Π.', isActive: true },
  { id: 's6', displayName: 'Στέλιος Κ.', isActive: false },
];

/** The filters of the fake store: the last 90 days, every barber. */
export const TEST_FILTERS: DashboardFilterValues = {
  preset: 'last90',
  from: '2026-07-07',
  to: '2026-10-04',
  compareTo: null,
  granularity: null,
  staffMemberId: null,
};

/**
 * Transloco in Greek with the page's dictionary set, a chart loader that never resolves, a shop
 * of {@link TEST_STAFF} and a store with only {@link TEST_FILTERS}. The page provides the real
 * store, so a page spec gets that one. jsdom has no layout, so a component spec checks the card
 * around the chart, not ECharts.
 */
export function provideDashboardTesting(): (Provider | EnvironmentProviders)[] {
  return [
    provideTransloco({
      config: {
        availableLangs: ['el'],
        defaultLang: 'el',
        missingHandler: { logMissingKey: false },
      },
    }),
    { provide: CHART_LOADER, useValue: () => new Promise<ChartModule>(() => undefined) },
    { provide: StaffAccessStore, useValue: { staff: signal(TEST_STAFF) } },
    {
      provide: AnalyticsDashboardStore,
      useFactory: () => ({ filters: signal<DashboardFilterValues>(TEST_FILTERS) }),
    },
  ];
}

/** The filters of the fake store, to change in a spec. */
export function testFilters(): WritableSignal<DashboardFilterValues> {
  return TestBed.inject(AnalyticsDashboardStore).filters as WritableSignal<DashboardFilterValues>;
}

/** Sets the page's Greek dictionary. Call after `configureTestingModule`. */
export function setDashboardTranslations(): void {
  TestBed.inject(TranslocoService).setTranslation({ managementDashboard: el }, 'el');
}

/** The skeleton of each chart card under `fixture`, in card order. */
export function cardSkeletons(fixture: ComponentFixture<unknown>): CardSkeletonView[] {
  return fixture.debugElement.queryAll(By.directive(ChartCard)).map((card) => {
    const element = card.nativeElement as HTMLElement;
    const legend = element.querySelectorAll('.chart-legend.is-skeleton .chart-legend-item').length;
    const chart = card.queryAll(By.directive(ChartSkeleton)).at(0);
    if (chart) {
      const skeleton = chart.componentInstance as ChartSkeleton;
      const height = (chart.nativeElement as HTMLElement).style.height;
      return { kind: skeleton.kind(), count: skeleton.count(), height, legend };
    }
    const rows = element.querySelectorAll('.chart-card-table tr').length;
    if (rows === 0) throw new Error('chart card skeleton not rendered');
    // The first row stands in for the table head.
    return { kind: 'table', count: rows - 1, height: '', legend };
  });
}

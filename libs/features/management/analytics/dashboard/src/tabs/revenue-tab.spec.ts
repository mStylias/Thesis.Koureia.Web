import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { RevenueTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { categorySet, TEST_PERIOD, timeSet } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
  TEST_FILTERS,
  testFilters,
} from '../testing/dashboard.testing';
import { RevenueTab } from './revenue-tab';

@Component({
  imports: [RevenueTab],
  template: `<lib-revenue-tab [entry]="entry()" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<RevenueTabResponse>>({
    key: 'k',
    data: null,
    loading: false,
    failed: false,
  });
}

const BARBERS = ['Παύλος Χ.', 'Γιάννης Ρ.', 'Αλέξανδρος Σ.', 'Νίκος Β.', 'Μάρκος Π.'];

function response(): RevenueTabResponse {
  return {
    period: TEST_PERIOD,
    revenueOverTime: timeSet([['2026-07-07', '2026-07-12']], { revenue: [1200] }, 'Money'),
    revenuePerStaff: categorySet(
      BARBERS.map((label) => ({ label })),
      { revenue: [1848, 1147, 900, 610, 120], completedAppointments: [89, 71, 50, 33, 6] },
      { revenue: 'Money' },
    ),
    revenuePerService: categorySet(
      [
        { key: 'cut', label: 'Κουρέματα' },
        { key: 'classic', label: 'Κλασικό', parentKey: 'cut' },
        { key: 'uncategorized' },
        { key: 'kids', label: 'Παιδικό', parentKey: 'uncategorized' },
      ],
      { revenue: [3060, 3060, 225, 225] },
      { revenue: 'Money' },
    ),
  };
}

describe('RevenueTab', () => {
  let fixture: ComponentFixture<Host>;

  function heights(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(ChartCard))
      .map((element) => (element.componentInstance as ChartCard).height());
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('sizes the barbers and the categories by their own bars, so a phone stack stays short', () => {
    fixture.componentInstance.entry.update((current) => ({ ...current, data: response() }));
    fixture.detectChanges();
    expect(heights()).toEqual(['12.5rem', '10.75rem', '8rem']);
  });

  it('draws the shape of each chart before the first response, a bar per active barber', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'line', count: undefined, height: '12.5rem', legend: 2 },
      { kind: 'bars-horizontal', count: 5, height: '10.75rem', legend: 0 },
      { kind: 'bars-horizontal', count: 3, height: '8rem', legend: 0 },
    ]);
  });

  it('draws one barber bar before the first response when the filters name a barber', () => {
    testFilters().set({ ...TEST_FILTERS, staffMemberId: 's2' });
    fixture.detectChanges();
    expect(cardSkeletons(fixture)[1]).toEqual({
      kind: 'bars-horizontal',
      count: 1,
      height: '8rem',
      legend: 0,
    });

    testFilters().set(TEST_FILTERS);
    fixture.detectChanges();
    expect(cardSkeletons(fixture)[1]).toMatchObject({ count: 5, height: '10.75rem' });
  });

  it('keeps the skeleton height when the filtered response has the one barber', () => {
    testFilters().set({ ...TEST_FILTERS, staffMemberId: 's2' });
    fixture.detectChanges();
    const skeleton = cardSkeletons(fixture)[1]?.height;
    const data = response();
    fixture.componentInstance.entry.update((current) => ({
      ...current,
      data: {
        ...data,
        revenuePerStaff: categorySet(
          [{ label: 'Γιάννης Ρ.' }],
          { revenue: [1147], completedAppointments: [71] },
          { revenue: 'Money' },
        ),
      },
    }));
    fixture.detectChanges();
    expect(heights()[1]).toBe(skeleton);
  });

  it('keeps the skeleton height when the response has a bar per active barber', () => {
    const skeleton = cardSkeletons(fixture).map((card) => card.height);
    fixture.componentInstance.entry.update((current) => ({ ...current, data: response() }));
    fixture.detectChanges();
    expect(heights()).toEqual(skeleton);
  });
});

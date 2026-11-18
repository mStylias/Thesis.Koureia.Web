import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { TeamTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { categorySet, TEST_PERIOD } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
} from '../testing/dashboard.testing';
import { TeamTab } from './team-tab';

@Component({
  imports: [TeamTab],
  template: `<lib-team-tab [entry]="entry()" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<TeamTabResponse>>({
    key: 'k',
    data: null,
    loading: false,
    failed: false,
  });
}

const BARBERS = [{ label: 'Παύλος Χ.' }, { label: 'Γιάννης Ρ.' }, { label: 'Αλέξανδρος Σ.' }];

function response(barbers: readonly { label: string }[] = BARBERS): TeamTabResponse {
  const some = barbers.length > 0;
  return {
    period: TEST_PERIOD,
    appointmentsPerStaff: categorySet(barbers, {
      completed: some ? [71, 25, 89] : [],
      cancelled: some ? [2, 4, 7] : [],
    }),
    staffUtilization: categorySet(
      barbers,
      {
        utilization: some ? [8.9, null, 13.56] : [],
        bookedMinutes: some ? [2055, 945, 3620] : [],
        availableMinutes: some ? [23100, 0, 26700] : [],
      },
      { utilization: 'Percent', bookedMinutes: 'Minutes', availableMinutes: 'Minutes' },
    ),
    ratingPerStaff: categorySet(
      barbers,
      { averageRating: some ? [4.52, 4.29, null] : [], reviews: some ? [31, 6, 0] : [] },
      { averageRating: 'Rating' },
    ),
  };
}

describe('TeamTab', () => {
  let fixture: ComponentFixture<Host>;

  function cards(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('lib-chart-card'));
  }

  function card(index: number): HTMLElement {
    const element = cards().at(index);
    if (!element) throw new Error(`card ${String(index)} not rendered`);
    return element;
  }

  function heights(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(ChartCard))
      .map((element) => (element.componentInstance as ChartCard).height());
  }

  function rowLabels(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('tbody th')).map((cell) => cell.textContent.trim());
  }

  function show(data: TeamTabResponse): void {
    fixture.componentInstance.entry.update((current) => ({ ...current, data }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('draws the three cards, none of them wide', () => {
    show(response());
    expect(cards().map((element) => element.getAttribute('data-state'))).toEqual([
      'ready',
      'ready',
      'ready',
    ]);
    expect(cards().some((element) => element.hasAttribute('data-wide'))).toBe(false);
  });

  it('reads the tables in the order of the charts, a barber with no value last', () => {
    show(response());
    expect(rowLabels(card(0))).toEqual(['Παύλος Χ.', 'Γιάννης Ρ.', 'Αλέξανδρος Σ.']);
    expect(rowLabels(card(1))).toEqual(['Αλέξανδρος Σ.', 'Παύλος Χ.', 'Γιάννης Ρ.']);
    expect(rowLabels(card(2))).toEqual(['Παύλος Χ.', 'Γιάννης Ρ.', 'Αλέξανδρος Σ.']);
  });

  it('shows a missing utilization as no value in the table', () => {
    show(response());
    const last = card(1).querySelector('tbody tr:last-child td');
    expect(last?.textContent.trim()).toBe('—');
  });

  it('sizes each chart by its own bars, so a phone stack adds no height', () => {
    const team = response();
    const five = [...BARBERS, { label: 'Νίκος Β.' }, { label: 'Μάρκος Π.' }];
    show({
      ...team,
      appointmentsPerStaff: categorySet(five, {
        completed: [71, 25, 89, 40, 12],
        cancelled: [2, 4, 7, 1, 0],
      }),
    });
    const [appointments, utilization, rating] = heights();
    expect([appointments, utilization, rating]).toEqual(['10.75rem', '8rem', '8rem']);
  });

  it('draws a bar per active barber in each skeleton, and the status legend', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'bars-horizontal', count: 5, height: '10.75rem', legend: 5 },
      { kind: 'bars-horizontal', count: 5, height: '10.75rem', legend: 0 },
      { kind: 'bars-horizontal', count: 5, height: '10.75rem', legend: 0 },
    ]);
  });

  it('shows the empty message when no barber has a value', () => {
    show(response([]));
    expect(cards().map((element) => element.getAttribute('data-state'))).toEqual([
      'empty',
      'empty',
      'empty',
    ]);
  });
});

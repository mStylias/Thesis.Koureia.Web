import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { LostBusinessTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { categorySet, TEST_PERIOD, timeSet } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
} from '../testing/dashboard.testing';
import { LostTab } from './lost-tab';

@Component({
  imports: [LostTab],
  template: `<lib-lost-tab [entry]="entry()" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<LostBusinessTabResponse>>({
    key: 'k',
    data: null,
    loading: false,
    failed: false,
  });
}

function response(cancelledBy: readonly (number | null)[]): LostBusinessTabResponse {
  return {
    period: TEST_PERIOD,
    statusMix: categorySet(
      ['completed', 'confirmed', 'pending', 'cancelled', 'no_show'].map((key) => ({ key })),
      { appointments: [264, 6, 0, 17, 12] },
    ),
    lostRateOverTime: timeSet(
      [
        ['2026-07-07', '2026-07-12'],
        ['2026-07-13', '2026-07-19'],
      ],
      { cancellationRate: [8.7, null], noShowRate: [0, 4.17] },
      'Percent',
    ),
    cancelledBy: categorySet([{ key: 'customer' }, { key: 'shop' }], {
      appointments: cancelledBy,
    }),
  };
}

describe('LostTab', () => {
  let fixture: ComponentFixture<Host>;

  function cards(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('lib-chart-card'));
  }

  function heights(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(ChartCard))
      .map((element) => (element.componentInstance as ChartCard).height());
  }

  function show(data: LostBusinessTabResponse): void {
    fixture.componentInstance.entry.update((current) => ({ ...current, data }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('puts the wide rate chart first, so the two donuts share a row', () => {
    show(response([6, 11]));
    expect(cards().map((card) => card.hasAttribute('data-wide'))).toEqual([true, false, false]);
    expect(cards().map((card) => card.getAttribute('data-state'))).toEqual([
      'ready',
      'ready',
      'ready',
    ]);
  });

  it('keeps the chart height of the status donut: the note beside it adds nothing on a phone', () => {
    show(response([6, 11]));
    const [, statusMix, cancelledBy] = heights();
    expect([statusMix, cancelledBy]).toEqual(['12rem', '12rem']);
  });

  it('draws the line and the two rings before the first response, with their legends', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'line', count: undefined, height: '12.5rem', legend: 2 },
      { kind: 'donut', count: undefined, height: '12rem', legend: 5 },
      { kind: 'donut', count: undefined, height: '12rem', legend: 2 },
    ]);
  });

  it('reads a bucket with nothing resolved as a dash in the hidden table', () => {
    show(response([6, 11]));
    const cells = Array.from(cards()[0]?.querySelectorAll('tbody tr:last-child td') ?? []).map(
      (cell) => cell.textContent.trim(),
    );
    expect(cells[0]).toBe('—');
  });

  it('notes that customers cannot cancel yet, and shows the empty message with no cancellation', () => {
    show(response([0, 0]));
    const cancelled = cards()[2];
    expect(cancelled.querySelector('.chart-card-note')?.textContent.trim()).toBe(
      'Οι πελάτες δεν μπορούν ακόμη να ακυρώσουν μόνοι τους.',
    );
    expect(cancelled.getAttribute('data-state')).toBe('empty');
  });
});

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { DemandTabResponse, SeriesSetViewDto } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { axisItem, categorySet, TEST_PERIOD, timeSet } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
} from '../testing/dashboard.testing';
import { DemandTab } from './demand-tab';

@Component({
  imports: [DemandTab],
  template: `<lib-demand-tab [entry]="entry()" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<DemandTabResponse>>({
    key: 'k',
    data: null,
    loading: false,
    failed: false,
  });
}

const LEAD_TIME: SeriesSetViewDto = {
  axis: {
    kind: 'Range',
    granularity: null,
    items: [axisItem({ key: '0', from: 0, to: 0 }), axisItem({ key: '1', from: 1, to: 1 })],
  },
  series: [
    { key: 'online', unit: 'Count', values: [34, 30] },
    { key: 'staff', unit: 'Count', values: [39, 16] },
  ],
};

function response(upcoming: readonly (number | null)[]): DemandTabResponse {
  return {
    period: TEST_PERIOD,
    appointmentsByStatus: timeSet(
      [['2026-07-07', '2026-07-12']],
      { completed: [21], cancelled: [2] },
      'Count',
    ),
    upcomingLoad: timeSet(
      [
        ['2026-10-04', '2026-10-04'],
        ['2026-10-05', '2026-10-05'],
      ],
      { appointments: upcoming, bookedMinutes: upcoming.map((value) => value && value * 30) },
      'Count',
      'Day',
    ),
    busiestHours: categorySet([{ key: '9' }, { key: '10' }], { appointments: [14, 31] }),
    busyHeatmap: categorySet([{ key: '9' }, { key: '10' }], { '1': [0, 2], '6': [3, 11] }),
    bookingLeadTime: LEAD_TIME,
    bookingSource: categorySet([{ key: 'online' }, { key: 'staff' }], {
      appointments: [192, 90],
    }),
  };
}

describe('DemandTab', () => {
  let fixture: ComponentFixture<Host>;

  function cards(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('lib-chart-card'));
  }

  function texts(card: HTMLElement | undefined, selector: string): (string | undefined)[] {
    return Array.from(card?.querySelectorAll(selector) ?? []).map((cell) =>
      cell.textContent.trim(),
    );
  }

  function heights(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(ChartCard))
      .map((element) => (element.componentInstance as ChartCard).height());
  }

  function show(data: DemandTabResponse): void {
    fixture.componentInstance.entry.update((current) => ({ ...current, data }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  function headings(): (string | undefined)[] {
    return cards().map((card) => card.querySelector('h2')?.textContent.trim());
  }

  function leadTime(rows: number): SeriesSetViewDto {
    const items = Array.from({ length: rows }, (_, day) =>
      axisItem({ key: String(day), from: day, to: day }),
    );
    return {
      axis: { kind: 'Range', granularity: null, items },
      series: [{ key: 'online', unit: 'Count', values: items.map(() => 3) }],
    };
  }

  it('draws the six charts as three rows of two half-width cards', () => {
    show(response([0, 4]));
    expect(cards().map((card) => card.getAttribute('data-state'))).toEqual([
      'ready',
      'ready',
      'ready',
      'ready',
      'ready',
      'ready',
    ]);
    expect(headings()).toEqual([
      'Ραντεβού ανά κατάσταση',
      'Προέλευση κρατήσεων',
      'Επόμενες 14 ημέρες',
      'Ώρες αιχμής',
      'Φόρτος ανά ημέρα και ώρα',
      'Πόσο νωρίς κλείνονται τα ραντεβού',
    ]);
    expect(cards().some((card) => card.hasAttribute('data-wide'))).toBe(false);
  });

  it('gives the two charts of each row one height, the heatmap row the taller need', () => {
    show(response([0, 4]));
    expect(heights()).toEqual(['12rem', '12rem', '12rem', '12rem', '14.75rem', '14.75rem']);
  });

  it('gives the heatmap the height of the lead time bars when they need more', () => {
    show({ ...response([0, 4]), bookingLeadTime: leadTime(9) });
    expect(heights().slice(4)).toEqual(['17.75rem', '17.75rem']);
  });

  it('draws the shape of each chart before the first response', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'bars', count: 12, height: '12rem', legend: 5 },
      { kind: 'donut', count: undefined, height: '12rem', legend: 2 },
      { kind: 'bars', count: 14, height: '12rem', legend: 0 },
      { kind: 'bars', count: 12, height: '12rem', legend: 0 },
      { kind: 'heatmap', count: 7, height: '14.75rem', legend: 0 },
      { kind: 'bars-horizontal', count: 7, height: '14.75rem', legend: 2 },
    ]);
  });

  it('keeps the height of every skeleton when the seven lead time ranges arrive', () => {
    const skeleton = cardSkeletons(fixture).map((card) => card.height);
    show({ ...response([0, 4]), bookingLeadTime: leadTime(7) });
    expect(heights()).toEqual(skeleton);
  });

  it('says that the next 14 days do not follow the filters', () => {
    show(response([0, 4]));
    expect(cards()[2]?.querySelector('.chart-card-note')?.textContent?.trim()).toBe(
      'Δεν ακολουθεί το διάστημα των φίλτρων.',
    );
  });

  it('reads the hours as times in the hidden table', () => {
    show(response([0, 4]));
    expect(texts(cards()[3], 'tbody th')).toEqual(['09:00', '10:00']);
  });

  it('reads the heatmap table by hour, one column per weekday', () => {
    show(response([0, 4]));
    const heatmap = cards()[4];
    expect(texts(heatmap, 'thead th')).toEqual(['Δευ', 'Σάβ']);
    expect(texts(heatmap, 'tbody th')).toEqual(['09:00', '10:00']);
    expect(texts(heatmap, 'tbody tr:last-child td')).toEqual(['2', '11']);
  });

  it('shows the empty message when no day of the next 14 has a booking', () => {
    show(response([0, null]));
    expect(cards()[2]?.getAttribute('data-state')).toBe('empty');
    expect(cards()[0]?.getAttribute('data-state')).toBe('ready');
  });
});

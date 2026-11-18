import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ServicesTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { categorySet, TEST_PERIOD } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
} from '../testing/dashboard.testing';
import { ServicesTab } from './services-tab';

@Component({
  imports: [ServicesTab],
  template: `<lib-services-tab [entry]="entry()" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<ServicesTabResponse>>({
    key: 'k',
    data: null,
    loading: false,
    failed: false,
  });
}

const ITEMS = [
  { key: 'cut', label: 'Κουρέματα' },
  { key: 'classic', label: 'Κλασικό', parentKey: 'cut' },
  { key: 'fade', label: 'Fade', parentKey: 'cut' },
  { key: 'uncategorized' },
  { key: 'kids', label: 'Παιδικό', parentKey: 'uncategorized' },
];

function response(bookings: readonly number[], revenue: readonly number[]): ServicesTabResponse {
  return {
    period: TEST_PERIOD,
    bookingsPerService: categorySet(ITEMS, { bookings }),
    revenuePerService: categorySet(ITEMS, { revenue }, { revenue: 'Money' }),
  };
}

describe('ServicesTab', () => {
  let fixture: ComponentFixture<Host>;

  function cards(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('lib-chart-card'));
  }

  function card(index: number): HTMLElement {
    const element = cards().at(index);
    if (!element) throw new Error(`card ${String(index)} not rendered`);
    return element;
  }

  function rowLabels(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('tbody th')).map((cell) => cell.textContent.trim());
  }

  function show(data: ServicesTabResponse): void {
    fixture.componentInstance.entry.update((current) => ({ ...current, data }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('reads the bookings table as the chart: services only, most booked first, with the category', () => {
    show(response([60, 22, 38, 18, 18], [1200, 440, 760, 225, 225]));
    expect(card(0).getAttribute('data-state')).toBe('ready');
    expect(rowLabels(card(0))).toEqual([
      'Fade (Κουρέματα)',
      'Κλασικό (Κουρέματα)',
      'Παιδικό (Χωρίς κατηγορία)',
    ]);
  });

  it('reads the treemap table as the tree: each category before its services', () => {
    show(response([60, 22, 38, 18, 18], [1200, 440, 760, 225, 225]));
    expect(rowLabels(card(1))).toEqual([
      'Κουρέματα',
      'Κλασικό (Κουρέματα)',
      'Fade (Κουρέματα)',
      'Χωρίς κατηγορία',
      'Παιδικό (Χωρίς κατηγορία)',
    ]);
  });

  it('gives both charts one height and adds no line for the legend of the bars', async () => {
    show(response([60, 22, 38, 18, 18], [1200, 440, 760, 225, 225]));
    // The charts wait for the viewport in a defer block.
    await fixture.whenStable();
    fixture.detectChanges();
    const heights = cards().map(
      (element) => element.querySelector<HTMLElement>('lib-chart')?.style.height,
    );
    expect(heights).toEqual(['12.5rem', '12.5rem']);
  });

  it('draws the service bars and the treemap blocks before the first response, at one height', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'bars-horizontal', count: 6, height: '12.5rem', legend: 3 },
      { kind: 'treemap', count: undefined, height: '12.5rem', legend: 0 },
    ]);
  });

  it('shows the empty message when nothing was booked', () => {
    show(response([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]));
    expect(cards().map((element) => element.getAttribute('data-state'))).toEqual([
      'empty',
      'empty',
    ]);
  });
});

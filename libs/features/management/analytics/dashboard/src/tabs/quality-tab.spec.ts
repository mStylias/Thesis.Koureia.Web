import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { QualityTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { categorySet, TEST_PERIOD, timeSet } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
} from '../testing/dashboard.testing';
import { QualityTab } from './quality-tab';

@Component({
  imports: [QualityTab],
  template: `<lib-quality-tab [entry]="entry()" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<QualityTabResponse>>({
    key: 'k',
    data: null,
    loading: false,
    failed: false,
  });
}

function response(reviews: readonly number[]): QualityTabResponse {
  return {
    period: TEST_PERIOD,
    ratingOverTime: timeSet(
      [['2026-07-07', '2026-07-12']],
      { averageRating: [reviews.some((count) => count > 0) ? 4.6 : null], reviews: [0] },
      'Count',
    ),
    ratingDistribution: categorySet(
      ['1', '2', '3', '4', '5'].map((key) => ({ key })),
      { reviews },
    ),
  };
}

describe('QualityTab', () => {
  let fixture: ComponentFixture<Host>;

  function cards(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('lib-chart-card'));
  }

  function card(index: number): HTMLElement {
    const element = cards().at(index);
    if (!element) throw new Error(`card ${String(index)} not rendered`);
    return element;
  }

  function show(data: QualityTabResponse): void {
    fixture.componentInstance.entry.update((current) => ({ ...current, data }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('reads the hidden table of the distribution as the chart: 5 stars first', () => {
    show(response([5, 2, 5, 23, 67]));
    const distribution = card(1);
    expect(distribution.getAttribute('data-state')).toBe('ready');
    const rows = Array.from(distribution.querySelectorAll('tbody th')).map((cell) =>
      cell.textContent.trim(),
    );
    expect(rows).toEqual(['5 ★', '4 ★', '3 ★', '2 ★', '1 ★']);
    expect(distribution.querySelector('tbody td')?.textContent.trim()).toBe('67');
  });

  it('draws the line and the five star bars before the first response', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'line', count: undefined, height: '12.5rem', legend: 2 },
      { kind: 'bars', count: 5, height: '12rem', legend: 0 },
    ]);
  });

  it('spans both columns with the rating over time', () => {
    show(response([5, 2, 5, 23, 67]));
    expect(card(0).hasAttribute('data-wide')).toBe(true);
    expect(card(1).hasAttribute('data-wide')).toBe(false);
  });

  it('shows the empty message on both cards when there is no review', () => {
    show(response([0, 0, 0, 0, 0]));
    expect(cards().map((card) => card.getAttribute('data-state'))).toEqual(['empty', 'empty']);
  });
});

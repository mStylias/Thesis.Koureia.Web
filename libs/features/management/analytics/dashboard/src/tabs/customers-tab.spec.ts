import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CustomersTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { categorySet, plainText, TEST_PERIOD, timeSet } from '../testing/dashboard.fixtures';
import {
  cardSkeletons,
  provideDashboardTesting,
  setDashboardTranslations,
} from '../testing/dashboard.testing';
import { CustomersTab } from './customers-tab';

@Component({
  imports: [CustomersTab],
  template: `<lib-customers-tab [entry]="entry()" (retry)="retries = retries + 1" />`,
})
class Host {
  readonly entry = signal<DashboardEntry<CustomersTabResponse>>({
    key: 'k',
    data: null,
    loading: true,
    failed: false,
  });
  retries = 0;
}

function response(customers: number): CustomersTabResponse {
  const names = ['Κώστας Ιατρίδης', 'Χρήστος Οικονόμου', 'Δημήτρης Ευαγγέλου'];
  return {
    period: TEST_PERIOD,
    newVsReturning: timeSet([['2026-07-07', '2026-07-12']], { new: [1], returning: [19] }, 'Count'),
    daysBetweenVisits: categorySet([{ key: '1-14' }], { visits: [62] }),
    topCustomers: categorySet(
      names.slice(0, customers).map((label, index) => ({ key: `c${index}`, label })),
      {
        spend: [142.5, 135, 131].slice(0, customers),
        visits: [6, 7, 6].slice(0, customers),
      },
      { spend: 'Money' },
    ),
  };
}

describe('CustomersTab', () => {
  let fixture: ComponentFixture<Host>;

  function cards(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('lib-chart-card'));
  }

  function topCard(): HTMLElement {
    const card = cards().at(2);
    if (!card) throw new Error('top customers card not rendered');
    return card;
  }

  function heights(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(ChartCard))
      .map((element) => (element.componentInstance as ChartCard).height());
  }

  function show(entry: Partial<DashboardEntry<CustomersTabResponse>>): void {
    fixture.componentInstance.entry.update((current) => ({ ...current, ...entry }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('shows a skeleton card per chart before the first response', () => {
    expect(cards().map((card) => card.getAttribute('data-state'))).toEqual([
      'skeleton',
      'skeleton',
      'skeleton',
    ]);
    expect(cards()[0]?.hasAttribute('data-wide')).toBe(false);
  });

  it('draws the bars and the ten rows of the table before the first response', () => {
    expect(cardSkeletons(fixture)).toEqual([
      { kind: 'bars', count: 12, height: '12rem', legend: 2 },
      { kind: 'bars', count: 6, height: '12rem', legend: 0 },
      { kind: 'table', count: 10, height: '', legend: 0 },
    ]);
  });

  it('gives the loaded table the row height of its skeleton, so the card keeps its height', () => {
    const skeleton = readFileSync(join(process.cwd(), 'src/charts/chart-card.scss'), 'utf8');
    expect(skeleton).toContain('--chart-table-row: var(--space-8);');
    expect(skeleton).toMatch(/\.chart-card-table \{[^}]*tr \{\s*height: var\(--chart-table-row\);/);
    const table = readFileSync(join(process.cwd(), 'src/tabs/customers-tab.scss'), 'utf8');
    expect(table).toMatch(/\.top-customers \{[^}]*tr \{\s*height: var\(--space-8\);/);
    for (const styles of [skeleton, table]) {
      expect(styles).toContain('border-collapse: collapse;');
      expect(styles).toContain('padding: 0 var(--space-3);');
    }
  });

  it('puts the two charts side by side and the table across both columns', () => {
    show({ data: response(3), loading: false });
    expect(cards().map((card) => card.hasAttribute('data-wide'))).toEqual([false, false, true]);
  });

  it('gives the two charts of the row one height, the height of their skeletons', () => {
    const skeleton = cardSkeletons(fixture).map((card) => card.height);
    show({ data: response(3), loading: false });
    const [newVsReturning, daysBetweenVisits] = heights();
    expect([newVsReturning, daysBetweenVisits]).toEqual(['12rem', '12rem']);
    expect(heights().slice(0, 2)).toEqual(skeleton.slice(0, 2));
  });

  it('keeps the table inside its card on a phone', () => {
    // Vitest builds the component without its styles, so the guard reads the stylesheet.
    const styles = readFileSync(join(process.cwd(), 'src/tabs/customers-tab.scss'), 'utf8');
    const name = styles.slice(styles.indexOf('tbody th {'));
    expect(name.slice(0, name.indexOf('}'))).toContain('overflow-wrap: anywhere');
    const phone = styles.slice(styles.indexOf('@include a.respond-down(sm)'));
    expect(phone).toMatch(/\.is-rank \{\s*display: none;/);
    // The rank header hides with its column.
    show({ data: response(3), loading: false });
    expect(topCard().querySelector('thead th')?.classList.contains('is-rank')).toBe(true);
  });

  it('lists the top customers as a table with rank, name, visits and spend', () => {
    show({ data: response(3), loading: false });
    expect(topCard().getAttribute('data-state')).toBe('ready');
    expect(topCard().querySelector('lib-chart')).toBeNull();
    // The visible table is the only one: the card's hidden table would repeat it.
    expect(topCard().querySelector('lib-series-table')).toBeNull();

    const table = topCard().querySelector('table.top-customers');
    expect(table?.getAttribute('aria-label')).toBe('Κορυφαίοι πελάτες');
    const head = Array.from(table?.querySelectorAll('thead th') ?? []).map((cell) =>
      cell.textContent.trim(),
    );
    expect(head).toEqual(['Θέση', 'Πελάτης', 'Επισκέψεις', 'Δαπάνη']);
    const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []).map((row) =>
      Array.from(row.children).map((cell) => plainText(cell.textContent).trim()),
    );
    expect(rows).toEqual([
      ['1', 'Κώστας Ιατρίδης', '6', '142,50 €'],
      ['2', 'Χρήστος Οικονόμου', '7', '135 €'],
      ['3', 'Δημήτρης Ευαγγέλου', '6', '131 €'],
    ]);
  });

  it('shows the empty message when no customer visited', () => {
    show({ data: response(0), loading: false });
    expect(topCard().getAttribute('data-state')).toBe('empty');
    expect(topCard().querySelector('table')).toBeNull();
  });

  it('offers a retry on every card when the read failed', () => {
    show({ loading: false, failed: true });
    const button = topCard().querySelector<HTMLButtonElement>('.chart-card-message button');
    button?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});

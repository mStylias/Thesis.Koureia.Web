import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { categorySet, plainText, testContext } from '../testing/dashboard.fixtures';
import { provideDashboardTesting } from '../testing/dashboard.testing';
import { SeriesTable } from './series-table';

@Component({
  imports: [SeriesTable],
  template: `<lib-series-table [set]="set()" caption="Έσοδα ανά κουρέα" [context]="ctx" />`,
})
class Host {
  readonly ctx = testContext();
  readonly set = signal(
    categorySet(
      [
        { key: 'a', label: 'Αλέξανδρος Σ.' },
        { key: 'b', label: 'Νίκος Β.' },
      ],
      { revenue: [1848, null], completedAppointments: [89, 0] },
      { revenue: 'Money' },
    ),
  );
}

describe('SeriesTable', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function texts(root: HTMLElement, selector: string): string[] {
    return [...root.querySelectorAll(selector)].map((cell) => plainText(cell.textContent).trim());
  }

  it('has one row per axis item and one column per series, with the values formatted', () => {
    const root = render();
    expect(texts(root, 'caption')).toEqual(['Έσοδα ανά κουρέα']);
    expect(texts(root, 'thead th')).toEqual(['Έσοδα', 'Ολοκληρωμένα ραντεβού']);
    expect(texts(root, 'tbody th')).toEqual(['Αλέξανδρος Σ.', 'Νίκος Β.']);
    expect(texts(root, 'tbody td')).toEqual(['1.848 €', '89', '—', '0']);
  });

  it('names the row and column headers for a screen reader', () => {
    const root = render();
    expect(root.querySelector('thead th')?.getAttribute('scope')).toBe('col');
    expect(root.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
  });
});

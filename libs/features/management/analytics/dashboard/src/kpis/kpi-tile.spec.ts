import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { KpiViewDto } from '@api/analytics';
import { Tooltip } from '@ui/tooltip';

import type { KpiId } from '../analytics.format.types';
import { plainText, testContext, timeSet } from '../testing/dashboard.fixtures';
import { provideDashboardTesting, setDashboardTranslations } from '../testing/dashboard.testing';
import { KpiTile } from './kpi-tile';

@Component({
  imports: [KpiTile],
  template: `<lib-kpi-tile [id]="id()" [kpi]="kpi()" [context]="ctx" [failed]="failed()" />`,
})
class Host {
  readonly ctx = testContext();
  readonly id = signal<KpiId>('revenue');
  readonly kpi = signal<KpiViewDto | null>(null);
  readonly failed = signal(false);
}

const TREND = timeSet([['2026-09-01', '2026-09-07']], { value: [1] });

function kpi(
  unit: KpiViewDto['unit'],
  value: number | null,
  previous: number | null,
  change: number | null,
): KpiViewDto {
  return { unit, value, previousValue: previous, change, trend: TREND };
}

describe('KpiTile', () => {
  let fixture: ComponentFixture<Host>;

  function tile(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function show(id: KpiId, value: KpiViewDto | null): void {
    fixture.componentInstance.id.set(id);
    fixture.componentInstance.kpi.set(value);
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return (tile().querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('shows the change as a whole percent with an up arrow, in the good tone', () => {
    show('revenue', kpi('Money', 4853, 4712.5, 0.1234));
    expect(plainText(text('.stat-value'))).toBe('4.853 €');
    const change = tile().querySelector('.kpi-change');
    expect(change?.getAttribute('data-tone')).toBe('good');
    expect(change?.querySelector('svg[lucideArrowUp]')).not.toBeNull();
    expect(text('.kpi-change')).toBe('Αύξηση +12%');
  });

  it('shows a fall with a down arrow', () => {
    show('appointments', kpi('Count', 80, 100, -0.2));
    expect(tile().querySelector('.kpi-change svg[lucideArrowDown]')).not.toBeNull();
    expect(tile().querySelector('.kpi-change')?.getAttribute('data-tone')).toBe('bad');
  });

  it('shows the lost rate in points, and a rise in it is bad', () => {
    show('lostRate', kpi('Percent', 9.9, 8.7, 0.1379));
    expect(text('.kpi-change')).toBe('Αύξηση +1,2 μ.');
    expect(tile().querySelector('.kpi-change')?.getAttribute('data-tone')).toBe('bad');
  });

  it('shows a dash for a null value and a null change', () => {
    show('averageRating', kpi('Rating', null, null, null));
    expect(text('.stat-value')).toBe('—');
    expect(text('.kpi-change')).toBe('Χωρίς σύγκριση —');
    expect(tile().querySelector('.kpi-change svg')).toBeNull();
  });

  it('gives the previous value with the comparison dates', () => {
    show('revenue', kpi('Money', 4853, 4712.5, 0.0298));
    const hidden = [...tile().querySelectorAll('.kpi-hidden')].map((node) =>
      plainText(node.textContent).trim(),
    );
    expect(hidden).toContain('Προηγούμενη περίοδος (8 Απρ – 6 Ιουλ 2026): 4.712,50 €');
  });

  it('lets the keyboard reach the comparison tooltip', () => {
    const box = (): HTMLElement | null => tile().querySelector('.kpi-tile');
    expect(box()?.hasAttribute('tabindex')).toBe(false);

    show('revenue', kpi('Money', 4853, 4712.5, 0.0298));
    expect(box()?.getAttribute('tabindex')).toBe('0');
    expect(box()?.getAttribute('role')).toBe('group');
    expect(box()?.getAttribute('aria-label')).toBe('Έσοδα');
    const content = getDebugNode(box())?.injector.get(Tooltip).libTooltip();
    expect(plainText(typeof content === 'string' ? content : '')).toBe(
      'Προηγούμενη περίοδος (8 Απρ – 6 Ιουλ 2026): 4.712,50 €',
    );
  });

  it('shows a skeleton until the overview lands, and a dash when it failed', () => {
    expect(tile().querySelector('.kpi-value-stub')).not.toBeNull();
    fixture.componentInstance.failed.set(true);
    fixture.detectChanges();
    expect(tile().querySelector('.kpi-stub')).toBeNull();
    expect(tile().querySelector('lib-chart-skeleton')).toBeNull();
    expect(text('.stat-value')).toBe('—');
  });

  it('puts the label first, and the change before the sparkline in the last row', () => {
    show('revenue', kpi('Money', 4853, 4712.5, 0.1234));
    expect(tile().querySelector('lib-stat')?.getAttribute('data-label-first')).toBe('');
    expect(text('.stat-label')).toBe('Έσοδα');
    const foot = [...(tile().querySelector('.kpi-tile > .kpi-foot')?.children ?? [])].filter(
      (node) => !node.classList.contains('kpi-hidden'),
    );
    expect(foot.map((node) => node.className.split(' ')[0])).toEqual([
      'kpi-change',
      'kpi-sparkline',
    ]);
    expect(tile().querySelector('lib-stat .kpi-change')).toBeNull();
  });

  it('shows the real label at once, with stubs for the value, the change and the trend', () => {
    show('lostRate', null);
    expect(text('.stat-label')).toBe('Χαμένα ραντεβού');
    const value = tile().querySelector('.stat-value');
    expect(value?.textContent.trim()).toBe('');
    expect(value?.querySelector('.kpi-value-stub')?.getAttribute('data-kpi')).toBe('lostRate');
    expect(tile().querySelector('.kpi-foot > .kpi-change-stub:first-child')).not.toBeNull();
    expect(tile().querySelector('lib-chart-skeleton')?.getAttribute('data-kind')).toBe('sparkline');
    for (const stub of tile().querySelectorAll('.kpi-stub')) {
      expect(stub.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('keeps the shape of the tile from the skeleton to the loaded tile', () => {
    // Each part of the tile: where it sits, and the height it is given.
    const shape = (): string[] =>
      [...tile().querySelectorAll('.kpi-tile > *, .stat-value > *, .kpi-foot > *')]
        .filter((node) => !node.classList.contains('kpi-hidden'))
        .map((node) => {
          const slot = node.parentElement?.className ?? '';
          const height = node instanceof HTMLElement ? node.style.height : '';
          // The stub and the change share their width rule, which the styles spec checks.
          const change = node.matches('.kpi-change, .kpi-change-stub') ? '.change' : '';
          return `${slot} > ${node.tagName.toLowerCase()}${change} ${height}`;
        })
        .map((part) => part.replace('lib-chart-skeleton', 'lib-chart'))
        .map((part) => part.replace(/stat-value > span $/, 'stat-value > value'));

    show('revenue', null);
    const skeleton = shape();
    show('revenue', kpi('Money', 4853, 4712.5, 0.1234));
    const loaded = shape();

    expect(skeleton).toEqual([
      'kpi-tile > lib-stat ',
      'stat-value > value',
      'kpi-tile > div ',
      'kpi-foot > span.change ',
      'kpi-foot > lib-chart var(--kpi-sparkline-height)',
    ]);
    // The loaded value is text, not an element, so the value slot holds nothing.
    expect(loaded).toEqual([
      'kpi-tile > lib-stat ',
      'kpi-tile > div ',
      'kpi-foot > span.change ',
      'kpi-foot > lib-chart var(--kpi-sparkline-height)',
    ]);
    expect(text('.stat-value')).not.toBe('');
  });
});

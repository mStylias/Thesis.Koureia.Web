import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SeriesSetViewDto } from '@api/analytics';
import { Chart, type ChartOption, ChartSkeleton } from '@ui/chart';

import { categorySet, testContext } from '../testing/dashboard.fixtures';
import { provideDashboardTesting, setDashboardTranslations } from '../testing/dashboard.testing';
import { ChartCard } from './chart-card';
import type { ChartCardSkeleton } from './chart-card.types';
import { chartLegend, tooltipHtml } from './options/chart-base';

@Component({
  imports: [ChartCard],
  template: `
    <lib-chart-card
      heading="Έσοδα"
      [note]="note()"
      [wide]="wide()"
      [skeleton]="skeleton()"
      [height]="height()"
      [set]="set()"
      [option]="option()"
      [context]="ctx"
      [loading]="loading()"
      [failed]="failed()"
      (retry)="retries = retries + 1"
    />
  `,
})
class Host {
  readonly ctx = testContext();
  readonly note = signal('');
  readonly wide = signal(false);
  readonly skeleton = signal<ChartCardSkeleton>({ kind: 'bars' });
  readonly height = signal('12rem');
  readonly set = signal<SeriesSetViewDto | null>(null);
  readonly option = signal<ChartOption | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  retries = 0;
}

@Component({
  imports: [ChartCard],
  template: `
    <lib-chart-card heading="Έσοδα" [failed]="failed()" />
    <lib-chart-card heading="Ραντεβού" [failed]="failed()" />
  `,
})
class PairHost {
  readonly failed = signal(false);
}

// Vitest builds the component without its styles, so the guards read the stylesheet.
const STYLES = readFileSync(join(process.cwd(), 'src/charts/chart-card.scss'), 'utf8');
const GRID = readFileSync(join(process.cwd(), 'src/charts/chart-grid.scss'), 'utf8');

/** The declarations of the first rule that starts with `selector`. */
function rule(selector: string): string {
  const start = STYLES.indexOf(`
${selector} {`);
  if (start < 0) throw new Error(`${selector} not styled`);
  return STYLES.slice(start, STYLES.indexOf('}', start));
}

const DATA = categorySet([{ key: 'a', label: 'A' }], { revenue: [10] }, { revenue: 'Money' });

describe('ChartCard', () => {
  let fixture: ComponentFixture<Host>;

  function card(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-chart-card');
    if (!element) throw new Error('lib-chart-card not rendered');
    return element as HTMLElement;
  }

  // A chart waits for the viewport in a defer block, so a render settles before it reads.
  async function render(
    state: Partial<Record<'set' | 'option' | 'loading' | 'failed', unknown>>,
  ): Promise<void> {
    const host = fixture.componentInstance;
    if ('set' in state) host.set.set(state.set as SeriesSetViewDto | null);
    if ('option' in state) host.option.set(state.option as ChartOption | null);
    if ('loading' in state) host.loading.set(state.loading as boolean);
    if ('failed' in state) host.failed.set(state.failed as boolean);
    // The viewport trigger fires after the first render, and the chart renders one pass later.
    for (let pass = 0; pass < 2; pass++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDashboardTesting() });
    setDashboardTranslations();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('shows a skeleton before the first response', async () => {
    await render({ loading: true });
    expect(card().getAttribute('data-state')).toBe('skeleton');
    expect(card().querySelector('.chart-card-skeleton')).not.toBeNull();
    expect(card().querySelector('article')?.getAttribute('aria-busy')).toBe('true');
  });

  it('draws the skeleton of the given kind and count at the chart height', async () => {
    fixture.componentInstance.skeleton.set({ kind: 'bars-horizontal', count: 4 });
    fixture.componentInstance.height.set('9rem');
    await render({ loading: true });
    const element = fixture.debugElement.query(By.directive(ChartSkeleton));
    const skeleton = element.componentInstance as ChartSkeleton;
    expect([skeleton.kind(), skeleton.count()]).toEqual(['bars-horizontal', 4]);
    expect((element.nativeElement as HTMLElement).style.height).toBe('9rem');
    expect(card().querySelector('.chart-card-table')).toBeNull();

    await render({ set: DATA, option: { series: [] }, loading: false });
    expect(card().querySelector('.chart-card-skeleton')).toBeNull();
    // The same skeleton covers the chart until its first draw.
    expect(card().querySelector('.chart-card-cover')?.getAttribute('data-kind')).toBe(
      'bars-horizontal',
    );
    expect(card().querySelector<HTMLElement>('lib-chart')?.style.height).toBe('9rem');
  });

  it('draws a legend stub per legend entry under the heading, hidden from screen readers', async () => {
    fixture.componentInstance.skeleton.set({ kind: 'line', legend: 3 });
    await render({ loading: true });
    const stubs = card().querySelector('.chart-card-head .chart-legend.is-skeleton');
    expect(stubs?.getAttribute('aria-hidden')).toBe('true');
    expect(stubs?.querySelectorAll('.chart-legend-item')).toHaveLength(3);
    expect(stubs?.querySelector('button')).toBeNull();
  });

  it('draws no legend stub for a chart with one legend entry, as the chart draws no legend', async () => {
    fixture.componentInstance.skeleton.set({ kind: 'donut', legend: 1 });
    await render({ loading: true });
    expect(card().querySelector('.chart-legend')).toBeNull();
  });

  it('puts the loaded legend where its stubs were', async () => {
    fixture.componentInstance.skeleton.set({ kind: 'line', legend: 2 });
    await render({ loading: true });
    const legend = chartLegend([
      { name: 'Έσοδα', color: 'swatch-1' },
      { name: 'Πέρσι', color: 'swatch-1', dashed: true },
    ]);
    await render({ set: DATA, option: { legend }, loading: false });
    expect(card().querySelector('.chart-legend.is-skeleton')).toBeNull();
    expect(card().querySelectorAll('.chart-card-head .chart-legend-item')).toHaveLength(2);
  });

  it('keeps the legend row when the data leaves one entry, so the header keeps its height', async () => {
    fixture.componentInstance.skeleton.set({ kind: 'donut', legend: 2 });
    await render({ loading: true });
    const legend = chartLegend([{ name: 'Κατάστημα', color: 'swatch-2' }]);
    await render({ set: DATA, option: { legend }, loading: false });
    const reserved = card().querySelector('.chart-card-head .chart-legend.is-reserved');
    expect(reserved?.getAttribute('aria-hidden')).toBe('true');
    expect(reserved?.children).toHaveLength(0);
    expect(card().querySelector('.chart-legend-item')).toBeNull();
  });

  it('draws a head row and the given rows for a table skeleton', async () => {
    fixture.componentInstance.skeleton.set({ kind: 'table', count: 10 });
    await render({ loading: true });
    expect(card().querySelector('lib-chart-skeleton')).toBeNull();
    const table = card().querySelector('.chart-card-table');
    expect(table?.getAttribute('aria-hidden')).toBe('true');
    expect(table?.querySelectorAll('tr')).toHaveLength(11);
  });

  it('keeps the card compact: tight padding, a sans heading at the body size, a caption note', () => {
    expect(rule('.chart-card-body')).toContain('--card-padding: var(--space-3) var(--space-4);');
    expect(rule('.chart-card-body')).toContain('--card-gap: var(--space-2);');
    expect(rule('.chart-card-title')).toMatch(
      /@include a\.t-title;[^}]*font-size: var\(--text-base\);/,
    );
    expect(rule('.chart-card-note')).toContain('@include a.t-caption;');
    expect(rule('.chart-legend-item')).toContain('font-size: var(--text-xs);');
    expect(GRID).toContain('gap: var(--space-3);');
  });

  it('gives the legend row, its buttons and its stubs one height of at least 24px', () => {
    expect(STYLES).toContain('--chart-legend-row: var(--space-6);');
    expect(rule('.chart-legend')).toContain('height: var(--chart-legend-row);');
    expect(rule('.chart-legend-item')).toContain('height: var(--chart-legend-row);');
    expect(rule('.chart-legend-item')).toContain('box-sizing: border-box;');
    // The stubs are items of a legend row, so the shared rules give the skeleton row its height.
    const skeleton = STYLES.slice(STYLES.indexOf('\n.is-skeleton .chart-legend-item {'));
    expect(skeleton.slice(0, skeleton.indexOf('// A fixed pattern'))).not.toMatch(
      /(^|[^-])height: (?!var\(--space-1\))/,
    );
  });

  it('puts the legend on its own row under the title and the note, never beside them', async () => {
    fixture.componentInstance.note.set('Μόνο τα ολοκληρωμένα.');
    fixture.componentInstance.skeleton.set({ kind: 'line', legend: 2 });
    const order = (): string[] =>
      [...(card().querySelector('.chart-card-head')?.children ?? [])].map(
        (child) => [...child.classList].find((name) => name.startsWith('chart-')) ?? '',
      );
    await render({ loading: true });
    expect(order()).toEqual(['chart-card-title', 'chart-card-note', 'chart-legend']);

    const legend = chartLegend([
      { name: 'Έσοδα', color: 'swatch-1' },
      { name: 'Πέρσι', color: 'swatch-1', dashed: true },
    ]);
    await render({ set: DATA, option: { legend }, loading: false });
    expect(order()).toEqual(['chart-card-title', 'chart-card-note', 'chart-legend']);
    expect(rule('.chart-card-head')).toMatch(/display: flex;\s*flex-direction: column;/);
    expect(rule('.chart-card-title')).not.toMatch(/display|min-height/);
  });

  it('keeps the legend on one line, which scrolls inside its row when it does not fit', () => {
    const row = rule('.chart-legend');
    expect(row).toContain('display: flex;');
    expect(STYLES).not.toContain('flex-wrap: wrap;');
    expect(row).toMatch(/overflow-x: auto;\s*overflow-y: hidden;/);
    // A scrollbar would make the row taller only when it overflows.
    expect(row).toContain('scrollbar-width: none;');
    expect(rule('.chart-legend-item')).toContain('flex: none;');
    expect(rule('.chart-legend-item')).toContain('white-space: nowrap;');
  });

  it('scrolls a focused legend button into view with room around it, and rings it inside', () => {
    expect(rule('.chart-legend')).toContain('scroll-padding-inline: var(--space-6);');
    // The row clips a ring outside the button.
    expect(STYLES).toMatch(/&:focus-visible \{\s*box-shadow: inset 0 0 0 2px var\(--focus-ring\);/);
    const forced = STYLES.slice(STYLES.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(
      /\.chart-legend-item:focus-visible \{\s*outline: 2px solid Highlight;\s*outline-offset: -2px;/,
    );
  });

  it('keeps the legend items compact: a short marker and tight gaps', () => {
    expect(rule('.chart-legend-item')).toMatch(
      /gap: var\(--space-1\);[^}]*padding: 0 var\(--space-1\);/,
    );
    expect(rule('.chart-legend-marker')).toContain('width: var(--space-4);');
    // The names line up with the title.
    expect(rule('.chart-legend')).toContain('margin-inline: calc(-1 * var(--space-1));');
  });

  it('shows the failure in an error banner', async () => {
    await render({ failed: true });
    const banner = card().querySelector('.chart-card-message lib-banner');
    expect(banner?.getAttribute('data-tone')).toBe('error');
    expect(banner?.textContent).toContain('Η φόρτωση απέτυχε.');
  });

  it('shows the empty message for a set of zeros', async () => {
    await render({ set: categorySet([{}], { revenue: [0] }), option: {} });
    expect(card().getAttribute('data-state')).toBe('empty');
    expect(card().textContent).toContain('Δεν υπάρχουν δεδομένα για αυτό το διάστημα.');
    expect(card().querySelector('lib-chart')).toBeNull();
  });

  it('offers a retry when the read failed', async () => {
    await render({ failed: true });
    const message = card().querySelector('.chart-card-message');
    expect(message?.textContent).toContain('Η φόρτωση απέτυχε.');
    message?.querySelector('button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('moves focus to the card when the retry removes its button', async () => {
    await render({ failed: true });
    const button = card().querySelector<HTMLButtonElement>('.chart-card-message button');
    button?.focus();
    button?.click();
    await render({ failed: false, loading: true });
    expect(card().querySelector('.chart-card-message')).toBeNull();
    expect(document.activeElement).toBe(card().querySelector('article'));
  });

  it('announces a failure from the first card of a grid only', async () => {
    const pair = TestBed.createComponent(PairHost);
    await pair.whenStable();
    pair.componentInstance.failed.set(true);
    await pair.whenStable();
    const root = pair.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role="alert"]')).toHaveLength(0);
    const live = [...root.querySelectorAll('.chart-card-live')].map((node) =>
      node.textContent.trim(),
    );
    expect(live).toEqual(['Η φόρτωση απέτυχε.', '']);
  });

  it('draws the chart and the hidden table once there is data', async () => {
    await render({ set: DATA, option: { series: [] } });
    expect(card().getAttribute('data-state')).toBe('ready');
    expect(card().querySelector('lib-chart')).not.toBeNull();
    expect(card().querySelector('lib-series-table table caption')?.textContent).toContain('Έσοδα');
  });

  it('dims the chart and shows a progress line while a new read runs', async () => {
    await render({ set: DATA, option: { series: [] }, loading: true });
    expect(card().querySelector('.chart-card-frame')?.classList).toContain('is-dim');
    expect(card().querySelector('lib-progress-bar')).not.toBeNull();
    expect(card().querySelector('lib-chart')).not.toBeNull();
  });

  it('dims the legend with the chart while a new read runs', async () => {
    const legend = chartLegend([
      { name: 'Έσοδα', color: 'swatch-1' },
      { name: 'Πέρσι', color: 'swatch-1', dashed: true },
    ]);
    await render({ set: DATA, option: { legend }, loading: true });
    expect(card().querySelector('.chart-legend')?.classList).toContain('is-dim');
    expect(rule('.chart-legend')).toContain('opacity: var(--chart-dim-opacity);');
    expect(rule('.chart-card-frame')).toContain('opacity: var(--chart-dim-opacity);');

    await render({ loading: false });
    expect(card().querySelector('.chart-legend')?.classList).not.toContain('is-dim');
  });

  it('rings a focused legend button under forced colors, where the shadow ring is gone', () => {
    const forced = STYLES.slice(STYLES.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(/\.chart-legend-item:focus-visible \{\s*outline: 2px solid Highlight;/);
  });

  it('spans both columns when wide', () => {
    fixture.componentInstance.wide.set(true);
    fixture.detectChanges();
    expect(card().hasAttribute('data-wide')).toBe(true);
  });

  it('turns a legend entry off with a pressed button, not with color alone', async () => {
    await render({
      set: DATA,
      option: {
        legend: chartLegend([
          { name: 'Έσοδα', color: 'swatch-1' },
          { name: 'Πέρσι', color: 'swatch-1', dashed: true },
        ]),
      },
    });
    const buttons = [...card().querySelectorAll<HTMLButtonElement>('.chart-legend-item')];
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'true']);

    buttons[1]?.click();
    fixture.detectChanges();
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1]?.textContent?.trim()).toBe('Πέρσι');
  });

  it('draws a dashed legend marker for a dashed series', async () => {
    await render({
      set: DATA,
      option: {
        legend: chartLegend([
          { name: 'Έσοδα', color: 'swatch-1' },
          { name: 'Πέρσι', color: 'swatch-1', dashed: true },
        ]),
      },
    });
    const dashes = [...card().querySelectorAll('.chart-legend-marker line')].map((line) =>
      line.getAttribute('stroke-dasharray'),
    );
    expect(dashes).toEqual([null, '4 2']);
  });

  it('draws the tooltip marker of each row as the legend marker of its series', async () => {
    const items = [
      { name: 'Έσοδα', color: 'swatch-1', value: '1' },
      { name: 'Πέρσι', color: 'swatch-1', value: '2', dashed: true },
    ];
    await render({ set: DATA, option: { legend: chartLegend(items) } });
    const tooltip = document.createElement('div');
    tooltip.innerHTML = tooltipHtml('Ιούλ', items);
    const legendMarkers = [...card().querySelectorAll('.chart-legend-marker')];
    const tooltipMarkers = [...tooltip.querySelectorAll('svg')];
    const shape = (svg: Element) => {
      const line = svg.querySelector('line');
      return [
        svg.getAttribute('viewBox'),
        ...['x1', 'y1', 'x2', 'y2', 'stroke-width', 'stroke-dasharray'].map(
          (name) => line?.getAttribute(name) ?? null,
        ),
      ];
    };
    expect(tooltipMarkers.map(shape)).toEqual(legendMarkers.map(shape));
    expect(tooltipMarkers.map(shape)[0]).not.toEqual(tooltipMarkers.map(shape)[1]);
    // The size of the legend marker is in the stylesheet.
    const legendSize = rule('.chart-legend-marker');
    for (const [property, value] of [
      ['width', 'var(--space-4)'],
      ['height', 'var(--space-1)'],
    ] as const) {
      expect(legendSize).toContain(`${property}: ${value};`);
      expect(tooltipMarkers[0]?.getAttribute('style')).toContain(`${property}:${value}`);
    }
  });

  it('passes the two row tracks of the grid to the header and the frame through subgrids', async () => {
    for (const selector of [':host', '.chart-card', '.chart-card-body']) {
      expect(rule(selector), selector).toMatch(
        /display: grid;\s*grid-row: span 2;\s*grid-template-rows: subgrid;\s*grid-template-columns: minmax\(0, 1fr\);/,
      );
    }
    expect(GRID).toMatch(/:host \{\s*display: grid;/);
    expect(GRID).not.toMatch(/grid-template-rows|grid-auto-flow/);
    expect(rule(':host([data-wide])')).toContain('grid-column: 1 / -1;');
    // The tracks set the heights, so no part of the card stretches itself.
    expect(STYLES).not.toContain('height: 100%');

    await render({ set: DATA, option: { series: [] }, loading: true });
    const body = card().querySelector('.chart-card-body');
    expect([...(body?.children ?? [])].map((child) => child.classList[0])).toEqual([
      'chart-card-head',
      'chart-card-frame',
    ]);
    // The progress line and the live region take no track.
    const article = card().querySelector('article');
    const inFlow = [...(article?.children ?? [])].filter(
      (child) => !child.matches('.chart-card-progress, .chart-card-live'),
    );
    expect(inFlow).toEqual([body]);
    expect(card().querySelector('.chart-card-progress')).not.toBeNull();
    expect(rule('.chart-card-progress')).toContain('position: absolute;');
    expect(rule('.chart-card-live')).toContain('position: absolute;');
    expect(rule('.chart-card')).toContain('position: relative;');
  });

  it('lets the chart grow to the height of its row track, never below its own height', async () => {
    expect(rule('.chart-card-frame')).toMatch(/display: flex;\s*flex-direction: column;/);
    // `flex-shrink: 0` keeps the `height` input as the least height.
    expect(STYLES).toMatch(
      /lib-chart,\s*\.chart-card-skeleton,\s*\.chart-card-message \{\s*flex: 1 0 auto;/,
    );
    await render({ set: DATA, option: { series: [] } });
    expect(card().querySelector<HTMLElement>('lib-chart')?.style.height).toBe('12rem');
  });

  it('covers the chart with its skeleton until the first draw, then fades it', async () => {
    expect(rule('.chart-card-cover')).toMatch(/position: absolute;\s*inset: 0;/);
    expect(STYLES).toMatch(
      /\.chart-card-plot:has\(lib-chart\[data-ready\]\) \.chart-card-cover \{\s*visibility: hidden;\s*opacity: 0;/,
    );
    await render({ set: DATA, option: { series: [] } });
    const plot = card().querySelector('.chart-card-plot');
    expect(plot?.querySelector('lib-chart')).not.toBeNull();
    expect(plot?.querySelector('.chart-card-cover')).not.toBeNull();
  });

  it('shows an entry again when its toggle button is gone', async () => {
    const both = chartLegend([
      { name: 'Ολοκληρωμένα', color: 'success' },
      { name: 'Ακυρωμένα', color: 'error' },
    ]);
    await render({ set: DATA, option: { legend: both } });
    card().querySelector<HTMLButtonElement>('.chart-legend-item')?.click();
    fixture.detectChanges();

    await render({ option: { legend: chartLegend([{ name: 'Ολοκληρωμένα', color: 'success' }]) } });
    expect(card().querySelector('.chart-legend')).toBeNull();
    const chart = fixture.debugElement.query(By.directive(Chart)).componentInstance as Chart;
    const legend = chart.option()['legend'] as Record<string, unknown>;
    expect(legend['selected']).toBeUndefined();

    await render({ option: { legend: both } });
    const pressed = [...card().querySelectorAll('.chart-legend-item')].map((button) =>
      button.getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'true']);
  });
});

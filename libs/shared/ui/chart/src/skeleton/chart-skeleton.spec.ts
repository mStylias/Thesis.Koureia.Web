import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ChartSkeleton } from './chart-skeleton';
import {
  CHART_SKELETON_COUNTS,
  skeletonBarHeights,
  skeletonCount,
  skeletonRing,
  skeletonRows,
  skeletonTicks,
} from './chart-skeleton-shape';
import type { ChartSkeletonKind } from './chart-skeleton.types';

@Component({
  imports: [ChartSkeleton],
  template: `<lib-chart-skeleton
    [kind]="kind()"
    [count]="count()"
    [columns]="columns()"
    [height]="height()"
  />`,
})
class Host {
  readonly kind = signal<ChartSkeletonKind>('line');
  readonly count = signal<number | undefined>(undefined);
  readonly columns = signal(12);
  readonly height = signal('18rem');
}

describe('ChartSkeleton', () => {
  let fixture: ComponentFixture<Host>;

  function render(kind: ChartSkeletonKind, count?: number, columns = 12): HTMLElement {
    fixture.componentInstance.kind.set(kind);
    fixture.componentInstance.count.set(count);
    fixture.componentInstance.columns.set(columns);
    fixture.detectChanges();
    return skeleton();
  }

  function skeleton(): HTMLElement {
    const host = fixture.nativeElement as HTMLElement;
    const element = host.querySelector<HTMLElement>('lib-chart-skeleton');
    if (!element) throw new Error('lib-chart-skeleton not rendered');
    return element;
  }

  function all(selector: string): HTMLElement[] {
    return Array.from(skeleton().querySelectorAll<HTMLElement>(selector));
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
  });

  it('is hidden from assistive technology and names its kind', () => {
    const host = render('bars');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('data-kind')).toBe('bars');
  });

  it('takes the height of the chart it stands in for', () => {
    expect(render('line').style.height).toBe('18rem');
    fixture.componentInstance.height.set('12rem');
    fixture.detectChanges();
    expect(skeleton().style.height).toBe('12rem');
  });

  it('draws a line as four gridlines with label stubs, one wave and the x-axis stubs', () => {
    render('line');
    expect(all('.rule')).toHaveLength(4);
    expect(all('.rule .label')).toHaveLength(4);
    expect(all('.plot .wave')).toHaveLength(1);
    expect(all('.ticks .tick')).toHaveLength(CHART_SKELETON_COUNTS.line);
    expect(all('.bar')).toHaveLength(0);
  });

  it('draws one bar and one x-axis stub per count', () => {
    render('bars');
    expect(all('.bar')).toHaveLength(7);
    expect(all('.ticks .tick')).toHaveLength(7);
    expect(all('.rule')).toHaveLength(4);

    render('bars', 12);
    const heights = all('.bar').map((bar) => bar.style.height);
    expect(heights).toHaveLength(12);
    expect(heights.slice(0, 3)).toEqual(['58%', '76%', '44%']);
  });

  it('hides every second x-axis stub when the bars are too many to label', () => {
    render('bars', 24);
    const ticks = all('.ticks .tick');
    expect(ticks).toHaveLength(24);
    expect(ticks.filter((tick) => tick.classList.contains('is-hidden'))).toHaveLength(12);
  });

  it('draws a horizontal bar row with a label stub, largest first', () => {
    render('bars-horizontal');
    expect(all('.hbar')).toHaveLength(5);
    expect(all('.hrows .label')).toHaveLength(5);
    expect(all('.hticks .tick')).toHaveLength(4);

    render('bars-horizontal', 8);
    const widths = all('.hbar').map((bar) => parseFloat(bar.style.width));
    expect(widths).toHaveLength(8);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
  });

  it('draws a donut as one ring the size of the dashboard donut', () => {
    render('donut');
    const rings = all('.ring');
    expect(rings).toHaveLength(1);
    // The radius ['32%', '50%'] of half the smaller side: 16 to 25 in a 100 view box.
    expect(rings[0]?.getAttribute('r')).toBe('20.5');
    expect(rings[0]?.getAttribute('stroke-width')).toBe('9');
    expect(all('.rule')).toHaveLength(0);
  });

  it('draws a heatmap as rows × columns cells with a label stub per row', () => {
    render('heatmap');
    expect(all('.cell')).toHaveLength(7 * 12);
    expect(all('.cells .label')).toHaveLength(7);
    expect(all('.cells .tick')).toHaveLength(12);
    expect(all('.ramp-bar')).toHaveLength(1);

    render('heatmap', 3, 4);
    expect(all('.cell')).toHaveLength(12);
    expect(all('.cells .label')).toHaveLength(3);
    const cells = skeleton().querySelector<HTMLElement>('.cells');
    expect(cells?.style.getPropertyValue('--columns')).toBe('4');
    expect(cells?.style.getPropertyValue('--rows')).toBe('3');
  });

  it('draws a treemap as five blocks in a fixed split', () => {
    render('treemap');
    expect(all('.block').map((block) => block.style.gridArea)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('draws a sparkline as a wave with no axes', () => {
    render('sparkline');
    expect(all('.wave')).toHaveLength(1);
    expect(all('.rule')).toHaveLength(0);
    expect(all('.tick')).toHaveLength(0);
  });

  it('falls back to the default count for a count it cannot use', () => {
    render('bars', 0);
    expect(all('.bar')).toHaveLength(7);
    render('bars', Number.NaN);
    expect(all('.bar')).toHaveLength(7);
    render('bars', 3.8);
    expect(all('.bar')).toHaveLength(3);
    render('heatmap', 2, -1);
    expect(all('.cell')).toHaveLength(2 * 12);
  });

  it('draws the same shape for the same inputs, so it never flickers', () => {
    const kinds: ChartSkeletonKind[] = [
      'line',
      'bars',
      'bars-horizontal',
      'donut',
      'heatmap',
      'treemap',
      'sparkline',
    ];
    for (const kind of kinds) {
      const first = render(kind, 9).innerHTML;
      render('donut');
      expect(render(kind, 9).innerHTML).toBe(first);
    }
  });
});

describe('chart skeleton shape', () => {
  it('repeats the bar pattern', () => {
    const heights = skeletonBarHeights(13);
    expect(heights[12]).toBe(heights[0]);
  });

  it('keeps a long horizontal list above the shortest bar width', () => {
    expect(skeletonRows(40).every((row) => row.bar >= 14)).toBe(true);
  });

  it('clamps a count to a whole number from 1 to 60', () => {
    expect(skeletonCount(undefined, 5)).toBe(5);
    expect(skeletonCount(500, 5)).toBe(60);
    expect(skeletonCount(Number.POSITIVE_INFINITY, 5)).toBe(5);
  });

  it('hides no tick up to the limit', () => {
    expect(skeletonTicks(12).some(Boolean)).toBe(false);
  });

  it('builds the ring from an inner and an outer radius', () => {
    expect(skeletonRing(50, 100)).toEqual({ radius: 37.5, width: 25 });
  });
});

describe('chart skeleton styles', () => {
  const scss = readFileSync('src/skeleton/chart-skeleton.scss', 'utf8');

  it('pulses with opacity only, so the reduced-motion rule stops it', () => {
    const keyframes = scss.slice(scss.indexOf('@keyframes chart-skeleton-pulse'));
    expect(keyframes).toContain('opacity');
    expect(keyframes).not.toMatch(/transform|width|height/);
  });

  it('keeps the shape visible under forced colors', () => {
    expect(scss).toMatch(/@media \(forced-colors: active\)[\s\S]*GrayText/);
  });
});

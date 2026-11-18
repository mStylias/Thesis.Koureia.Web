import { Component, computed, inject, input } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { Chart } from '../chart';
import { ChartTheme } from '../chart-theme';
import type { ChartOption } from '../chart.types';
import { chartSwatch } from '../core/chart-colors';
import { ChartSkeleton } from './chart-skeleton';
import type { ChartSkeletonKind } from './chart-skeleton.types';

/**
 * A per-story description plus the snippet shown under "Show code". Every story renders
 * through a demo wrapper, so the generated source would show the wrapper and not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/** A card the width of a dashboard column. */
const CARD =
  'display: block; max-width: 44rem; padding: var(--space-5); background: var(--surface); ' +
  'border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg);';

@Component({
  selector: 'lib-chart-skeleton-kind',
  imports: [ChartSkeleton],
  template: `
    <div [style]="card">
      <lib-chart-skeleton [kind]="kind()" [count]="count()" [height]="height()" />
    </div>
  `,
})
class KindDemo {
  protected readonly card = CARD;
  readonly kind = input<ChartSkeletonKind>('line');
  readonly count = input<number | undefined>(undefined);
  readonly height = input('18rem');
}

/** A story of one kind, in a dashboard card. */
function story(
  kind: ChartSkeletonKind,
  markdown: string,
  options: { count?: number; height?: string } = {},
): StoryObj {
  const height = options.height ?? '18rem';
  const count = options.count === undefined ? '' : ` [count]="${String(options.count)}"`;
  return {
    render: () => ({
      props: { kind, count: options.count, height },
      template: `<lib-chart-skeleton-kind [kind]="kind" [count]="count" [height]="height" />`,
    }),
    parameters: doc(markdown, `<lib-chart-skeleton kind="${kind}"${count} height="${height}" />`),
  };
}

const WEEKS = ['3 Aug', '10 Aug', '17 Aug', '24 Aug', '31 Aug', '7 Sep', '14 Sep', '21 Sep'];

@Component({
  selector: 'lib-chart-skeleton-beside-demo',
  imports: [Chart, ChartSkeleton],
  template: `
    <div
      style="display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--space-4); max-width: 60rem"
    >
      <div [style]="card">
        <lib-chart-skeleton kind="line" [count]="8" height="14rem" />
      </div>
      <div [style]="card">
        <lib-chart [option]="option()" ariaLabel="Revenue over time" height="14rem" />
      </div>
    </div>
  `,
})
class BesideDemo {
  protected readonly card = CARD;
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: WEEKS, boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: '€{value}' } },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        data: [820, 932, 901, 1134, 1290, 1210, 1330, 1420],
        color: chartSwatch(this.tokens(), 0),
        showSymbol: false,
        areaStyle: { opacity: 0.1 },
      },
    ],
  }));
}

const meta: Meta = {
  title: 'Data/Chart/Skeleton',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [KindDemo, BesideDemo] })],
};

export default meta;

export const Line = story(
  'line',
  `
Four gridlines with y-axis label stubs, one wave and the x-axis label stubs. \`count\` sets the
x-axis stubs (6 when left out).
  `,
);

export const Bars = story(
  'bars',
  `
One bar and one x-axis stub per \`count\` (7 when left out). The heights come from a fixed
pattern, so a new render draws the same bars. Above 12 bars, every second stub is hidden.
  `,
);

export const BarsHorizontal = story(
  'bars-horizontal',
  `
One row per \`count\` (5 when left out): a label stub in the category column and a bar that gets
shorter down the list, as a ranking does. Give it the height the chart gets for that many rows.
  `,
  { height: '14.5rem' },
);

export const Donut = story(
  'donut',
  `
One ring at the dashboard donut's radius, \`['32%', '50%']\` of half the smaller side, in the
center. The ring of the chart lands on it.
  `,
  { height: '16rem' },
);

export const Heatmap = story(
  'heatmap',
  `
\`count\` rows (7 when left out) of \`columns\` cells (12 when left out), a label stub per row, the
x-axis stubs and the ramp below.
  `,
  { height: '20rem' },
);

export const Treemap = story(
  'treemap',
  `
Five blocks in a fixed split. A treemap has no axes, so the blocks fill the host.
  `,
);

export const Sparkline = story(
  'sparkline',
  `
A thin wave with no axes, for the trend under a figure.
  `,
  { height: '2.5rem' },
);

export const BesideTheChart: StoryObj = {
  render: () => ({ template: '<lib-chart-skeleton-beside-demo />' }),
  parameters: doc(
    `
The skeleton and the chart it stands in for, at the same \`height\`. The gridlines, the label
column and the x-axis band land where the chart draws them, so nothing moves when it arrives.
    `,
    `
@if (loading()) {
  <lib-chart-skeleton kind="line" [count]="8" height="14rem" />
} @else {
  <lib-chart [option]="option()" ariaLabel="Revenue over time" height="14rem" />
}
    `,
  ),
};

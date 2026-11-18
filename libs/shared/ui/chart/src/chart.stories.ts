import { Component, computed, inject, signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { Chart } from './chart';
import { ChartTheme } from './chart-theme';
import type { ChartClickEvent, ChartOption } from './chart.types';
import { chartInkOn, chartSwatch } from './core/chart-colors';

/**
 * A per-story description plus the snippet shown under "Show code". Every story renders
 * through a demo wrapper, so the generated source would show the wrapper and not the API.
 */
const doc = (markdown: string, code: string, language = 'ts') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/** A card the width of a dashboard column. */
const CARD =
  'display: block; max-width: 44rem; padding: var(--space-5); background: var(--surface); ' +
  'border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg);';

const WEEKS = ['3 Aug', '10 Aug', '17 Aug', '24 Aug', '31 Aug', '7 Sep', '14 Sep', '21 Sep'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The grid top, in px, that holds the ECharts legend above the plot. */
const LEGEND_ROOM = 36;

@Component({
  selector: 'lib-chart-line-demo',
  imports: [Chart],
  template: `<lib-chart [style]="card" [option]="option()" ariaLabel="Revenue over time" />`,
})
class LineDemo {
  protected readonly card = CARD;
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    const color = chartSwatch(tokens, 0);
    return {
      tooltip: { trigger: 'axis' },
      legend: {},
      // The theme's grid leaves no room for the ECharts legend.
      grid: { top: LEGEND_ROOM },
      xAxis: { type: 'category', data: WEEKS, boundaryGap: false },
      yAxis: { type: 'value', axisLabel: { formatter: '€{value}' } },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          data: [820, 932, 901, 1134, 1290, null, 1330, 1420],
          color,
          showSymbol: false,
          connectNulls: false,
          areaStyle: { opacity: 0.1 },
        },
        {
          name: 'Previous period',
          type: 'line',
          data: [760, 810, 880, 940, 1010, 1080, 1100, 1190],
          color,
          showSymbol: false,
          lineStyle: { type: 'dashed' },
        },
      ],
    };
  });
}

/** Status tones, as `APPOINTMENT_STATUS_SPECS` gives them. Muted ones draw lighter. */
const STATUSES = [
  { name: 'Completed', tone: 'success', muted: false, data: [6, 8, 7, 9, 12, 14, 0] },
  { name: 'Confirmed', tone: 'info', muted: false, data: [3, 2, 4, 3, 5, 6, 0] },
  { name: 'Pending', tone: 'warning', muted: false, data: [1, 0, 2, 1, 2, 3, 0] },
  { name: 'Cancelled', tone: 'textMuted', muted: true, data: [1, 1, 0, 2, 1, 2, 0] },
  { name: 'No-show', tone: 'error', muted: true, data: [0, 1, 0, 0, 1, 0, 0] },
] as const;

@Component({
  selector: 'lib-chart-stacked-bar-demo',
  imports: [Chart],
  template: `<lib-chart [style]="card" [option]="option()" ariaLabel="Appointments by status" />`,
})
class StackedBarDemo {
  protected readonly card = CARD;
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {},
      grid: { top: LEGEND_ROOM },
      xAxis: { type: 'category', data: DAYS },
      yAxis: { type: 'value', minInterval: 1 },
      series: STATUSES.map((status) => ({
        name: status.name,
        type: 'bar',
        stack: 'status',
        data: status.data,
        color: tokens[status.tone],
        // The surface gap between stacked segments.
        itemStyle: {
          opacity: status.muted ? 0.55 : 1,
          borderColor: tokens.surface,
          borderWidth: 1,
        },
      })),
    };
  });
}

const BARBERS = [
  { name: 'Nikos P.', revenue: 2140, completed: 61 },
  { name: 'Maria K.', revenue: 1810, completed: 52 },
  { name: 'Giorgos D.', revenue: 1265, completed: 37 },
  { name: 'Eleni S.', revenue: 690, completed: 21 },
];

@Component({
  selector: 'lib-chart-horizontal-bar-demo',
  imports: [Chart],
  template: `
    <div [style]="card">
      <lib-chart
        [option]="option()"
        ariaLabel="Revenue per barber"
        height="14rem"
        (chartClick)="clicked.set($event)"
      />
      <p class="t-body-sm" style="margin-top: var(--space-3); color: var(--text-secondary)">
        Last click: {{ clicked()?.name ?? 'none' }}
      </p>
    </div>
  `,
})
class HorizontalBarDemo {
  protected readonly card = CARD;
  protected readonly clicked = signal<ChartClickEvent | null>(null);
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    // ECharts draws the first category at the bottom. Reverse, so the largest is on top.
    const rows = [...BARBERS].sort((a, b) => a.revenue - b.revenue);
    return {
      grid: { top: 4 },
      tooltip: {
        trigger: 'item',
        formatter: (params: { dataIndex: number }) => {
          const row = rows.at(params.dataIndex);
          return row
            ? `${row.name}<br/>€${String(row.revenue)} · ${String(row.completed)} completed`
            : '';
        },
      },
      xAxis: { type: 'value', axisLabel: { formatter: '€{value}' } },
      yAxis: { type: 'category', data: rows.map((row) => row.name) },
      series: [
        {
          name: 'Revenue',
          type: 'bar',
          data: rows.map((row) => row.revenue),
          color: tokens.accent,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
  });
}

const SOURCES = [
  { name: 'Online', value: 64 },
  { name: 'Staff', value: 17 },
];

@Component({
  selector: 'lib-chart-donut-demo',
  imports: [Chart],
  template: `<lib-chart
    [style]="card"
    [option]="option()"
    ariaLabel="Booking source"
    height="16rem"
  />`,
})
class DonutDemo {
  protected readonly card = CARD;
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {},
      series: [
        {
          name: 'Appointments',
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '56%'],
          percentPrecision: 0,
          label: { formatter: '{b}\n{d}%' },
          data: SOURCES.map((source, index) => ({
            ...source,
            itemStyle: { color: chartSwatch(tokens, index) },
          })),
        },
      ],
    };
  });
}

const HOURS = Array.from({ length: 12 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`);

/** A busy week: quiet mornings, a peak after work, Sunday closed. */
function busyCells(): [number, number, number][] {
  const cells: [number, number, number][] = [];
  DAYS.forEach((_, day) => {
    HOURS.forEach((_, hour) => {
      const evening = hour >= 8 && hour <= 10 ? 3 : 0;
      const saturday = day === 5 ? 2 : 0;
      const value = day === 6 ? 0 : ((hour * 7 + day * 3) % 4) + evening + saturday;
      cells.push([hour, day, value]);
    });
  });
  return cells;
}

@Component({
  selector: 'lib-chart-heatmap-demo',
  imports: [Chart],
  template: `<lib-chart
    [style]="card"
    [option]="option()"
    ariaLabel="Busy hours"
    height="20rem"
  />`,
})
class HeatmapDemo {
  protected readonly card = CARD;
  private readonly tokens = inject(ChartTheme).tokens;
  private readonly cells = busyCells();

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    const max = Math.max(...this.cells.map((cell) => cell[2]));
    return {
      // Room under the hour labels for the ramp.
      grid: { top: 4, bottom: 64 },
      tooltip: {
        trigger: 'item',
        formatter: (params: { value: [number, number, number] }) => {
          const [hour, day, value] = params.value;
          return `${DAYS[day] ?? ''} ${HOURS[hour] ?? ''}<br/>${String(value)} appointments`;
        },
      },
      xAxis: { type: 'category', data: HOURS, splitArea: { show: false } },
      // Monday on top.
      yAxis: { type: 'category', data: DAYS, inverse: true },
      visualMap: {
        type: 'continuous',
        min: 0,
        max,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 12,
        itemHeight: 160,
        inRange: { color: [tokens.surfaceSunken, tokens.accent] },
      },
      series: [{ name: 'Appointments', type: 'heatmap', data: this.cells }],
    };
  });
}

const CATEGORIES = [
  {
    name: 'Haircut',
    services: [
      { name: 'Classic cut', value: 1480 },
      { name: 'Skin fade', value: 1120 },
      { name: 'Kids cut', value: 340 },
    ],
  },
  {
    name: 'Beard',
    services: [
      { name: 'Beard trim', value: 620 },
      { name: 'Hot towel shave', value: 410 },
    ],
  },
  { name: 'Uncategorized', services: [{ name: 'Gift card', value: 180 }] },
];

@Component({
  selector: 'lib-chart-treemap-demo',
  imports: [Chart],
  template: `<lib-chart [style]="card" [option]="option()" ariaLabel="Revenue per service" />`,
})
class TreemapDemo {
  protected readonly card = CARD;
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    return {
      tooltip: { trigger: 'item', formatter: '{b}: €{c}' },
      series: [
        {
          name: 'Revenue',
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          levels: [
            // The root: a wider gap between the categories.
            { itemStyle: { gapWidth: 4, borderWidth: 0 } },
            // The categories: a header band with the name.
            { itemStyle: { gapWidth: 2, borderWidth: 2 }, upperLabel: { show: true, height: 22 } },
          ],
          data: CATEGORIES.map((category, index) => {
            const color = chartSwatch(tokens, index);
            const ink = chartInkOn(tokens, color);
            return {
              name: category.name,
              // The parent carries the sum already. Set it, so ECharts does not add it again.
              value: category.services.reduce((sum, service) => sum + service.value, 0),
              itemStyle: { color, borderColor: color },
              upperLabel: { color: ink },
              children: category.services.map((service) => ({ ...service, label: { color: ink } })),
            };
          }),
        },
      ],
    };
  });
}

@Component({
  selector: 'lib-chart-sparkline-demo',
  imports: [Chart],
  template: `
    <div [style]="card">
      <p class="t-body-sm" style="color: var(--text-secondary)">Revenue</p>
      <p class="t-h3">€9,840</p>
      <lib-chart [option]="option()" ariaLabel="Revenue trend, last 8 weeks" height="2.5rem" />
    </div>
  `,
})
class SparklineDemo {
  protected readonly card = `${CARD} max-width: 16rem;`;
  private readonly tokens = inject(ChartTheme).tokens;

  protected readonly option = computed<ChartOption>(() => {
    const tokens = this.tokens();
    return {
      grid: { left: 2, right: 2, top: 2, bottom: 2 },
      xAxis: { type: 'category', show: false, boundaryGap: false, data: WEEKS },
      yAxis: { type: 'value', show: false, scale: true },
      series: [
        {
          type: 'line',
          data: [820, 932, 901, 1134, 1290, 1210, 1330, 1420],
          color: tokens.accent,
          symbol: 'none',
          silent: true,
          areaStyle: { opacity: 0.1 },
        },
      ],
    };
  });
}

const meta: Meta = {
  title: 'Data/Chart/Chart',
  tags: ['autodocs'],
};

export default meta;

export const Line: StoryObj = {
  decorators: [moduleMetadata({ imports: [LineDemo] })],
  render: () => ({ template: '<lib-chart-line-demo />' }),
  parameters: doc(
    `
A line over time. The current period is solid with a light area fill. The previous period is
the same swatch, dashed, with no fill. A \`null\` bucket leaves a gap (\`connectNulls: false\`).
Hover a week: one tooltip lists both series.
The theme's grid top holds only the top y-axis label, so an option that shows the ECharts legend
sets \`grid.top\` for it.
    `,
    `
const tokens = inject(ChartTheme).tokens;
const color = chartSwatch(tokens(), 0);
option = {
  tooltip: { trigger: 'axis' },
  legend: {},
  // The theme's grid leaves no room for the ECharts legend.
  grid: { top: 36 },
  xAxis: { type: 'category', data: weeks, boundaryGap: false },
  yAxis: { type: 'value' },
  series: [
    { name: 'Revenue', type: 'line', data: revenue, color, showSymbol: false, areaStyle: { opacity: 0.1 } },
    { name: 'Previous period', type: 'line', data: previous, color, showSymbol: false, lineStyle: { type: 'dashed' } },
  ],
};

// <lib-chart [option]="option" ariaLabel="Revenue over time" />
    `,
  ),
};

export const StackedBar: StoryObj = {
  decorators: [moduleMetadata({ imports: [StackedBarDemo] })],
  render: () => ({ template: '<lib-chart-stacked-bar-demo />' }),
  parameters: doc(
    `
Statuses are states, so they take the semantic tones: success, info, warning, the muted text
for cancelled, and error for no-show. Cancelled and no-show draw lighter, as on the grid. A
1px surface border separates the stacked segments.
    `,
    `
series: statuses.map((status) => ({
  name: label(status),
  type: 'bar',
  stack: 'status',
  data: values(status),
  color: tokens.success, // tokens.info, tokens.warning, tokens.textMuted, tokens.error
  itemStyle: { opacity: muted ? 0.55 : 1, borderColor: tokens.surface, borderWidth: 1 },
}));
    `,
  ),
};

export const HorizontalBar: StoryObj = {
  decorators: [moduleMetadata({ imports: [HorizontalBarDemo] })],
  render: () => ({ template: '<lib-chart-horizontal-bar-demo />' }),
  parameters: doc(
    `
One series on the accent, largest on top. The tooltip adds a second figure. Click a bar:
\`chartClick\` gives the ECharts params, for a drill-down.
    `,
    `
<lib-chart
  [option]="option()"
  ariaLabel="Revenue per barber"
  height="14rem"
  (chartClick)="open($event.name)"
/>
    `,
    'html',
  ),
};

export const Donut: StoryObj = {
  decorators: [moduleMetadata({ imports: [DonutDemo] })],
  render: () => ({ template: '<lib-chart-donut-demo />' }),
  parameters: doc(
    `
A share of a whole with few parts. Each slice takes a swatch in order, and a 2px surface
border, from the theme, separates the slices.
    `,
    `
series: [{
  type: 'pie',
  radius: ['50%', '75%'],
  data: sources.map((source, index) => ({ ...source, itemStyle: { color: chartSwatch(tokens, index) } })),
}],
    `,
  ),
};

export const Heatmap: StoryObj = {
  decorators: [moduleMetadata({ imports: [HeatmapDemo] })],
  render: () => ({ template: '<lib-chart-heatmap-demo />' }),
  parameters: doc(
    `
A quantity on one hue: a continuous \`visualMap\` from \`--surface-sunken\` to \`--accent\`.
Monday is on top (\`inverse: true\`). The cell value is in the tooltip.
    `,
    `
visualMap: {
  type: 'continuous',
  min: 0,
  max,
  orient: 'horizontal',
  inRange: { color: [tokens.surfaceSunken, tokens.accent] },
},
yAxis: { type: 'category', data: weekdays, inverse: true },
series: [{ type: 'heatmap', data: cells }],
    `,
  ),
};

export const Treemap: StoryObj = {
  decorators: [moduleMetadata({ imports: [TreemapDemo] })],
  render: () => ({ template: '<lib-chart-treemap-demo />' }),
  parameters: doc(
    `
Category, then service. A parent sets its own \`value\`, the sum the server gives, so ECharts
does not add the children again. The label inside a fill takes \`chartInkOn\`, the ink with
more contrast on that swatch.
    `,
    `
data: categories.map((category, index) => {
  const color = chartSwatch(tokens, index);
  return {
    name: category.name,
    value: category.revenue,
    itemStyle: { color },
    label: { color: chartInkOn(tokens, color) },
    children: category.services,
  };
}),
    `,
  ),
};

export const Sparkline: StoryObj = {
  decorators: [moduleMetadata({ imports: [SparklineDemo] })],
  render: () => ({ template: '<lib-chart-sparkline-demo />' }),
  parameters: doc(
    `
A trend beside a figure: no axes, no tooltip, a tiny height. It is still an image with a name.
    `,
    `
<lib-chart [option]="sparkline()" ariaLabel="Revenue trend, last 8 weeks" height="2.5rem" />

sparkline = computed(() => ({
  grid: { left: 2, right: 2, top: 2, bottom: 2 },
  xAxis: { type: 'category', show: false, boundaryGap: false, data: weeks },
  yAxis: { type: 'value', show: false, scale: true },
  series: [{ type: 'line', data, color: tokens().accent, symbol: 'none', silent: true }],
}));
    `,
  ),
};

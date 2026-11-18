# @ui/chart

One ECharts chart, drawn as SVG in the brand's tokens. Use it for the management dashboard:
lines over time, bars, donuts, a heatmap, a treemap and sparklines. A chart is never the only
way to read the data: put a table beside it for screen readers.

```ts
import { Chart, ChartTheme, chartSwatch, type ChartOption, type ChartTokens } from '@ui/chart';
```

```ts
// A pure builder: no injection, no DOM. A spec calls it with a plain ChartTokens object.
export function revenueOption(points: readonly number[], tokens: ChartTokens): ChartOption {
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: points, color: chartSwatch(tokens, 0), areaStyle: { opacity: 0.1 } }],
  };
}

private readonly tokens = inject(ChartTheme).tokens;
protected readonly option = computed(() => revenueOption(this.points(), this.tokens()));
```

```html
<lib-chart [option]="option()" [ariaLabel]="title" height="18rem" (chartClick)="open($event)" />
```

## Skeleton

`lib-chart-skeleton` is the loading placeholder of a chart. It draws the shape of the chart that
replaces it: the axes, the bars, the ring or the cells, in faint surface tones, with a slow
pulse. Give it the `height` the chart gets, so nothing moves when the chart arrives.

```html
@if (loading()) {
<lib-chart-skeleton kind="bars-horizontal" [count]="rows" [height]="height" />
} @else {
<lib-chart [option]="option()" [ariaLabel]="title" [height]="height" />
}
```

| `lib-chart-skeleton` | Type                | Notes                                                                                    |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `kind`               | `ChartSkeletonKind` | Required. `line`, `bars`, `bars-horizontal`, `donut`, `heatmap`, `treemap`, `sparkline`. |
| `height`             | `string`            | A CSS length. Default `18rem`, the default of `lib-chart`.                               |
| `count`              | `number`            | Bars, rows, or the x-axis stubs of `line`. 1 to 60. Default per kind, below.             |
| `columns`            | `number`            | The columns of a `heatmap`. 1 to 60. Default `12`.                                       |

| Kind              | Shape                                                                      | Default `count` |
| ----------------- | -------------------------------------------------------------------------- | --------------- |
| `line`            | Four gridlines with label stubs, one wave, x-axis stubs                    | 6 stubs         |
| `bars`            | Vertical bars from a fixed pattern, gridlines, one x-axis stub per bar     | 7 bars          |
| `bars-horizontal` | One row per bar: a label stub and a bar that gets shorter down the list    | 5 rows          |
| `donut`           | One ring at the dashboard donut's radius, `['32%', '50%']`                 | —               |
| `heatmap`         | `count` × `columns` cells, a label stub per row, x-axis stubs and the ramp | 7 rows          |
| `treemap`         | Five blocks in a fixed split                                               | —               |
| `sparkline`       | A thin wave, no axes                                                       | —               |

The shapes are fixed patterns, never random: a new render draws the same shape, so it does not
flicker. Above 12 bars or columns, every second x-axis stub is hidden, as ECharts hides labels
that overlap. The insets follow the theme's grid and a 2.5rem label column, so the gridlines and
the x-axis band land where the chart draws them.

The host is `aria-hidden="true"`. Mark the region that holds it `aria-busy`. The pulse is opacity
only, so the base layer stops it under reduced motion. Under forced colors, each shape gets a
`GrayText` edge. The host does not shrink in a flex column. The custom property
`--chart-skeleton-fill` sets the tone of the shapes.

## Why not ngx-echarts

The wrapper is small, and a direct one keeps two things under our control: the theme, which
comes from the tokens and changes with the page, and the lazy load, which registers only the
five chart types and the components the dashboard uses.

## Why the SVG renderer

Text stays crisp at any zoom, and a phone holds less memory than with a canvas per chart. The
largest chart is a heatmap of 24 × 7 cells, far below the size where SVG gets slow. The SVG is
also in the DOM, so a test or a screenshot can read it.

## Why ECharts loads lazily

`echarts/core` with five chart types is the largest dependency of the dashboard. `lib-chart`
imports `chart.echarts.ts` in `afterNextRender`, once for the whole app, so ECharts lands in its
own chunk and never in the management shell. ECharts never runs on the server. The host takes
its `height` from the first render, so nothing moves when the chart arrives.

## Why the tokens are read with `getComputedStyle`

ECharts writes SVG attributes, and an SVG attribute cannot read `var(--…)`. `ChartTheme` reads
the semantic tokens from `<html>` and gives them as one signal. It reads again when `data-theme`
on `<html>` changes and when the operating system changes its color scheme: those are the two
causes of a change in `ThemeService.resolved()`. It watches the attribute and not the signal,
because the signal changes one effect before the attribute, and a read at that time gets the
old colors. A theme change calls `setTheme` on the drawn chart, and does not set the option
again, so the entrance does not play again.

The tokens are those of `<html>`. A chart inside a `data-surface="dark"` band gets the page's
colors, not the band's.

## Why a theme, not a base option

ECharts merges a theme per component and per series type. An axis, a legend or a bar series
takes its defaults from the theme whether the option has one of them or four, and the option
always wins. A base option merged by hand would need to know the shape of every option.

## API

| `lib-chart`  | Type              | Notes                                                                             |
| ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `option`     | `ChartOption`     | Required. An ECharts option. A new object replaces the old one (`notMerge`).      |
| `ariaLabel`  | `string`          | Required. The accessible name of the chart.                                       |
| `height`     | `string`          | A CSS length. Default `18rem`. Reserved before ECharts loads.                     |
| `chartClick` | `ChartClickEvent` | Output. The ECharts params of a click on a mark: series, data index, name, value. |

`ChartTheme.tokens()` is a `ChartTokens` object: `scheme`, `textPrimary`, `textSecondary`,
`textMuted`, `border`, `borderSubtle`, `borderStrong`, `surface`, `surfaceOverlay`,
`surfaceSunken`, `accent`, `swatches` (six), `success`, `info`, `warning`, `error`, `fontSans`,
`fontMono` and `durationBase` (milliseconds).

| Helper                     | Gives                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| `chartSwatch(tokens, n)`   | Swatch `n` from 0, repeating after the sixth. The accent with no swatches. |
| `chartInkOn(tokens, fill)` | `textPrimary` or `surface`, whichever reads better on `fill`.              |

The theme supplies the swatches as the series palette, the fonts, the axis and grid colors, the
legend, the tooltip on `--surface-overlay` with the `--border` edge, `--shadow-md` and the
padding and `--text-sm` of `@ui/tooltip`, a 2px surface ring on line markers, a 2px surface gap
between pie slices and heatmap cells, bars at most 24px thick, and a `visualMap` ramp from
`--surface-sunken` to `--accent`.

The tooltip text gets `--text-sm` only when the option has a `tooltip.formatter`. Without a
formatter, ECharts writes its own markup with a px font size on the name (12px) and the value
(14px), and that size ignores the browser's font size. A theme cannot fix this, because
`textStyle.fontSize` cannot read `var(--…)`. Give each tooltip a formatter that returns HTML
with no font size.

Motion: an entrance of `--dur-base` with `cubicOut`, and none under `prefers-reduced-motion`.
An option can set its own duration. It cannot turn the animation on under reduced motion.

The theme's grid is `left: 4, right: 12, top: 12, bottom: 4` px. The top holds half of the top
y-axis label and no legend: the dashboard draws its own legend above the chart. An option that
shows the ECharts legend sets `grid.top` for it, about `36`.

`CHART_LOADER` is the seam for a spec: provide a function that resolves to a fake module with
`createChart(element, theme)`. jsdom has no layout, and the chart waits for a host with a size.

## Accessibility

- The chart is one `role="img"` with `ariaLabel` as its name. The ECharts `aria` component is
  on, with the same text as its description. ECharts' generated description is English, so it
  is never used.
- The marks are not reachable by keyboard, and the tooltip shows on hover only. Give every
  chart a table of the same values (the dashboard's `series-table`).
- The legend toggles series with a click on the SVG, which a keyboard cannot reach. A page
  that needs the toggle from the keyboard renders its own buttons with `aria-pressed`.
- Color is never the only signal: a series has a legend entry and a tooltip name, and a swatch
  that repeats after the sixth needs its label.

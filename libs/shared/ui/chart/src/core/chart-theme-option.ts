import type { ChartTokens } from '../chart-theme.types';
import type { ChartFrame, ChartOption, ChartThemeOption } from '../chart.types';

/** The tooltip box of `@ui/tooltip`, in tokens, so the text follows the browser's font size. */
const TOOLTIP_CSS = [
  'box-shadow: var(--shadow-md)',
  'border-radius: var(--radius-md)',
  'padding: var(--space-2) var(--space-3)',
  'font-size: var(--text-sm)',
  'line-height: var(--leading-snug)',
].join('; ');

/** The grid insets of every chart, in px. Room for the axis labels only. */
export const CHART_THEME_GRID = { left: 4, right: 12, top: 12, bottom: 4 } as const;

/**
 * The ECharts theme built from the tokens: every default a consumer's option leaves out.
 *
 * A theme and not a base option merged under the consumer's. ECharts merges a theme per
 * component and per series type, so an axis or a bar series takes its defaults whether the
 * option declares one or four. `setTheme` also re-themes a drawn chart without a new instance.
 */
export function buildChartTheme(tokens: ChartTokens): ChartThemeOption {
  const font = tokens.fontSans;
  const axis = (): Record<string, unknown> => ({
    axisLine: { lineStyle: { color: tokens.borderStrong } },
    axisTick: { lineStyle: { color: tokens.borderStrong } },
    axisLabel: { color: tokens.textSecondary, fontFamily: font },
    nameTextStyle: { color: tokens.textSecondary, fontFamily: font },
    splitLine: { lineStyle: { color: tokens.borderSubtle, type: 'solid' } },
    splitArea: { areaStyle: { color: [tokens.surface, tokens.surfaceSunken] } },
  });

  return {
    darkMode: tokens.scheme === 'dark',
    color: [...tokens.swatches],
    backgroundColor: 'transparent',
    textStyle: { color: tokens.textSecondary, fontFamily: font },
    // The ECharts default keeps 15% of the width free on the left. The axis labels fit the
    // container without it. The top holds half of the top y-axis label. An option that shows
    // the ECharts legend must give it its own room.
    grid: { ...CHART_THEME_GRID },
    legend: {
      left: 0,
      top: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      inactiveColor: tokens.textMuted,
      textStyle: { color: tokens.textSecondary, fontFamily: font },
      pageTextStyle: { color: tokens.textSecondary },
      pageIconColor: tokens.textSecondary,
      pageIconInactiveColor: tokens.textMuted,
    },
    tooltip: {
      // Keeps the tooltip inside the chart, so a card that clips cannot cut it.
      confine: true,
      backgroundColor: tokens.surfaceOverlay,
      borderColor: tokens.border,
      borderWidth: 1,
      textStyle: { color: tokens.textPrimary, fontFamily: font },
      // The tooltip is HTML inside the host, so it reads the tokens directly. ECharts writes its
      // own padding, font size and line height in px before this text, so these replace them.
      extraCssText: TOOLTIP_CSS,
      axisPointer: {
        // A solid hairline: a dashed one reads as a gridline.
        lineStyle: { color: tokens.borderStrong, type: 'solid' },
        crossStyle: { color: tokens.borderStrong },
        shadowStyle: { color: tokens.surfaceSunken, opacity: 1 },
        // Behind the series. The ECharts default draws the band over the bars and fades them.
        z: 1,
      },
    },
    axisPointer: {
      lineStyle: { color: tokens.borderStrong, type: 'solid' },
      crossStyle: { color: tokens.borderStrong },
      label: {
        color: tokens.textPrimary,
        backgroundColor: tokens.surfaceOverlay,
        borderColor: tokens.border,
        borderWidth: 1,
        fontFamily: font,
      },
    },
    categoryAxis: { ...axis(), axisTick: { show: false }, splitLine: { show: false } },
    valueAxis: { ...axis(), axisLine: { show: false } },
    timeAxis: axis(),
    logAxis: axis(),
    visualMap: {
      inRange: { color: [tokens.surfaceSunken, tokens.accent] },
      textStyle: { color: tokens.textSecondary, fontFamily: font },
      handleStyle: { borderColor: tokens.borderStrong },
    },
    line: {
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 2, cap: 'round', join: 'round' },
      // The surface ring keeps a marker legible where it crosses another line.
      itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
    },
    bar: { barMaxWidth: 24 },
    pie: {
      itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
      label: { color: tokens.textSecondary, fontFamily: font },
      labelLine: { lineStyle: { color: tokens.borderStrong } },
    },
    heatmap: { itemStyle: { borderColor: tokens.surface, borderWidth: 2 } },
    treemap: {
      itemStyle: { borderColor: tokens.surface, borderWidth: 2, gapWidth: 2 },
      label: { fontFamily: font },
      upperLabel: { fontFamily: font },
      breadcrumb: {
        itemStyle: {
          color: tokens.surfaceSunken,
          borderColor: tokens.border,
          textStyle: { color: tokens.textPrimary, fontFamily: font },
        },
      },
    },
  };
}

/**
 * The consumer's option with what every chart shares: the accessible name and the motion.
 *
 * The consumer can set its own duration and easing. It cannot turn the animation on under
 * reduced motion, or replace the accessible name.
 */
export function frameChartOption(option: ChartOption, frame: ChartFrame): ChartOption {
  const aria = (option['aria'] ?? {}) as Record<string, unknown>;
  const label = (aria['label'] ?? {}) as Record<string, unknown>;
  const motion = frame.reducedMotion
    ? {}
    : {
        animationDuration: frame.durationBase,
        animationDurationUpdate: frame.durationBase,
        animationEasing: 'cubicOut' as const,
        animationEasingUpdate: 'cubicOut' as const,
      };

  return {
    ...motion,
    ...option,
    ...(frame.reducedMotion ? { animation: false } : {}),
    // The ECharts default description is generated English. The consumer's name replaces it.
    aria: { ...aria, enabled: true, label: { ...label, description: frame.ariaLabel } },
  };
}

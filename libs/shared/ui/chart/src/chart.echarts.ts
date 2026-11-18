import { BarChart, HeatmapChart, LineChart, PieChart, TreemapChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { init, use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

import type { ChartInstance, ChartThemeOption } from './chart.types';

// Only what the charts use. Each addition grows the lazy chunk.
use([
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
  SVGRenderer,
]);

/** Creates one chart in `element`, drawn as SVG. */
export function createChart(element: HTMLElement, theme: ChartThemeOption): ChartInstance {
  return init(element, theme, { renderer: 'svg' });
}

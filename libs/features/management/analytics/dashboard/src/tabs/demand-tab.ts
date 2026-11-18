import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { DemandTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import { appointmentsByStatusOption } from '../charts/options/appointments-by-status.options';
import { bookingLeadTimeOption } from '../charts/options/booking-lead-time.options';
import { bookingSourceOption } from '../charts/options/booking-source.options';
import { busiestHoursOption, hourLabels } from '../charts/options/busiest-hours.options';
import { busyHeatmapOption, weekdayName } from '../charts/options/busy-heatmap.options';
import {
  barChartHeight,
  CHART_HEIGHT,
  heatmapChartHeight,
  tallestHeight,
} from '../charts/options/chart-base';
import { upcomingLoadOption } from '../charts/options/upcoming-load.options';

/** The rows of the heatmap. */
const WEEKDAYS = 7;

/** The lead time ranges: same day, 1, 2 to 3, 4 to 7, 8 to 14, 15 to 30 and 31 or more days. */
const LEAD_TIME_ROWS = 7;

/**
 * Ζήτηση: three rows of two cards. Statuses and booking source, the next 14 days and busy hours,
 * the heatmap and lead time. The two charts of a row share one height.
 */
@Component({
  selector: 'lib-demand-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './demand-tab.html',
})
export class DemandTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<DemandTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly byStatus = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? appointmentsByStatusOption(data.appointmentsByStatus, ctx) : null;
  });

  protected readonly upcoming = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? upcomingLoadOption(data.upcomingLoad, ctx) : null;
  });

  protected readonly busiest = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? busiestHoursOption(data.busiestHours, ctx) : null;
  });

  protected readonly heatmap = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? busyHeatmapOption(data.busyHeatmap, ctx) : null;
  });

  protected readonly leadTime = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? bookingLeadTimeOption(data.bookingLeadTime, ctx) : null;
  });

  protected readonly source = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? bookingSourceOption(data.bookingSource, ctx) : null;
  });

  // The hour sets key their items by hour: the table shows them as the chart does.
  protected readonly busiestLabels = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? hourLabels(data.busiestHours, ctx) : null;
  });

  protected readonly heatmapLabels = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? hourLabels(data.busyHeatmap, ctx) : null;
  });

  protected readonly heatmapColumns = computed(() => {
    const ctx = this.context();
    return ctx ? (key: string) => weekdayName(key, ctx) : null;
  });

  protected readonly chartHeight = CHART_HEIGHT;

  /** The lead time ranges of the response. Seven until it arrives, as the API sends. */
  protected readonly leadTimeRows = computed(
    () => this.data()?.bookingLeadTime.axis.items.length ?? LEAD_TIME_ROWS,
  );

  /** The heatmap's 7 weekday rows, or the lead time bars beside it when they need more. */
  protected readonly heatmapRowHeight = computed(() =>
    tallestHeight(heatmapChartHeight(WEEKDAYS), barChartHeight(this.leadTimeRows())),
  );
}

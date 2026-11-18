import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ServicesTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import {
  bookingsPerServiceOption,
  bookingsPerServiceSet,
  categorySwatches,
  serviceLabels,
} from '../charts/options/bookings-per-service.options';
import { barChartHeight } from '../charts/options/chart-base';
import { revenuePerServiceOption } from '../charts/options/revenue-per-service.options';

/** The least rows of both charts, and the service bars of the skeleton. */
const SERVICE_ROWS = 6;

/** Υπηρεσίες: bookings per service and revenue per service. */
@Component({
  selector: 'lib-services-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './services-tab.html',
})
export class ServicesTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<ServicesTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly bookingsSet = computed(() => {
    const data = this.data();
    return data ? bookingsPerServiceSet(data.bookingsPerService) : null;
  });

  /** One swatch per category for both charts, so a category has one color on the tab. */
  private readonly colors = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? categorySwatches(data.bookingsPerService, ctx) : null;
  });

  protected readonly bookings = computed(() => {
    const data = this.data();
    const ctx = this.context();
    const colors = this.colors();
    return data && ctx && colors
      ? bookingsPerServiceOption(data.bookingsPerService, ctx, colors)
      : null;
  });

  protected readonly revenue = computed(() => {
    const data = this.data();
    const ctx = this.context();
    const colors = this.colors();
    return data && ctx && colors
      ? revenuePerServiceOption(data.revenuePerService, ctx, colors)
      : null;
  });

  /** The table names a service with its category, which the chart shows by color. */
  protected readonly bookingsLabels = computed(() => {
    const data = this.data();
    const set = this.bookingsSet();
    const ctx = this.context();
    return data && set && ctx ? serviceLabels(set.axis.items, data.bookingsPerService, ctx) : null;
  });

  protected readonly revenueLabels = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx
      ? serviceLabels(data.revenuePerService.axis.items, data.revenuePerService, ctx)
      : null;
  });

  /** The services of the response. Six until it arrives. */
  protected readonly bookingsRows = computed(
    () => this.bookingsSet()?.axis.items.length ?? SERVICE_ROWS,
  );

  /** One height for both charts: the treemap needs room for each service as the bars do. */
  protected readonly height = computed(() =>
    barChartHeight(Math.max(this.bookingsRows(), SERVICE_ROWS)),
  );
}

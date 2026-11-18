import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CustomersTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import { CHART_HEIGHT } from '../charts/options/chart-base';
import { daysBetweenVisitsOption } from '../charts/options/days-between-visits.options';
import { newVsReturningOption } from '../charts/options/new-vs-returning.options';
import { topCustomerRows } from '../charts/options/top-customers.options';

/**
 * Πελάτες: new and returning customers beside the days between visits, at one chart height, and
 * the top customers below them across both columns.
 */
@Component({
  selector: 'lib-customers-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './customers-tab.html',
  styleUrl: './customers-tab.scss',
})
export class CustomersTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<CustomersTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly chartHeight = CHART_HEIGHT;
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly newVsReturning = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? newVsReturningOption(data.newVsReturning, ctx) : null;
  });

  protected readonly daysBetweenVisits = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? daysBetweenVisitsOption(data.daysBetweenVisits, ctx) : null;
  });

  /** A table, not a chart: the card shows it in place of a chart. */
  protected readonly topCustomers = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? topCustomerRows(data.topCustomers, ctx) : [];
  });
}

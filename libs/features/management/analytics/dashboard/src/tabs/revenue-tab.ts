import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { RevenueTabResponse } from '@api/analytics';

import { AnalyticsDashboardStore } from '../analytics-dashboard.store';
import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import { injectStaffRows } from '../charts/chart-rows';
import { barChartHeight, WIDE_CHART_HEIGHT } from '../charts/options/chart-base';
import {
  revenuePerCategoryOption,
  revenuePerCategorySet,
} from '../charts/options/revenue-per-category.options';
import {
  revenuePerStaffOption,
  revenuePerStaffSet,
} from '../charts/options/revenue-per-staff.options';
import { revenueOverTimeOption } from '../charts/options/revenue-over-time.options';

/** The category bars of the skeleton. */
const CATEGORY_ROWS = 3;

/** Έσοδα: revenue over time, per barber and per service category. */
@Component({
  selector: 'lib-revenue-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './revenue-tab.html',
})
export class RevenueTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<RevenueTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly staffSet = computed(() => {
    const data = this.data();
    return data ? revenuePerStaffSet(data.revenuePerStaff) : null;
  });

  protected readonly categorySet = computed(() => {
    const data = this.data();
    return data ? revenuePerCategorySet(data.revenuePerService) : null;
  });

  protected readonly overTime = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? revenueOverTimeOption(data.revenueOverTime, ctx) : null;
  });

  protected readonly perStaff = computed(() => {
    const set = this.staffSet();
    const ctx = this.context();
    return set && ctx ? revenuePerStaffOption(set, ctx) : null;
  });

  protected readonly perCategory = computed(() => {
    const set = this.categorySet();
    const ctx = this.context();
    return set && ctx ? revenuePerCategoryOption(set, ctx) : null;
  });

  protected readonly wideHeight = WIDE_CHART_HEIGHT;

  private readonly filters = inject(AnalyticsDashboardStore).filters;

  /** The shop's active barbers. */
  private readonly staffCount = injectStaffRows();

  /**
   * The bars of the barbers: the response's count, or before it one bar per active barber. With
   * a barber filter, the response has one bar.
   */
  protected readonly staffRows = computed(
    () =>
      this.staffSet()?.axis.items.length ??
      (this.filters().staffMemberId === null ? this.staffCount() : 1),
  );

  /** The categories of the response. Three until it arrives. */
  protected readonly categoryRows = computed(
    () => this.categorySet()?.axis.items.length ?? CATEGORY_ROWS,
  );

  protected readonly staffHeight = computed(() => barChartHeight(this.staffRows()));

  protected readonly categoryHeight = computed(() => barChartHeight(this.categoryRows()));
}

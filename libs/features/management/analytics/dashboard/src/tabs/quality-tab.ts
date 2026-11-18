import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { QualityTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import { WIDE_CHART_HEIGHT } from '../charts/options/chart-base';
import {
  ratingDistributionOption,
  ratingDistributionSet,
  ratingLabels,
} from '../charts/options/rating-distribution.options';
import { ratingOverTimeOption } from '../charts/options/rating-over-time.options';

/** Ποιότητα: the rating over time and the spread of the ratings. */
@Component({
  selector: 'lib-quality-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './quality-tab.html',
})
export class QualityTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<QualityTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly wideHeight = WIDE_CHART_HEIGHT;
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly distributionSet = computed(() => {
    const data = this.data();
    return data ? ratingDistributionSet(data.ratingDistribution) : null;
  });

  /** The hidden table's rows are "5 ★" to "1 ★", as on the chart. */
  protected readonly distributionLabels = computed(() => {
    const set = this.distributionSet();
    const ctx = this.context();
    return set && ctx ? ratingLabels(set, ctx) : null;
  });

  protected readonly overTime = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? ratingOverTimeOption(data.ratingOverTime, ctx) : null;
  });

  protected readonly distribution = computed(() => {
    const set = this.distributionSet();
    const ctx = this.context();
    return set && ctx ? ratingDistributionOption(set, ctx) : null;
  });
}

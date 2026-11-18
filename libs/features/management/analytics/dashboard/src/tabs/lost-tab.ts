import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { LostBusinessTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import { WIDE_CHART_HEIGHT } from '../charts/options/chart-base';
import { cancelledByOption } from '../charts/options/cancelled-by.options';
import { lostRateOverTimeOption } from '../charts/options/lost-rate-over-time.options';
import { statusMixOption } from '../charts/options/status-mix.options';

/** Απώλειες: the status mix, the lost rate over time and who cancelled. */
@Component({
  selector: 'lib-lost-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './lost-tab.html',
})
export class LostTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<LostBusinessTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly wideHeight = WIDE_CHART_HEIGHT;
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly overTime = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? lostRateOverTimeOption(data.lostRateOverTime, ctx) : null;
  });

  protected readonly statusMix = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? statusMixOption(data.statusMix, ctx) : null;
  });

  protected readonly cancelledBy = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? cancelledByOption(data.cancelledBy, ctx) : null;
  });
}

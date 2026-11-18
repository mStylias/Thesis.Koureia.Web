import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TeamTabResponse } from '@api/analytics';

import type { DashboardEntry } from '../analytics-dashboard.types';
import { ChartCard } from '../charts/chart-card';
import { injectChartContext } from '../charts/chart-context';
import { ChartGrid } from '../charts/chart-grid';
import { injectStaffRows } from '../charts/chart-rows';
import { appointmentsPerStaffOption } from '../charts/options/appointments-per-staff.options';
import { barChartHeight } from '../charts/options/chart-base';
import {
  ratingPerStaffOption,
  ratingPerStaffSet,
} from '../charts/options/rating-per-staff.options';
import {
  staffUtilizationOption,
  staffUtilizationSet,
} from '../charts/options/staff-utilization.options';

/** Ομάδα: appointments, utilization and rating per barber. It ignores the barber filter. */
@Component({
  selector: 'lib-team-tab',
  imports: [ChartCard, ChartGrid, TranslocoPipe],
  templateUrl: './team-tab.html',
})
export class TeamTab {
  /** The tab's entry in the store: the response and the state of its read. */
  readonly entry = input.required<DashboardEntry<TeamTabResponse>>();
  /** The retry of a failed read. */
  readonly retry = output();

  protected readonly data = computed(() => this.entry().data);
  protected readonly context = injectChartContext(() => this.data()?.period);

  protected readonly utilizationSet = computed(() => {
    const data = this.data();
    return data ? staffUtilizationSet(data.staffUtilization) : null;
  });

  protected readonly ratingSet = computed(() => {
    const data = this.data();
    return data ? ratingPerStaffSet(data.ratingPerStaff) : null;
  });

  protected readonly appointments = computed(() => {
    const data = this.data();
    const ctx = this.context();
    return data && ctx ? appointmentsPerStaffOption(data.appointmentsPerStaff, ctx) : null;
  });

  protected readonly utilization = computed(() => {
    const set = this.utilizationSet();
    const ctx = this.context();
    return set && ctx ? staffUtilizationOption(set, ctx) : null;
  });

  protected readonly rating = computed(() => {
    const set = this.ratingSet();
    const ctx = this.context();
    return set && ctx ? ratingPerStaffOption(set, ctx) : null;
  });

  /** The shop's active barbers. The bars of each chart until the response gives the count. */
  private readonly staffCount = injectStaffRows();

  protected readonly appointmentsRows = computed(
    () => this.data()?.appointmentsPerStaff.axis.items.length ?? this.staffCount(),
  );

  protected readonly utilizationRows = computed(
    () => this.utilizationSet()?.axis.items.length ?? this.staffCount(),
  );

  protected readonly ratingRows = computed(
    () => this.ratingSet()?.axis.items.length ?? this.staffCount(),
  );

  protected readonly appointmentsHeight = computed(() => barChartHeight(this.appointmentsRows()));

  protected readonly utilizationHeight = computed(() => barChartHeight(this.utilizationRows()));

  protected readonly ratingHeight = computed(() => barChartHeight(this.ratingRows()));
}

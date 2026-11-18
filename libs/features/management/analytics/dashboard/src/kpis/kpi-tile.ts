import { booleanAttribute, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideArrowDown, LucideArrowUp, LucideMinus } from '@lucide/angular';
import type { KpiViewDto } from '@api/analytics';
import { Chart, ChartSkeleton } from '@ui/chart';
import { Stat } from '@ui/stat';
import { Tooltip } from '@ui/tooltip';

import { NO_VALUE } from '../analytics.format';
import type { KpiId } from '../analytics.format.types';
import { isEmptySeriesSet } from '../charts/options/chart-data';
import type { ChartContext } from '../charts/options/chart-options.types';
import { sparklineOption } from '../charts/options/sparkline.options';

/**
 * One KPI of the overview: the label, the value below it, and a last row with the change and the
 * trend as a sparkline. The tooltip gives the previous value with the comparison dates,
 * on hover and on keyboard focus. The arrow and the sign always show, so the color is never the
 * only signal.
 *
 * Until the overview lands, the tile shows its label and stubs in the place of the value, the
 * change and the sparkline, at their sizes.
 */
@Component({
  selector: 'lib-kpi-tile',
  imports: [
    Chart,
    ChartSkeleton,
    LucideArrowDown,
    LucideArrowUp,
    LucideMinus,
    Stat,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './kpi-tile.html',
  styleUrl: './kpi-tile.scss',
})
export class KpiTile {
  /** Which KPI of `OverviewTabResponse`. Names the tile and decides which way is good. */
  readonly id = input.required<KpiId>();
  /** `null` until the overview lands. */
  readonly kpi = input<KpiViewDto | null>(null);
  /** The context of the overview response. */
  readonly context = input<ChartContext | null>(null);
  /** The overview read failed: the tile shows `—` instead of a skeleton. */
  readonly failed = input(false, { transform: booleanAttribute });

  /** Set in `kpi-tile.scss`. The sparkline and its skeleton take the same height. */
  protected readonly sparklineHeight = 'var(--kpi-sparkline-height)';

  protected readonly pending = computed(
    () => (this.kpi() === null || this.context() === null) && !this.failed(),
  );

  /** Empty while pending: the value stub fills the line. */
  protected readonly value = computed(() => {
    if (this.pending()) return '';
    const kpi = this.kpi();
    const ctx = this.context();
    return kpi && ctx ? ctx.format.value(kpi.value, kpi.unit) : NO_VALUE;
  });

  protected readonly change = computed(() => {
    const kpi = this.kpi();
    const ctx = this.context();
    return kpi && ctx ? ctx.format.change(kpi, this.id()) : null;
  });

  /** "Προηγούμενη περίοδος (8 Απρ – 6 Ιουλ): 4.712,50 €". */
  protected readonly previous = computed(() => {
    const kpi = this.kpi();
    const ctx = this.context();
    if (!kpi || !ctx) return '';
    const period = ctx.period;
    return ctx.t('managementDashboard.kpis.previous', {
      comparison: ctx.t(`managementDashboard.comparison.${period.comparison}`),
      dates: ctx.format.period(period.comparisonFrom, period.comparisonTo),
      value: ctx.format.tooltip(kpi.previousValue, kpi.unit),
    });
  });

  protected readonly sparkline = computed(() => {
    const kpi = this.kpi();
    const ctx = this.context();
    return kpi && ctx && !isEmptySeriesSet(kpi.trend) ? sparklineOption(kpi.trend, ctx) : null;
  });
}

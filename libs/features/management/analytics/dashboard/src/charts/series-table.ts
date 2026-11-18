import { Component, computed, input } from '@angular/core';
import type { SeriesSetViewDto } from '@api/analytics';

import { axisLabels, seriesName } from './options/chart-data';
import type { ChartContext } from './options/chart-options.types';
import type { SeriesNamer, SeriesTableColumn, SeriesTableRow } from './series-table.types';

/**
 * A series set as a table for screen readers: one row per axis item, one column per series, the
 * values formatted as in the tooltip. Every response has the same shape, so one table serves
 * every chart. The host is visually hidden.
 */
@Component({
  selector: 'lib-series-table',
  templateUrl: './series-table.html',
  styleUrl: './series-table.scss',
})
export class SeriesTable {
  readonly set = input.required<SeriesSetViewDto>();
  /** The chart's heading. */
  readonly caption = input.required<string>();
  readonly context = input.required<ChartContext>();
  /** The row labels, one per axis item. Default: the axis labels the charts use. */
  readonly labels = input<readonly string[] | null>(null);
  /** The column names. Default: the series names the charts use. */
  readonly seriesName = input<SeriesNamer | null>(null);

  protected readonly columns = computed<readonly SeriesTableColumn[]>(() => {
    const ctx = this.context();
    const name = this.seriesName() ?? ((key: string) => seriesName(key, ctx));
    return this.set().series.map((series) => ({ key: series.key, name: name(series.key) }));
  });

  protected readonly rows = computed<readonly SeriesTableRow[]>(() => {
    const set = this.set();
    const ctx = this.context();
    const labels = this.labels() ?? axisLabels(set, ctx);
    return set.axis.items.map((item, index) => ({
      key: item.key,
      label: labels[index] ?? item.key,
      cells: set.series.map((series) =>
        ctx.format.tooltip(series.values[index] ?? null, series.unit),
      ),
    }));
  });
}

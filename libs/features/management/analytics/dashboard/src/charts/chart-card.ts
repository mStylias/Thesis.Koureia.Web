import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SeriesSetViewDto } from '@api/analytics';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { Card, CardBody, CardTitle } from '@ui/card';
import { Chart, type ChartClickEvent, type ChartOption, ChartSkeleton } from '@ui/chart';
import { ProgressBar } from '@ui/progress';

import type { ChartCardSkeleton, ChartCardState } from './chart-card.types';
import { CHART_HEIGHT, readLegend, SERIES_MARKER } from './options/chart-base';
import { isEmptySeriesSet } from './options/chart-data';
import type { ChartContext } from './options/chart-options.types';
import { SeriesTable } from './series-table';
import type { SeriesNamer } from './series-table.types';

let nextId = 0;

/** The body rows of a table skeleton when the description gives no count. */
const TABLE_ROWS = 10;

/** The most stubs of one row or one legend. */
const MAX_STUBS = 60;

/** `0` to `count - 1`, for `@for`. A bad count gives no stub. */
function stubs(count: number): number[] {
  const safe = Number.isFinite(count) ? Math.min(MAX_STUBS, Math.max(0, Math.floor(count))) : 0;
  return Array.from({ length: safe }, (_, index) => index);
}

/**
 * One chart of a tab: the heading, an optional note, the chart and a hidden table of the same
 * values. It owns the states: a skeleton before the first response, a dimmed chart with a
 * progress line while a new one loads, the empty message, and the failure with a retry.
 *
 * ```html
 * <lib-chart-card
 *   wide
 *   [heading]="'managementDashboard.charts.revenue.revenueOverTime.title' | transloco"
 *   [skeleton]="{ kind: 'line', legend: 2 }"
 *   [set]="data()?.revenueOverTime"
 *   [option]="revenueOverTime()"
 *   [context]="context()"
 *   [loading]="entry().loading"
 *   [failed]="entry().failed"
 *   (retry)="retry.emit()"
 * />
 * ```
 *
 * The legend is the option's `legend.data` (see `chartLegend`), drawn as toggle buttons in one
 * row under the heading and the note. With no `option`, the card shows its projected content
 * instead of a chart.
 */
@Component({
  selector: 'lib-chart-card',
  imports: [
    Banner,
    Button,
    Card,
    CardBody,
    CardTitle,
    Chart,
    ChartSkeleton,
    ProgressBar,
    SeriesTable,
    TranslocoPipe,
  ],
  templateUrl: './chart-card.html',
  styleUrl: './chart-card.scss',
  host: {
    '[attr.data-wide]': 'wide() ? "" : null',
    '[attr.data-state]': 'state()',
  },
})
export class ChartCard {
  /** The chart's name: the card heading, the chart's accessible name and the table caption. */
  readonly heading = input.required<string>();
  /** One line under the heading. */
  readonly note = input('');
  /**
   * Spans both columns of `lib-chart-grid`. Use it for a chart over time, which needs the width,
   * and for content that cannot match the height of a card beside it, as a table.
   */
  readonly wide = input(false, { transform: booleanAttribute });
  /** The data. `null` or `undefined` until the first response. */
  readonly set = input<SeriesSetViewDto | null | undefined>(null);
  /** The ECharts option. `null` shows the projected content instead. */
  readonly option = input<ChartOption | null | undefined>(null);
  /** For the hidden table. No table without it. */
  readonly context = input<ChartContext | null>(null);
  /** A read is running. With data on screen, the chart dims and a progress line shows. */
  readonly loading = input(false, { transform: booleanAttribute });
  /** The last read failed. The card offers a retry. */
  readonly failed = input(false, { transform: booleanAttribute });
  /** Overrides the empty check, which is `isEmptySeriesSet(set)`: no items, or only 0 and null. */
  readonly empty = input<boolean | undefined>(undefined);
  /**
   * The chart's height, as a CSS length. The skeleton and the messages keep it. In a row with a
   * taller chart, the chart grows to that height.
   */
  readonly height = input(CHART_HEIGHT);
  /**
   * The shape of the loading placeholder. Give the counts of the loaded chart, so the skeleton
   * takes the space the chart takes.
   */
  readonly skeleton = input<ChartCardSkeleton>({ kind: 'bars' });
  /** Renders the hidden table. Turn it off when the projected content is a table. */
  readonly table = input(true, { transform: booleanAttribute });
  /** The table's row labels, when the chart's differ from the axis labels. */
  readonly labels = input<readonly string[] | null>(null);
  /** The table's column names, when the chart's differ from the series names. */
  readonly seriesName = input<SeriesNamer | null>(null);

  /** The retry button of the failed state. */
  readonly retry = output();
  /** A click on a mark of the chart. */
  readonly chartClick = output<ChartClickEvent>();

  protected readonly headingId = `chart-card-heading-${nextId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly card = viewChild.required<string, ElementRef<HTMLElement>>('card', {
    read: ElementRef,
  });

  /** The first card of its parent. Only this card announces a failure. */
  private readonly lead = signal(false);

  /** The legend entries the user turned off. */
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());

  protected readonly state = computed<ChartCardState>(() => {
    const set = this.set();
    if (this.failed() && !this.loading()) return 'failed';
    if (set === null || set === undefined) return 'skeleton';
    if (this.empty() ?? isEmptySeriesSet(set)) return 'empty';
    return 'ready';
  });

  /** A new read over data already shown. */
  protected readonly reloading = computed(
    () => this.loading() && this.state() !== 'skeleton' && this.state() !== 'failed',
  );

  /** The live region holds the failure while this is true. */
  protected readonly announced = computed(() => this.lead() && this.state() === 'failed');

  protected readonly legend = computed(() => readLegend(this.option()));
  protected readonly marker = SERIES_MARKER;

  /** The `lib-chart-skeleton` kind. `null` for a table. */
  protected readonly chartSkeleton = computed(() => {
    const kind = this.skeleton().kind;
    return kind === 'table' ? null : kind;
  });

  /** One stub per legend entry, as the loaded legend draws them. None below 2, as there. */
  protected readonly legendStubs = computed(() => {
    const count = this.skeleton().legend ?? 0;
    return count > 1 ? stubs(count) : [];
  });

  /** The body rows of a table skeleton. */
  protected readonly tableStubs = computed(() => stubs(this.skeleton().count ?? TABLE_ROWS));

  /**
   * The option with the turned-off entries deselected. With one entry there is no toggle row, so
   * an entry the user turned off earlier must show again.
   */
  protected readonly shownOption = computed<ChartOption | null>(() => {
    const option = this.option() ?? null;
    const hidden = this.hidden();
    if (option === null || hidden.size === 0 || this.legend().length <= 1) return option;
    const legend = (option['legend'] ?? {}) as Record<string, unknown>;
    return {
      ...option,
      legend: {
        ...legend,
        selected: Object.fromEntries(
          this.legend().map((item) => [item.name, !hidden.has(item.name)]),
        ),
      },
    };
  });

  constructor() {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      this.lead.set(host.parentElement?.querySelector(':scope > lib-chart-card') === host);
    });
  }

  /** The retry removes the button, so focus moves to the card first. */
  protected onRetry(): void {
    this.card().nativeElement.focus({ preventScroll: true });
    this.retry.emit();
  }

  protected toggle(name: string): void {
    this.hidden.update((hidden) => {
      const next = new Set(hidden);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }
}

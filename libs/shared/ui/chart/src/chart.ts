import {
  afterNextRender,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  ErrorHandler,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { CHART_LOADER } from './chart-loader';
import { ChartScheduler } from './chart-scheduler';
import { ChartTheme } from './chart-theme';
import type { ChartTokens } from './chart-theme.types';
import type { ChartClickEvent, ChartInstance, ChartModule, ChartOption } from './chart.types';
import { buildChartTheme, frameChartOption } from './core/chart-theme-option';

/**
 * One ECharts chart, drawn as SVG in the brand's tokens.
 *
 * ```ts
 * import { Chart, ChartTheme } from '@ui/chart';
 * ```
 *
 * ```html
 * <lib-chart [option]="option()" [ariaLabel]="title" height="18rem" (chartClick)="open($event)" />
 * ```
 *
 * Build the option from `inject(ChartTheme).tokens()`. ECharts loads on the first render in
 * the browser, and the host keeps its height while it loads.
 */
@Component({
  selector: 'lib-chart',
  templateUrl: './chart.html',
  styleUrl: './chart.scss',
  host: {
    '[style.height]': 'height()',
    '[attr.data-ready]': 'instance() ? "" : null',
  },
})
export class Chart {
  /** The ECharts option. A new object replaces the old one whole. */
  readonly option = input.required<ChartOption>();

  /** The accessible name of the chart. Name what it shows, such as "Revenue per barber". */
  readonly ariaLabel = input.required<string>();

  /** The height of the host, as a CSS length. Reserved before ECharts loads. */
  readonly height = input('18rem');

  /** A click on a mark, with the ECharts params: series, data index, name and value. */
  readonly chartClick = output<ChartClickEvent>();

  /** The first draw is done. A consumer can drop its placeholder. */
  readonly ready = output();

  private readonly theme = inject(ChartTheme);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly load = inject(CHART_LOADER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scheduler = inject(ChartScheduler);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  protected readonly instance = signal<ChartInstance | null>(null);

  /** The tokens of the theme the instance draws with now. */
  private themed: ChartTokens | null = null;
  private observer: ResizeObserver | null = null;
  /** Drops the queued first draw. */
  private cancel: (() => void) | null = null;
  /** The option and the name the instance draws now, so the effect does not draw them twice. */
  private drawn: { option: ChartOption; label: string } | null = null;

  constructor() {
    afterNextRender(() => {
      void this.mount();
    });

    this.destroyRef.onDestroy(() => {
      this.cancel?.();
      this.observer?.disconnect();
      this.instance()?.dispose();
    });

    // Must be created before the theme effect. Effects run in creation order, and `setTheme`
    // does nothing until a `setOption` creates the ECharts model.
    effect(() => {
      const chart = this.instance();
      const option = this.option();
      const label = this.ariaLabel();
      if (!chart || (option === this.drawn?.option && label === this.drawn.label)) {
        return;
      }
      untracked(() => {
        this.draw(chart, option, label);
      });
    });

    effect(() => {
      const chart = this.instance();
      const tokens = this.theme.tokens();
      if (!chart || tokens === this.themed) {
        return;
      }
      this.themed = tokens;
      chart.setTheme(buildChartTheme(tokens));
    });
  }

  private async mount(): Promise<void> {
    let module: ChartModule;
    try {
      module = await this.load();
    } catch (error) {
      this.errorHandler.handleError(error);
      return;
    }
    if (this.destroyRef.destroyed) {
      return;
    }

    const host = this.host.nativeElement;
    const view = this.document.defaultView;
    if (view && typeof view.ResizeObserver === 'function') {
      this.observer = new view.ResizeObserver(() => {
        const chart = this.instance();
        if (chart) {
          chart.resize();
        } else {
          this.request(module);
        }
      });
      this.observer.observe(host);
    }
    this.request(module);
  }

  /** Queues the first draw. A host with no size waits for the resize observer. */
  private request(module: ChartModule): void {
    const host = this.host.nativeElement;
    if (
      this.instance() ||
      this.cancel ||
      this.destroyRef.destroyed ||
      host.clientWidth === 0 ||
      host.clientHeight === 0
    ) {
      return;
    }
    this.cancel = this.scheduler.schedule(() => {
      this.cancel = null;
      this.create(module);
    });
  }

  /**
   * Creates the instance and draws the first option. ECharts cannot measure a host with no
   * size, as in a tab that is not shown, so the resize observer queues it again later.
   */
  private create(module: ChartModule): void {
    const host = this.host.nativeElement;
    if (
      this.instance() ||
      this.destroyRef.destroyed ||
      host.clientWidth === 0 ||
      host.clientHeight === 0
    ) {
      return;
    }
    const tokens = this.theme.tokens();
    this.themed = tokens;
    const chart = module.createChart(this.canvas().nativeElement, buildChartTheme(tokens));
    chart.on('click', (params) => {
      this.chartClick.emit(params);
    });
    // The first option draws in the same task as the instance, so one chart costs one slot.
    this.draw(chart, this.option(), this.ariaLabel());
    this.instance.set(chart);
    this.ready.emit();
  }

  private draw(chart: ChartInstance, option: ChartOption, label: string): void {
    const framed = frameChartOption(option, {
      ariaLabel: label,
      // A theme change re-themes through `setTheme`. It must not set the option again.
      durationBase: this.theme.tokens().durationBase,
      reducedMotion: this.prefersReducedMotion(),
    });
    chart.setOption(framed, { notMerge: true });
    this.drawn = { option, label };
  }

  private prefersReducedMotion(): boolean {
    const view = this.document.defaultView;
    if (!view || typeof view.matchMedia !== 'function') {
      return false;
    }
    return view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

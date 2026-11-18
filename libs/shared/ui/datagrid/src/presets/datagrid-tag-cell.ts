import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { Tooltip } from '@ui/tooltip';
import { DatagridCellLayout } from '../core/cell-layout';
import { formatCellText } from '../core/format';
import type { CellContext } from '../core/types/context.types';
import { resolveTone, tagValues } from './export-visuals';
import { readPresetOptions } from './preset-options';
import type { TagSpec } from './preset.types';
import type { RenderedTag, TagMetrics } from './datagrid-tag-cell.types';
import { fitTagCount, readTagMetrics, tagWidth } from './tag-fit';

/** Shared, so a renderer written by hand allocates no options per cell. */
const NO_TAG_SPEC: TagSpec = {};

/**
 * The renderer behind {@link tagColumn}. Draws one tag per value, or several
 * when the cell value is an array.
 *
 * In a table, the tags that do not fit the column collapse into one `+n` tag, whose tooltip names
 * them. The fit is arithmetic over the column's declared width and the tags' text, so no cell is
 * observed (§22). In cards, the tags wrap and all of them show.
 *
 * Not intended to be written in a template: reach it through the factory, so
 * the options and the renderer stay one declaration.
 */
@Component({
  selector: 'lib-datagrid-tag-cell',
  template: `
    @for (tag of tags(); track $index) {
      <span
        class="dg-tag"
        [attr.data-tone]="tag.tone"
        [libTooltip]="tag.tooltip"
        [tooltipDisabled]="tag.tooltip === ''"
      >
        {{ tag.label }}
      </span>
    }
    @if (hidden() > 0) {
      <span class="dg-tag" data-tone="neutral" data-more [libTooltip]="hiddenLabels()">
        +{{ hidden() }}
      </span>
    }
  `,
  styleUrl: './datagrid-tag-cell.scss',
  imports: [Tooltip],
  host: {
    '[attr.data-wrap]': 'wraps() ? "" : null',
  },
})
export class DatagridTagCell<TRow = unknown> {
  /** The cell context every renderer receives. */
  readonly context = input.required<CellContext<TRow>>();

  private readonly layout = inject(DatagridCellLayout, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  private readonly spec = computed<TagSpec<TRow>>(() =>
    readPresetOptions<TagSpec<TRow>>(this.context().column, NO_TAG_SPEC),
  );

  /** The values this cell draws: an array cell draws one tag per entry. */
  private readonly values = computed(() => tagValues(this.context().displayValue));

  /** Every tag the column allows: `maxVisible` is a declared cap, the space is the other one. */
  private readonly allowed = computed<readonly RenderedTag[]>(() => {
    const { row, column } = this.context();
    const spec = this.spec();
    const max = spec.maxVisible ?? 0;
    const values = max > 0 ? this.values().slice(0, max) : this.values();
    return values.map((value) => ({
      label: spec.label ? spec.label(value, row) : formatCellText(value, column),
      tone: resolveTone(spec.tone, value, row),
      tooltip: spec.tooltip?.(value, row) ?? '',
    }));
  });

  /** Cards give a tag room to wrap, so nothing collapses there. */
  protected readonly wraps = computed(() => this.layout?.cards() ?? false);

  private readonly metricsKey = computed(() => `tag:${this.layout?.density() ?? ''}`);

  private readonly metrics = computed(
    () => (this.layout?.measured(this.metricsKey()) ?? null) as TagMetrics | null,
  );

  /** How many of the allowed tags fit the column. All of them until the grid can say. */
  private readonly fitting = computed(() => {
    const tags = this.allowed();
    const layout = this.layout;
    const metrics = this.metrics();
    if (layout === null || metrics === null || this.wraps() || tags.length < 2) return tags.length;
    const width = layout.widthOf(this.context().column.id);
    if (width === null) return tags.length;

    const version = layout.fontsVersion();
    const measure = (label: string): number | null =>
      tagWidth(label, metrics, this.document, version);
    const widths = tags.map((tag) => measure(tag.label));
    if (widths.some((entry) => entry === null)) return tags.length;
    return fitTagCount(
      widths as number[],
      width - metrics.cellPadding,
      metrics.gap,
      (hidden) => measure(`+${hidden.toString()}`) ?? 0,
    );
  });

  protected readonly tags = computed(() => this.allowed().slice(0, this.fitting()));

  protected readonly hidden = computed(() => this.values().length - this.tags().length);

  /** The collapsed tags, for the `+n` tag's tooltip. */
  protected readonly hiddenLabels = computed(() => {
    const { row, column } = this.context();
    const spec = this.spec();
    return this.values()
      .slice(this.tags().length)
      .map((value) => (spec.label ? spec.label(value, row) : formatCellText(value, column)))
      .join(', ');
  });

  constructor() {
    // The first cell of a grid and density to draw a tag reads the lengths every cell shares.
    afterRenderEffect({
      read: () => {
        const layout = this.layout;
        if (layout === null || this.wraps() || this.metrics() !== null) return;
        const host = this.host.nativeElement;
        const tag = host.querySelector<HTMLElement>('.dg-tag:not([data-more])');
        const cell = host.closest<HTMLElement>('.dg-cell');
        if (tag === null || cell === null) return;
        layout.record(this.metricsKey(), readTagMetrics(tag, host, cell));
      },
    });
  }
}

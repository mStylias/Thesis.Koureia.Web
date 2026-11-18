import { Component, computed, input } from '@angular/core';
import { Tooltip } from '@ui/tooltip';
import { formatCellText } from '../core/format';
import type { CellContext } from '../core/types/context.types';
import { readPresetOptions } from './preset-options';
import type { LinkSpec } from './preset.types';

/** Shared, and a link with no target renders as plain text. */
const NO_LINK: LinkSpec = { href: (): string => '' };

/**
 * The renderer behind {@link linkColumn}.
 *
 * A real `<a href>`, so middle-click, `Ctrl`-click and `Cmd`-click open a new
 * tab and the browser's own "copy link address" works. A click handler that
 * navigated instead would break all three, and the grid's own click handling
 * would otherwise select the row underneath — which is why the press stops
 * here.
 */
@Component({
  selector: 'lib-datagrid-link-cell',
  template: `
    @if (href(); as target) {
      <a
        class="dg-link"
        [href]="target"
        [attr.target]="spec().target || null"
        [attr.rel]="spec().target === '_blank' ? 'noopener' : null"
        [libTooltip]="tooltip()"
        [tooltipDisabled]="tooltip() === ''"
        (click)="$event.stopPropagation()"
      >
        {{ label() }}
      </a>
    } @else {
      {{ label() }}
    }
  `,
  styleUrl: './datagrid-link-cell.scss',
  imports: [Tooltip],
})
export class DatagridLinkCell<TRow = unknown> {
  /** The cell context every renderer receives. */
  readonly context = input.required<CellContext<TRow>>();

  protected readonly spec = computed<LinkSpec<TRow>>(() =>
    readPresetOptions<LinkSpec<TRow>>(this.context().column, NO_LINK),
  );

  /** Empty for a row with no target, which renders as plain text. */
  protected readonly href = computed(() => this.spec().href(this.context().row));

  protected readonly label = computed(() => {
    const { row, column, displayValue } = this.context();
    const spec = this.spec();
    return spec.label ? spec.label(displayValue, row) : formatCellText(displayValue, column);
  });

  protected readonly tooltip = computed(() => {
    const { row, displayValue } = this.context();
    return this.spec().tooltip?.(displayValue, row) ?? '';
  });
}

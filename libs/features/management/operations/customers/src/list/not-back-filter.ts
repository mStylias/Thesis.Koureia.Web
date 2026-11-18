import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { isConditionNode, where, type FilterNode } from '@ui/data-source';
import { Select, type SelectOption } from '@ui/select';

import { COLUMN } from '../customers.columns';
import type { NotBackDays, NotBackGrid } from './not-back-filter.types';

/** The choices, in days. */
export const NOT_BACK_DAYS = [30, 60, 90, 180] as const;

/**
 * The choice the grid's filters spell: `daysSinceLastVisit ≥ N` and `upcomingCount = 0` in the
 * filter row, and nothing else on those two columns. Anything else is no choice, so a filter
 * changed by hand leaves the select empty.
 */
export function readNotBack(grid: NotBackGrid): NotBackDays | null {
  const upcoming = grid.getColumnFilter(COLUMN.upcomingCount);
  if (!isCondition(upcoming, 'eq', 0)) return null;
  const days = grid.getColumnFilter(COLUMN.daysSinceLastVisit);
  return NOT_BACK_DAYS.find((choice) => isCondition(days, 'ge', choice)) ?? null;
}

/**
 * Writes a choice as two ordinary filter-row filters, so a saved view keeps it and Reset clears
 * it. A cleared choice clears both columns only when they hold one: a filter set by hand stays.
 */
export function writeNotBack(grid: NotBackGrid, days: NotBackDays | null): void {
  if (days === null) {
    if (readNotBack(grid) === null) return;
    grid.clearColumnFilter(COLUMN.daysSinceLastVisit);
    grid.clearColumnFilter(COLUMN.upcomingCount);
    return;
  }
  grid.setColumnFilter(COLUMN.daysSinceLastVisit, where('daysSinceLastVisit', 'ge', days));
  grid.setColumnFilter(COLUMN.upcomingCount, where('upcomingCount', 'eq', 0));
}

function isCondition(node: FilterNode | null, op: string, value: number): boolean {
  return node !== null && isConditionNode(node) && node.op === op && node.value === value;
}

/**
 * "Not back for N days", in the grid's toolbar. It shows what the grid's filters spell and writes
 * through the grid, so it holds no state of its own.
 */
@Component({
  selector: 'lib-customers-not-back-filter',
  imports: [Select, TranslocoPipe],
  template: `
    <span class="not-back-label" id="customers-not-back-label">
      {{ 'managementCustomers.notBack.label' | transloco }}
    </span>
    <lib-select
      size="sm"
      showClear
      ariaLabelledby="customers-not-back-label"
      [options]="options()"
      [value]="selected()"
      (valueChange)="onChange($event)"
    />
  `,
  styleUrl: './not-back-filter.scss',
})
export class NotBackFilter {
  private readonly transloco = inject(TranslocoService);

  /** The choice the grid's filters spell. `null` is no choice: every customer. */
  readonly value = input<NotBackDays | null>(null);
  /** The page language, so the option labels follow it. */
  readonly language = input.required<string>();

  readonly choose = output<NotBackDays | null>();

  /** Empty for "everyone". The × clears a choice. */
  protected readonly selected = computed(() => {
    const days = this.value();
    return days === null ? undefined : String(days);
  });

  protected readonly options = computed<readonly SelectOption<string>[]>(() => {
    this.language();
    return NOT_BACK_DAYS.map((count) => ({
      value: String(count),
      label: this.transloco.translate('managementCustomers.notBack.days', { count }),
    }));
  });

  protected onChange(value: string | undefined): void {
    const days = NOT_BACK_DAYS.find((choice) => String(choice) === value) ?? null;
    if (days !== this.value()) this.choose.emit(days);
  }
}

import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { AnalyticsComparison, AnalyticsGranularity } from '@api/analytics';
import { DateRangePicker, type DateRangeValue } from '@ui/date-range-picker';
import { Select, type SelectOption } from '@ui/select';
import { Tooltip } from '@ui/tooltip';

import {
  DASHBOARD_PRESETS,
  dashboardRangeValue,
  dayBucketAllowed,
  MAX_RANGE_DAYS,
  rangeChangePatch,
} from './dashboard-filters.query';
import type {
  DashboardFilterValues,
  DashboardQuery,
  DashboardQueryPatch,
  DashboardStaffMember,
} from './dashboard-filters.types';

/** The select value of "automatic": the API picks the bucket. */
const AUTO = 'auto';

/** The select value of "every barber". */
const ALL_STAFF = '';

let nextId = 0;

/**
 * The toolbar: the dates, the comparison, the bucket size and the barber, for everything on
 * the page. It only reports changes. The page writes them to the URL, which is the state.
 */
@Component({
  selector: 'lib-dashboard-filters',
  imports: [DateRangePicker, Select, Tooltip, TranslocoPipe],
  templateUrl: './dashboard-filters.html',
  styleUrl: './dashboard-filters.scss',
})
export class DashboardFilters {
  private readonly transloco = inject(TranslocoService);

  readonly query = input.required<DashboardQuery>();
  readonly filters = input.required<DashboardFilterValues>();
  /** The shop's barbers, inactive ones included. */
  readonly staff = input<readonly DashboardStaffMember[]>([]);
  /** The browser's today, `YYYY-MM-DD`. The presets end on it. */
  readonly today = input.required<string>();
  /** The active language. The labels are translated again when it changes. */
  readonly locale = input.required<string>();

  readonly queryChange = output<DashboardQueryPatch>();

  protected readonly presets = DASHBOARD_PRESETS;
  protected readonly maxDays = MAX_RANGE_DAYS;
  protected readonly ids = {
    range: `dashboard-range-${nextId}`,
    compare: `dashboard-compare-${nextId}`,
    compareHint: `dashboard-compare-hint-${nextId}`,
    granularity: `dashboard-granularity-${nextId}`,
    staff: `dashboard-staff-${nextId}`,
    staffHint: `dashboard-staff-hint-${nextId++}`,
  };

  protected readonly range = computed(() => dashboardRangeValue(this.filters()));

  /** The Team tab compares every barber, so the barber filter does not apply there. */
  protected readonly staffLocked = computed(() => this.query().tab === 'team');

  /** One barber has nothing to filter. */
  protected readonly staffShown = computed(() => this.staff().length > 1);

  protected readonly compareValue = computed<AnalyticsComparison>(
    () => this.query().compareTo ?? 'PreviousPeriod',
  );

  protected readonly compareOptions = computed<readonly SelectOption<AnalyticsComparison>[]>(() => {
    this.locale();
    return (['PreviousPeriod', 'PreviousYear'] as const).map((value) => ({
      value,
      label: this.translate(`compareTo.${value}`),
    }));
  });

  protected readonly granularityValue = computed<AnalyticsGranularity | typeof AUTO>(
    () => this.query().granularity ?? AUTO,
  );

  protected readonly granularityOptions = computed<
    readonly SelectOption<AnalyticsGranularity | typeof AUTO>[]
  >(() => {
    this.locale();
    const filters = this.filters();
    const dayAllowed = dayBucketAllowed(filters.from, filters.to);
    return [
      { value: AUTO, label: this.translate('granularity.auto') },
      ...(['Day', 'Week', 'Month'] as const).map((value) => ({
        value,
        label: this.translate(`granularity.${value}`),
        disabled: value === 'Day' && !dayAllowed,
      })),
    ];
  });

  protected readonly staffValue = computed(() => this.query().staff ?? ALL_STAFF);

  /** Every barber, then the active ones, then the inactive ones marked as such. */
  protected readonly staffOptions = computed<readonly SelectOption<string>[]>(() => {
    this.locale();
    const staff = this.staff();
    const option = (member: DashboardStaffMember): SelectOption<string> => ({
      value: member.id,
      label: member.isActive
        ? member.displayName
        : this.translate('toolbar.staffInactive', { name: member.displayName }),
    });
    return [
      { value: ALL_STAFF, label: this.translate('toolbar.staffAll') },
      ...staff.filter((member) => member.isActive).map(option),
      ...staff.filter((member) => !member.isActive).map(option),
    ];
  });

  protected onRange(value: DateRangeValue): void {
    const patch = rangeChangePatch(this.query(), value);
    if (patch !== null) this.queryChange.emit(patch);
  }

  protected onCompare(value: AnalyticsComparison | undefined): void {
    const next = value === undefined || value === 'PreviousPeriod' ? null : value;
    if (next !== this.query().compareTo) this.queryChange.emit({ compareTo: next });
  }

  protected onGranularity(value: AnalyticsGranularity | typeof AUTO | undefined): void {
    const next = value === undefined || value === AUTO ? null : value;
    if (next !== this.query().granularity) this.queryChange.emit({ granularity: next });
  }

  protected onStaff(value: string | undefined): void {
    if (this.staffLocked()) return;
    const next = value === undefined || value === ALL_STAFF ? null : value;
    if (next !== this.query().staff) this.queryChange.emit({ staff: next });
  }

  private translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`managementDashboard.${key}`, params);
  }
}

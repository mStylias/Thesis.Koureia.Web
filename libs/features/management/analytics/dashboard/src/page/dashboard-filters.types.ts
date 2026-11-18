import type { AnalyticsComparison, AnalyticsGranularity } from '@api/analytics';
import type { WorkspaceStaffMemberViewDto } from '@auth/data-access';

import type { DASHBOARD_TABS } from './dashboard-filters.query';

/** A tab of the dashboard, as the URL names it. */
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

/** The dashboard's state as the URL holds it, after every rule and default. */
export interface DashboardQuery {
  readonly tab: DashboardTab;
  /** A preset id, or `custom`. */
  readonly range: string;
  /** `YYYY-MM-DD`. Set only when `range` is `custom`. */
  readonly from: string | null;
  readonly to: string | null;
  /** `null` is the API default, the previous period. */
  readonly compareTo: AnalyticsComparison | null;
  /** `null` lets the API pick. */
  readonly granularity: AnalyticsGranularity | null;
  /** A staff member id. `null` for every barber. */
  readonly staff: string | null;
}

/** A change to the filters. The tab changes through its own navigation. */
export type DashboardQueryPatch = Partial<Omit<DashboardQuery, 'tab'>>;

/** The filters with the preset resolved to dates: what a read sends. */
export interface DashboardFilterValues {
  /** The preset id, or `null` for a custom range. */
  readonly preset: string | null;
  readonly from: string;
  readonly to: string;
  readonly compareTo: AnalyticsComparison | null;
  readonly granularity: AnalyticsGranularity | null;
  readonly staffMemberId: string | null;
}

/** What decoding the URL needs besides the parameters. */
export interface DashboardQueryContext {
  /** The browser's today, `YYYY-MM-DD`. */
  readonly today: string;
  /** The barbers of the shop. An id in the URL that is not here is dropped. */
  readonly staffIds: readonly string[];
}

/** The query parameters, one value each. A missing parameter is `undefined` or `null`. */
export type DashboardQueryParams = Readonly<Record<string, string | null | undefined>>;

/** The query parameters a navigation merges in. `null` removes one. */
export type DashboardQueryUpdate = Record<string, string | null>;

/** The barber of the toolbar, as `StaffAccessStore.staff()` gives it. */
export type DashboardStaffMember = WorkspaceStaffMemberViewDto;

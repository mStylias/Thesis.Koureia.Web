import type {
  AnalyticsQueryParameters,
  CustomersTabResponse,
  DemandTabResponse,
  LostBusinessTabResponse,
  QualityTabResponse,
  RevenueTabResponse,
  ServicesTabResponse,
  TeamTabResponse,
} from '@api/analytics';
import type { Result } from '@synax/client/core';
import type { Observable } from 'rxjs';

import type { DashboardTab } from './page/dashboard-filters.types';

/** The response of each tab. */
export interface DashboardTabResponses {
  readonly revenue: RevenueTabResponse;
  readonly demand: DemandTabResponse;
  readonly team: TeamTabResponse;
  readonly services: ServicesTabResponse;
  readonly customers: CustomersTabResponse;
  readonly lost: LostBusinessTabResponse;
  readonly quality: QualityTabResponse;
}

/**
 * One read of the store: the overview or a tab. `data` stays on screen while a new read runs,
 * so the charts dim instead of disappearing.
 */
export interface DashboardEntry<T> {
  /** The filters, language and shop of the read in flight or the last one. */
  readonly key: string;
  /** The last response. `null` until the first read lands. */
  readonly data: T | null;
  readonly loading: boolean;
  /** The last read failed. */
  readonly failed: boolean;
}

/** The entry of every tab read so far. */
export type DashboardTabEntries = {
  readonly [K in DashboardTab]?: DashboardEntry<DashboardTabResponses[K]>;
};

/** The `AnalyticsApi` call of one tab. */
export type DashboardTabLoader<K extends DashboardTab> = (
  query: AnalyticsQueryParameters,
) => Observable<Result<DashboardTabResponses[K]>>;

/** The browser's today as `YYYY-MM-DD`. A spec provides a fixed one. */
export type DashboardToday = () => string;

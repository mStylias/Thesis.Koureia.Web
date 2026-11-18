import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';

import type {
  AnalyticsQueryParameters,
  CustomersTabResponse,
  DemandTabResponse,
  LostBusinessTabResponse,
  OverviewTabResponse,
  QualityTabResponse,
  RevenueTabResponse,
  ServicesTabResponse,
  TeamTabResponse,
} from './analytics.types';

/**
 * The shop's numbers for the management dashboard: one call for each tab, with all the charts
 * of that tab.
 *
 * ```ts
 * const revenue = await firstValueFrom(api.revenue({ from: '2026-09-01', to: '2026-09-30' }));
 * ```
 *
 * The API resolves the shop from the signed-in user. Every call needs `analytics:read`. Failures
 * arrive as a failed `Result`, never as a thrown error.
 */
@Service()
export class AnalyticsApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** The six KPIs, each with its previous value, its change and a trend. */
  overview(query: AnalyticsQueryParameters): Observable<Result<OverviewTabResponse>> {
    return this.get<OverviewTabResponse>('overview', query);
  }

  /** Revenue over time, for each staff member and for each service. */
  revenue(query: AnalyticsQueryParameters): Observable<Result<RevenueTabResponse>> {
    return this.get<RevenueTabResponse>('revenue', query);
  }

  /** Statuses, the upcoming load, busy hours, lead time and booking source. */
  demand(query: AnalyticsQueryParameters): Observable<Result<DemandTabResponse>> {
    return this.get<DemandTabResponse>('demand', query);
  }

  /** Appointments, utilization and rating for each staff member. The API ignores `staffMemberId`. */
  team(query: AnalyticsQueryParameters): Observable<Result<TeamTabResponse>> {
    return this.get<TeamTabResponse>('team', query);
  }

  /** Bookings and revenue for each service. */
  services(query: AnalyticsQueryParameters): Observable<Result<ServicesTabResponse>> {
    return this.get<ServicesTabResponse>('services', query);
  }

  /** New and returning customers, days between visits and the top customers. */
  customers(query: AnalyticsQueryParameters): Observable<Result<CustomersTabResponse>> {
    return this.get<CustomersTabResponse>('customers', query);
  }

  /** The status mix, the lost rate over time and who cancelled. */
  lostBusiness(query: AnalyticsQueryParameters): Observable<Result<LostBusinessTabResponse>> {
    return this.get<LostBusinessTabResponse>('lost-business', query);
  }

  /** The rating over time and the spread of the ratings. */
  quality(query: AnalyticsQueryParameters): Observable<Result<QualityTabResponse>> {
    return this.get<QualityTabResponse>('quality', query);
  }

  private get<T>(tab: string, query: AnalyticsQueryParameters): Observable<Result<T>> {
    return this.http
      .get<T>(`${this.url(`analytics/${tab}`)}?${toQueryString(query)}`)
      .pipe(toResult<T>());
  }
}

/** Sends `from` and `to` always, and every other field only when it has a value. */
function toQueryString(query: AnalyticsQueryParameters): string {
  const optional = {
    granularity: query.granularity,
    compareTo: query.compareTo,
    staffMemberId: query.staffMemberId,
    languageCode: query.languageCode,
  };
  const pairs: [string, string][] = [
    ['from', query.from],
    ['to', query.to],
    ...Object.entries(optional).filter((pair): pair is [string, string] => !!pair[1]),
  ];
  return pairs.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&');
}

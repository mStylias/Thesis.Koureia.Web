import type { AnalyticsQueryParameters } from '@api/analytics';
import type { Result } from '@synax/client/core';
import type { Subject } from 'rxjs';

/** One call of a fake `AnalyticsApi`: its method, its query, and the subject that answers it. */
export interface FakeApiCall {
  readonly method: string;
  readonly query: AnalyticsQueryParameters;
  readonly response: Subject<Result<unknown>>;
}

/** An ECharts tooltip formatter, as a spec calls it. */
export type TooltipFormatter = (params: unknown) => string;

/** The loading placeholder a chart card draws, as a tab spec reads it. */
export interface CardSkeletonView {
  /** The `lib-chart-skeleton` kind, or `table`. */
  readonly kind: string;
  /** The skeleton's `count`. The body rows of a `table`. */
  readonly count: number | undefined;
  /** The skeleton's height. Empty for a `table`. */
  readonly height: string;
  /** The legend stubs beside the heading. */
  readonly legend: number;
}

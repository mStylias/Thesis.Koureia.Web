import type {
  AnalyticsAxisItemViewDto,
  AnalyticsGranularity,
  AnalyticsUnit,
  KpiViewDto,
  OverviewTabResponse,
} from '@api/analytics';

/** `TranslocoService.translate`, as the pure helpers take it. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** One KPI of the overview response. */
export type KpiId = Exclude<keyof OverviewTabResponse, 'period'>;

/** What `createAnalyticsFormat` needs. */
export interface AnalyticsFormatOptions {
  /** A BCP 47 tag: the active Transloco language. */
  readonly locale: string;
  /** ISO 4217, from `period.currency`. */
  readonly currency: string;
  readonly translate: Translate;
}

/** Which way a KPI moved. `none` when there is nothing to compare with. */
export type KpiDirection = 'up' | 'down' | 'flat' | 'none';

/** Whether the move is good for the shop. */
export type KpiTone = 'good' | 'bad' | 'neutral';

/** A KPI change as the tile shows it. */
export interface KpiChange {
  /** `+12%`, `-3%`, `+1,2 μ.`, or `—`. */
  readonly text: string;
  readonly direction: KpiDirection;
  readonly tone: KpiTone;
}

/** Every number and date the dashboard shows, in one locale and one currency. */
export interface AnalyticsFormat {
  readonly locale: string;
  readonly currency: string;
  /** A value by its unit, as a tile or a table shows it. `—` for `null`. */
  value(value: number | null | undefined, unit: AnalyticsUnit): string;
  /** As `value`, and a rating gets its `★`. */
  tooltip(value: number | null | undefined, unit: AnalyticsUnit): string;
  /** A short tick label: money and counts compact, percent and rating without decimals to spare. */
  axis(value: number, unit: AnalyticsUnit): string;
  /** `12 Σεπ`, from `YYYY-MM-DD`. */
  date(day: string): string;
  /** `8–14 Σεπ`, or one date when both ends are the same day. */
  span(from: string, to: string): string;
  /** `7 Ιουλ – 4 Οκτ 2025`: a span with its year, for dates that can be in another year. */
  period(from: string, to: string): string;
  /** A time bucket: a day, a week as a span, a whole month as `Σεπ 2026`. A cut bucket shows its dates. */
  bucket(item: AnalyticsAxisItemViewDto, granularity: AnalyticsGranularity | null): string;
  /** A range bucket in days: `Ίδια ημέρα`, `2–3 ημέρες`, `31+ ημέρες`. */
  range(item: AnalyticsAxisItemViewDto): string;
  /** An hour key `"9"` as `09:00`. */
  hour(key: string): string;
  /** An ISO weekday, 1 to 7, as `Δευ`. */
  weekday(iso: number | string): string;
  /** Minutes as hours with at most one decimal, without a unit: `31`, `40,5`. */
  hours(minutes: number): string;
  /** The change badge of a KPI tile. `lostRate` changes in percentage points. */
  change(kpi: KpiViewDto, id: KpiId): KpiChange;
}

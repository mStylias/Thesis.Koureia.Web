/** Enums travel in PascalCase, in both directions. */
export type AnalyticsAxisKind = 'Time' | 'Category' | 'Range';

/** A week runs from Monday to Sunday. */
export type AnalyticsGranularity = 'Day' | 'Week' | 'Month';

/**
 * `PreviousPeriod`: the same number of days, up to the day before the range starts.
 * `PreviousYear`: the same dates one year before.
 */
export type AnalyticsComparison = 'PreviousPeriod' | 'PreviousYear';

/** `Money` is in `AnalyticsPeriodViewDto.currency`. A `Percent` is 0 to 100. */
export type AnalyticsUnit = 'Count' | 'Money' | 'Percent' | 'Minutes' | 'Rating';

/**
 * One point on an axis. `label` is set only for a name from the database. For a fixed value,
 * translate `key`. A parent item holds the sum of its children.
 */
export interface AnalyticsAxisItemViewDto {
  readonly key: string;
  readonly label: string | null;
  readonly parentKey: string | null;
  /** Range axis bounds, inclusive. A `null` `to` has no end. */
  readonly from: number | null;
  readonly to: number | null;
  /** Time axis: the first and last day of the bucket, `YYYY-MM-DD`, cut to the range. */
  readonly fromDate: string | null;
  readonly toDate: string | null;
}

export interface AnalyticsAxisViewDto {
  readonly kind: AnalyticsAxisKind;
  /** Time axis only. */
  readonly granularity: AnalyticsGranularity | null;
  readonly items: readonly AnalyticsAxisItemViewDto[];
}

/** One value for each axis item, in axis order. `null` means no data, which is not `0`. */
export interface AnalyticsSeriesViewDto {
  readonly key: string;
  readonly unit: AnalyticsUnit;
  readonly values: readonly (number | null)[];
}

/** The data of one chart: an axis and the series on it. It does not say how to draw them. */
export interface SeriesSetViewDto {
  readonly axis: AnalyticsAxisViewDto;
  readonly series: readonly AnalyticsSeriesViewDto[];
}

export interface KpiViewDto {
  readonly unit: AnalyticsUnit;
  readonly value: number | null;
  readonly previousValue: number | null;
  /** A ratio: `0.12` is +12 %. `null` when a value is `null` or the previous value is `0`. */
  readonly change: number | null;
  /** One series, key `value`. */
  readonly trend: SeriesSetViewDto;
}

/** What the numbers cover after the defaults. Dates are `YYYY-MM-DD`. */
export interface AnalyticsPeriodViewDto {
  readonly from: string;
  readonly to: string;
  /** The granularity that the API used. */
  readonly granularity: AnalyticsGranularity;
  readonly comparison: AnalyticsComparison;
  readonly comparisonFrom: string;
  readonly comparisonTo: string;
  readonly currency: string;
}

/** The six KPIs. */
export interface OverviewTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly revenue: KpiViewDto;
  readonly appointments: KpiViewDto;
  readonly averageTicket: KpiViewDto;
  readonly uniqueCustomers: KpiViewDto;
  readonly lostRate: KpiViewDto;
  readonly averageRating: KpiViewDto;
}

export interface RevenueTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly revenueOverTime: SeriesSetViewDto;
  readonly revenuePerStaff: SeriesSetViewDto;
  readonly revenuePerService: SeriesSetViewDto;
}

export interface DemandTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly appointmentsByStatus: SeriesSetViewDto;
  readonly upcomingLoad: SeriesSetViewDto;
  readonly busiestHours: SeriesSetViewDto;
  readonly busyHeatmap: SeriesSetViewDto;
  readonly bookingLeadTime: SeriesSetViewDto;
  readonly bookingSource: SeriesSetViewDto;
}

/** The API ignores the staff filter on this tab. */
export interface TeamTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly appointmentsPerStaff: SeriesSetViewDto;
  readonly staffUtilization: SeriesSetViewDto;
  readonly ratingPerStaff: SeriesSetViewDto;
}

export interface ServicesTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly bookingsPerService: SeriesSetViewDto;
  readonly revenuePerService: SeriesSetViewDto;
}

export interface CustomersTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly newVsReturning: SeriesSetViewDto;
  readonly daysBetweenVisits: SeriesSetViewDto;
  readonly topCustomers: SeriesSetViewDto;
}

export interface LostBusinessTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly statusMix: SeriesSetViewDto;
  readonly lostRateOverTime: SeriesSetViewDto;
  readonly cancelledBy: SeriesSetViewDto;
}

export interface QualityTabResponse {
  readonly period: AnalyticsPeriodViewDto;
  readonly ratingOverTime: SeriesSetViewDto;
  readonly ratingDistribution: SeriesSetViewDto;
}

/**
 * The query string of every tab. Dates are `YYYY-MM-DD`, both inclusive. An absent or `null`
 * field is not sent, and the API applies its default.
 */
export interface AnalyticsQueryParameters {
  readonly from: string;
  readonly to: string;
  /** Absent: the API picks one from the length of the range. */
  readonly granularity?: AnalyticsGranularity | null;
  /** Absent: `PreviousPeriod`. */
  readonly compareTo?: AnalyticsComparison | null;
  /** Absent: every staff member. */
  readonly staffMemberId?: string | null;
  /** Names services and categories. */
  readonly languageCode?: string | null;
}

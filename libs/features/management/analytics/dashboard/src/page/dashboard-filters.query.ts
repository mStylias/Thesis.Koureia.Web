import type { AnalyticsComparison, AnalyticsGranularity } from '@api/analytics';
import { parseIsoDate } from '@ui/date-picker';
import {
  countRangeDays,
  DATE_RANGE_PRESETS,
  type DateRangePreset,
  type DateRangeValue,
  resolveDateRangePreset,
} from '@ui/date-range-picker';

import type {
  DashboardFilterValues,
  DashboardQuery,
  DashboardQueryContext,
  DashboardQueryParams,
  DashboardQueryPatch,
  DashboardQueryUpdate,
} from './dashboard-filters.types';

/** The tabs in the order the page shows them. The first is the default. */
export const DASHBOARD_TABS = [
  'revenue',
  'demand',
  'team',
  'services',
  'customers',
  'lost',
  'quality',
] as const;

/** The presets the toolbar offers, in its order. Each ends today. */
export const DASHBOARD_PRESET_IDS = [
  'last7',
  'last30',
  'last90',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'last12Months',
] as const;

export const DASHBOARD_PRESETS: readonly DateRangePreset[] = DASHBOARD_PRESET_IDS.flatMap(
  (id) => DATE_RANGE_PRESETS.find((preset) => preset.id === id) ?? [],
);

/** The `range` value of dates picked or typed by hand. */
export const CUSTOM_RANGE = 'custom';

export const DEFAULT_RANGE = 'last30';

/** The API's limit, both ends counted. */
export const MAX_RANGE_DAYS = 731;

/** The longest range the API splits into days. */
export const MAX_DAY_BUCKET_DAYS = 92;

/** Every query parameter the dashboard owns. Other parameters are left alone. */
export const DASHBOARD_PARAMS = [
  'tab',
  'range',
  'from',
  'to',
  'compareTo',
  'granularity',
  'staff',
] as const;

const COMPARISONS: readonly AnalyticsComparison[] = ['PreviousPeriod', 'PreviousYear'];
const GRANULARITIES: readonly AnalyticsGranularity[] = ['Day', 'Week', 'Month'];

function isCanonicalDate(value: string | null | undefined): value is string {
  return !!value && parseIsoDate(value) !== undefined;
}

/** Whether the API accepts day buckets for this range. */
export function dayBucketAllowed(from: string, to: string): boolean {
  const days = countRangeDays(from, to);
  return days > 0 && days <= MAX_DAY_BUCKET_DAYS;
}

/**
 * The URL's parameters as the dashboard's state. Every value that breaks a rule falls back to
 * its default: an unknown tab or preset, a custom range that is not real or is longer than
 * {@link MAX_RANGE_DAYS}, day buckets over {@link MAX_DAY_BUCKET_DAYS} days, a barber who is not
 * in the shop.
 */
export function decodeDashboardQuery(
  params: DashboardQueryParams,
  context: DashboardQueryContext,
): DashboardQuery {
  const tab = (DASHBOARD_TABS as readonly string[]).includes(params['tab'] ?? '')
    ? (params['tab'] as DashboardQuery['tab'])
    : DASHBOARD_TABS[0];

  let range = DEFAULT_RANGE;
  let from: string | null = null;
  let to: string | null = null;
  const requested = params['range'] ?? '';
  if (requested === CUSTOM_RANGE) {
    const start = params['from'];
    const end = params['to'];
    if (isCanonicalDate(start) && isCanonicalDate(end)) {
      const days = countRangeDays(start, end);
      if (days >= 1 && days <= MAX_RANGE_DAYS) {
        range = CUSTOM_RANGE;
        from = start;
        to = end;
      }
    }
  } else if ((DASHBOARD_PRESET_IDS as readonly string[]).includes(requested)) {
    range = requested;
  }

  // The default comparison is the API's own, so it is never written.
  const compareTo = COMPARISONS.includes(params['compareTo'] as AnalyticsComparison)
    ? (params['compareTo'] as AnalyticsComparison)
    : null;

  let granularity = GRANULARITIES.includes(params['granularity'] as AnalyticsGranularity)
    ? (params['granularity'] as AnalyticsGranularity)
    : null;

  const query: DashboardQuery = {
    tab,
    range,
    from,
    to,
    compareTo: compareTo === 'PreviousPeriod' ? null : compareTo,
    granularity,
    staff: context.staffIds.includes(params['staff'] ?? '') ? (params['staff'] ?? null) : null,
  };

  if (granularity === 'Day') {
    const dates = resolveDashboardFilters(query, context.today);
    if (!dayBucketAllowed(dates.from, dates.to)) granularity = null;
  }
  return granularity === query.granularity ? query : { ...query, granularity };
}

/**
 * The query as URL parameters. A default is `null`, so a merge navigation removes it, and the
 * address of the default view is the bare path.
 */
export function encodeDashboardQuery(query: DashboardQuery): DashboardQueryUpdate {
  const custom = query.range === CUSTOM_RANGE;
  return {
    tab: query.tab === DASHBOARD_TABS[0] ? null : query.tab,
    range: query.range === DEFAULT_RANGE ? null : query.range,
    from: custom ? query.from : null,
    to: custom ? query.to : null,
    compareTo: query.compareTo,
    granularity: query.granularity,
    staff: query.staff,
  };
}

/**
 * The parameters that must change for the URL to show `query`, or `null` when it already
 * does. A navigation with them uses `replaceUrl`, so the refused address leaves no history.
 */
export function dashboardQueryRewrite(
  params: DashboardQueryParams,
  query: DashboardQuery,
): DashboardQueryUpdate | null {
  const canonical = encodeDashboardQuery(query);
  const changed = DASHBOARD_PARAMS.filter((name) => (params[name] ?? null) !== canonical[name]);
  return changed.length === 0
    ? null
    : Object.fromEntries(changed.map((name) => [name, canonical[name]]));
}

/** The dates a query covers on `today`. A preset is resolved again on each call. */
export function resolveDashboardFilters(
  query: DashboardQuery,
  today: string,
): DashboardFilterValues {
  const dates =
    query.range === CUSTOM_RANGE && query.from !== null && query.to !== null
      ? { preset: null, from: query.from, to: query.to }
      : (resolveDateRangePreset(DASHBOARD_PRESETS, query.range, today) ??
        resolveDateRangePreset(DASHBOARD_PRESETS, DEFAULT_RANGE, today) ?? {
          preset: DEFAULT_RANGE,
          from: today,
          to: today,
        });
  return {
    preset: dates.preset,
    from: dates.from,
    to: dates.to,
    compareTo: query.compareTo,
    granularity: query.granularity,
    staffMemberId: query.staff,
  };
}

/** The picker's value for a query. */
export function dashboardRangeValue(filters: DashboardFilterValues): DateRangeValue {
  return { preset: filters.preset, from: filters.from, to: filters.to };
}

/**
 * The patch for a new picker value, or `null` when the picker refused the text and emptied the
 * value: the dashboard keeps its last filters. Day buckets fall back to automatic when the new
 * range is too long for them.
 */
export function rangeChangePatch(
  query: DashboardQuery,
  value: DateRangeValue,
): DashboardQueryPatch | null {
  if (!isCanonicalDate(value.from) || !isCanonicalDate(value.to)) return null;
  const preset =
    value.preset !== null && (DASHBOARD_PRESET_IDS as readonly string[]).includes(value.preset)
      ? value.preset
      : null;
  const patch: DashboardQueryPatch =
    preset !== null
      ? { range: preset, from: null, to: null }
      : { range: CUSTOM_RANGE, from: value.from, to: value.to };
  return query.granularity === 'Day' && !dayBucketAllowed(value.from, value.to)
    ? { ...patch, granularity: null }
    : patch;
}

/** The same filters, compared field by field. */
export function sameFilters(a: DashboardFilterValues, b: DashboardFilterValues): boolean {
  return (
    a.preset === b.preset &&
    a.from === b.from &&
    a.to === b.to &&
    a.compareTo === b.compareTo &&
    a.granularity === b.granularity &&
    a.staffMemberId === b.staffMemberId
  );
}

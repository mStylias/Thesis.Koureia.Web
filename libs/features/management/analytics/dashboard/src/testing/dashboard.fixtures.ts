import type {
  AnalyticsAxisItemViewDto,
  AnalyticsGranularity,
  AnalyticsPeriodViewDto,
  AnalyticsUnit,
  SeriesSetViewDto,
} from '@api/analytics';
import type { ChartTokens } from '@ui/chart';

import { createAnalyticsFormat } from '../analytics.format';
import type { ChartContext } from '../charts/options/chart-options.types';
import el from '../i18n/el';

/**
 * Plain tokens for specs. Each color is its token's name, so an assertion reads which token a
 * builder chose.
 */
export const TEST_TOKENS: ChartTokens = {
  scheme: 'light',
  textPrimary: 'text-primary',
  textSecondary: 'text-secondary',
  textMuted: 'text-muted',
  border: 'border',
  borderSubtle: 'border-subtle',
  borderStrong: 'border-strong',
  surface: 'surface',
  surfaceOverlay: 'surface-overlay',
  surfaceSunken: 'surface-sunken',
  accent: 'accent',
  swatches: ['swatch-1', 'swatch-2', 'swatch-3', 'swatch-4', 'swatch-5', 'swatch-6'],
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
  fontSans: 'sans',
  fontMono: 'mono',
  durationBase: 180,
};

export const TEST_PERIOD: AnalyticsPeriodViewDto = {
  from: '2026-07-07',
  to: '2026-10-04',
  granularity: 'Week',
  comparison: 'PreviousPeriod',
  comparisonFrom: '2026-04-08',
  comparisonTo: '2026-07-06',
  currency: 'EUR',
};

/**
 * The page's Greek dictionary, with `{{ name }}` filled in. A key of another scope comes back
 * as itself, as Transloco answers a missing key.
 */
export function testTranslate(key: string, params?: Record<string, unknown>): string {
  const [scope, ...path] = key.split('.');
  if (scope !== 'managementDashboard') return key;
  let node: unknown = el;
  for (const part of path) {
    node =
      typeof node === 'object' && node !== null
        ? (node as Record<string, unknown>)[part]
        : undefined;
  }
  if (typeof node !== 'string') return key;
  return node.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => {
    const value = params?.[name];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  });
}

/** A context in Greek and euros over {@link TEST_PERIOD}. */
export function testContext(period: Partial<AnalyticsPeriodViewDto> = {}): ChartContext {
  const full = { ...TEST_PERIOD, ...period };
  return {
    tokens: TEST_TOKENS,
    t: testTranslate,
    format: createAnalyticsFormat({
      locale: 'el',
      currency: full.currency,
      translate: testTranslate,
    }),
    period: full,
    locale: 'el',
  };
}

/** An axis item with only the fields given. */
export function axisItem(
  item: Partial<AnalyticsAxisItemViewDto> & { key: string },
): AnalyticsAxisItemViewDto {
  return {
    label: null,
    parentKey: null,
    from: null,
    to: null,
    fromDate: null,
    toDate: null,
    ...item,
  };
}

/** A time set over the given buckets, one series per entry of `series`. */
export function timeSet(
  buckets: readonly (readonly [string, string])[],
  series: Readonly<Record<string, readonly (number | null)[]>>,
  unit: AnalyticsUnit = 'Money',
  granularity: AnalyticsGranularity = 'Week',
): SeriesSetViewDto {
  return {
    axis: {
      kind: 'Time',
      granularity,
      items: buckets.map(([fromDate, toDate]) => axisItem({ key: fromDate, fromDate, toDate })),
    },
    series: Object.entries(series).map(([key, values]) => ({ key, unit, values })),
  };
}

/** A category set over the given items. */
export function categorySet(
  items: readonly Partial<AnalyticsAxisItemViewDto>[],
  series: Readonly<Record<string, readonly (number | null)[]>>,
  units: Readonly<Record<string, AnalyticsUnit>> = {},
): SeriesSetViewDto {
  return {
    axis: {
      kind: 'Category',
      granularity: null,
      items: items.map((item, index) => axisItem({ key: `item-${index}`, ...item })),
    },
    series: Object.entries(series).map(([key, values]) => ({
      key,
      unit: units[key] ?? 'Count',
      values,
    })),
  };
}

/** Intl puts a no-break space between a number and its unit. A spec compares plain spaces. */
export function plainText(text: string | null | undefined): string {
  return (text ?? '').replace(/[\u00a0\u202f]/g, ' ');
}

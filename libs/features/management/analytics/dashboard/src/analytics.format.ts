import type {
  AnalyticsAxisItemViewDto,
  AnalyticsGranularity,
  AnalyticsUnit,
  KpiViewDto,
} from '@api/analytics';

import type {
  AnalyticsFormat,
  AnalyticsFormatOptions,
  KpiChange,
  KpiId,
} from './analytics.format.types';

/** What a missing value shows. */
export const NO_VALUE = '—';

const DAY_MS = 86_400_000;

/** A `YYYY-MM-DD` as a UTC midnight, so the browser's zone cannot move it a day. */
function utcDay(day: string): Date | null {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function lastDayOfMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Every number and date of the dashboard in one locale and currency. */
export function createAnalyticsFormat(options: AnalyticsFormatOptions): AnalyticsFormat {
  const { locale, currency, translate } = options;
  const t = (key: string, params?: Record<string, unknown>): string =>
    translate(`managementDashboard.${key}`, params);

  const number = (digits: number, extra: Intl.NumberFormatOptions = {}): Intl.NumberFormat =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      ...extra,
    });
  const moneyWhole = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  const moneyCents = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const moneyCompact = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const count = number(0);
  const countCompact = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const percent = number(1, { style: 'percent' });
  const percentWhole = number(0, { style: 'percent' });
  const rating = number(1);
  const oneDecimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const signedPercent = number(0, { style: 'percent', signDisplay: 'exceptZero' });
  const signedPoints = number(1, { signDisplay: 'exceptZero' });
  const day = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const dayWithYear = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const month = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const money = (value: number): string =>
    // Whole amounts drop the cents: 1.189 €, but 21,23 €.
    Math.round(value * 100) % 100 === 0 ? moneyWhole.format(value) : moneyCents.format(value);

  const minutes = (value: number): string => {
    const total = Math.round(value);
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (hours === 0) return t('units.minutes', { count: rest });
    if (rest === 0) return t('units.hours', { count: count.format(hours) });
    return t('units.hoursAndMinutes', { hours: count.format(hours), minutes: rest });
  };

  const value = (input: number | null | undefined, unit: AnalyticsUnit): string => {
    if (input === null || input === undefined || !Number.isFinite(input)) return NO_VALUE;
    switch (unit) {
      case 'Money':
        return money(input);
      case 'Percent':
        // The API sends 0 to 100.
        return percent.format(input / 100);
      case 'Minutes':
        return minutes(input);
      case 'Rating':
        return rating.format(input);
      default:
        return count.format(input);
    }
  };

  const date = (input: string): string => {
    const parsed = utcDay(input);
    return parsed === null ? input : day.format(parsed);
  };

  const span = (from: string, to: string): string => {
    const start = utcDay(from);
    const end = utcDay(to);
    if (start === null || end === null) return from === to ? from : `${from} – ${to}`;
    return start.getTime() === end.getTime() ? day.format(start) : day.formatRange(start, end);
  };

  const period = (from: string, to: string): string => {
    const start = utcDay(from);
    const end = utcDay(to);
    if (start === null || end === null) return span(from, to);
    return start.getTime() === end.getTime()
      ? dayWithYear.format(start)
      : dayWithYear.formatRange(start, end);
  };

  return {
    locale,
    currency,
    value,
    period,
    tooltip: (input, unit) =>
      unit === 'Rating' && input !== null && input !== undefined
        ? t('units.stars', { value: value(input, unit) })
        : value(input, unit),
    axis: (input, unit) => {
      switch (unit) {
        case 'Money':
          return moneyCompact.format(input);
        case 'Percent':
          return percentWhole.format(input / 100);
        case 'Minutes':
          return t('units.hours', { count: oneDecimal.format(input / 60) });
        case 'Rating':
          return oneDecimal.format(input);
        default:
          return countCompact.format(input);
      }
    },
    date,
    span,
    bucket: (item, granularity) => bucketLabel(item, granularity, { date, span, month }),
    range: (item) => {
      if (item.from === null) return item.label ?? item.key;
      if (item.to === null) return t('ranges.open', { from: item.from });
      if (item.from === item.to) {
        if (item.from === 0) return t('ranges.sameDay');
        if (item.from === 1) return t('ranges.oneDay');
        return t('ranges.days', { count: item.from });
      }
      return t('ranges.span', { from: item.from, to: item.to });
    },
    hour: (key) => `${key.padStart(2, '0')}:00`,
    weekday: (iso) => t(`weekdays.${iso}`),
    hours: (input) => oneDecimal.format(input / 60),
    change: (kpi, id) => kpiChange(kpi, id, { signedPercent, signedPoints, t }),
  };
}

function bucketLabel(
  item: AnalyticsAxisItemViewDto,
  granularity: AnalyticsGranularity | null,
  format: {
    readonly date: (day: string) => string;
    readonly span: (from: string, to: string) => string;
    readonly month: Intl.DateTimeFormat;
  },
): string {
  const from = item.fromDate ?? item.key;
  const to = item.toDate ?? from;
  if (granularity === 'Month') {
    const start = utcDay(from);
    const end = utcDay(to);
    // A whole month reads as the month. A cut one shows its real dates.
    if (
      start !== null &&
      end !== null &&
      start.getUTCDate() === 1 &&
      end.getUTCDate() === lastDayOfMonth(start) &&
      end.getTime() - start.getTime() < 31 * DAY_MS
    ) {
      return format.month.format(start);
    }
  }
  return from === to ? format.date(from) : format.span(from, to);
}

function kpiChange(
  kpi: KpiViewDto,
  id: KpiId,
  format: {
    readonly signedPercent: Intl.NumberFormat;
    readonly signedPoints: Intl.NumberFormat;
    readonly t: (key: string, params?: Record<string, unknown>) => string;
  },
): KpiChange {
  // A rise in the lost rate is bad. Every other KPI is better higher.
  const upIsGood = id !== 'lostRate';
  let delta: number;
  let text: string;

  if (id === 'lostRate') {
    // A percent of a percent misleads, so the rate moves in percentage points.
    if (kpi.value === null || kpi.previousValue === null) return none();
    delta = Math.round((kpi.value - kpi.previousValue) * 10) / 10;
    text = format.t('kpis.points', { value: format.signedPoints.format(delta) });
  } else {
    if (kpi.change === null) return none();
    delta = Math.round(kpi.change * 100);
    text = format.signedPercent.format(delta / 100);
  }

  if (delta === 0) return { text, direction: 'flat', tone: 'neutral' };
  const direction = delta > 0 ? 'up' : 'down';
  return { text, direction, tone: delta > 0 === upIsGood ? 'good' : 'bad' };
}

function none(): KpiChange {
  return { text: NO_VALUE, direction: 'none', tone: 'neutral' };
}

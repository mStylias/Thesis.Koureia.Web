import type { KpiViewDto } from '@api/analytics';

import { createAnalyticsFormat, NO_VALUE } from './analytics.format';
import { axisItem, plainText as plain, testTranslate, timeSet } from './testing/dashboard.fixtures';

const el = createAnalyticsFormat({ locale: 'el', currency: 'EUR', translate: testTranslate });
const en = createAnalyticsFormat({ locale: 'en', currency: 'EUR', translate: testTranslate });

function kpi(
  value: number | null,
  previousValue: number | null,
  change: number | null,
): KpiViewDto {
  return { unit: 'Count', value, previousValue, change, trend: timeSet([], {}) };
}

describe('createAnalyticsFormat', () => {
  describe('units', () => {
    it('shows money in the currency, and drops the cents of a whole amount', () => {
      expect(plain(el.value(1189, 'Money'))).toBe('1.189 €');
      expect(plain(el.value(21.23, 'Money'))).toBe('21,23 €');
      expect(plain(el.value(323.5, 'Money'))).toBe('323,50 €');
      expect(plain(en.value(1189, 'Money'))).toBe('€1,189');
    });

    it('groups a count and shows no decimals', () => {
      expect(el.value(1234, 'Count')).toBe('1.234');
    });

    it('reads a percent as 0 to 100, with one decimal', () => {
      expect(el.value(4, 'Percent')).toBe('4,0%');
      expect(el.value(13.56, 'Percent')).toBe('13,6%');
    });

    it('shows minutes as hours and minutes', () => {
      expect(el.value(330, 'Minutes')).toBe('5 ώ. 30 λ.');
      expect(el.value(120, 'Minutes')).toBe('2 ώ.');
      expect(el.value(45, 'Minutes')).toBe('45 λ.');
    });

    it('shows a rating with one decimal, and the star in a tooltip', () => {
      expect(el.value(4.42, 'Rating')).toBe('4,4');
      expect(el.tooltip(4.42, 'Rating')).toBe('4,4 ★');
    });

    it('shows a dash for null and keeps zero', () => {
      expect(el.value(null, 'Money')).toBe(NO_VALUE);
      expect(el.tooltip(null, 'Rating')).toBe(NO_VALUE);
      expect(el.value(0, 'Count')).toBe('0');
    });

    it('makes money compact on an axis', () => {
      expect(plain(el.axis(1200, 'Money'))).toBe('1,2 χιλ. €');
      expect(el.axis(40, 'Percent')).toBe('40%');
    });
  });

  describe('time labels', () => {
    it('shows a day, a week as a span, and a whole month as its name', () => {
      const day = axisItem({ key: 'd', fromDate: '2026-09-12', toDate: '2026-09-12' });
      const week = axisItem({ key: 'w', fromDate: '2026-09-08', toDate: '2026-09-14' });
      const month = axisItem({ key: 'm', fromDate: '2026-09-01', toDate: '2026-09-30' });
      expect(el.bucket(day, 'Day')).toBe('12 Σεπ');
      expect(el.bucket(week, 'Week')).toBe('8–14 Σεπ');
      expect(el.bucket(month, 'Month')).toBe('Σεπ 2026');
    });

    it('shows the real dates of a cut bucket', () => {
      const cutWeek = axisItem({ key: 'w', fromDate: '2026-07-07', toDate: '2026-07-12' });
      const cutMonth = axisItem({ key: 'm', fromDate: '2026-09-15', toDate: '2026-09-30' });
      const across = axisItem({ key: 'x', fromDate: '2026-09-28', toDate: '2026-10-04' });
      expect(el.bucket(cutWeek, 'Week')).toBe('7–12 Ιουλ');
      expect(el.bucket(cutMonth, 'Month')).toBe('15–30 Σεπ');
      expect(el.bucket(across, 'Week')).toBe('28 Σεπ – 4 Οκτ');
    });

    it('names hours, weekdays and day ranges', () => {
      expect(el.hour('9')).toBe('09:00');
      expect(el.weekday(1)).toBe('Δευ');
      expect(el.range(axisItem({ key: '0', from: 0, to: 0 }))).toBe('Ίδια ημέρα');
      expect(el.range(axisItem({ key: '1', from: 1, to: 1 }))).toBe('1 ημέρα');
      expect(el.range(axisItem({ key: '2-3', from: 2, to: 3 }))).toBe('2–3 ημέρες');
      expect(el.range(axisItem({ key: '31+', from: 31, to: null }))).toBe('31+ ημέρες');
    });
  });

  describe('KPI change', () => {
    it('shows the ratio as a whole percent with its sign', () => {
      expect(el.change(kpi(4853, 4712.5, 0.0298), 'revenue')).toEqual({
        text: '+3%',
        direction: 'up',
        tone: 'good',
      });
      expect(el.change(kpi(1, 2, -0.1234), 'appointments')).toEqual({
        text: '-12%',
        direction: 'down',
        tone: 'bad',
      });
    });

    it('shows the lost rate in percentage points, and up is bad', () => {
      expect(el.change(kpi(9.9, 8.7, 0.1379), 'lostRate')).toEqual({
        text: '+1,2 μ.',
        direction: 'up',
        tone: 'bad',
      });
      expect(el.change(kpi(4, 6.5, -0.38), 'lostRate')).toMatchObject({
        direction: 'down',
        tone: 'good',
      });
    });

    it('shows a dash with nothing to compare with', () => {
      expect(el.change(kpi(10, 0, null), 'revenue')).toEqual({
        text: NO_VALUE,
        direction: 'none',
        tone: 'neutral',
      });
      expect(el.change(kpi(4, null, null), 'lostRate').direction).toBe('none');
    });

    it('calls a change that rounds to zero flat', () => {
      expect(el.change(kpi(100, 100.2, -0.002), 'revenue')).toMatchObject({
        direction: 'flat',
        tone: 'neutral',
      });
    });
  });
});

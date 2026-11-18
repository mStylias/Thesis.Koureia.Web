import {
  addDays,
  daysBetween,
  formatDateRange,
  formatDays,
  formatMinutes,
  shopToday,
} from './company.format';
import type { Translate } from './company.format.types';

/** Greek copy, as the dictionary has it. */
const GREEK: Record<string, string> = {
  'managementCompany.durations.minute': '1 λεπτό',
  'managementCompany.durations.minutes': '{{ count }} λεπτά',
  'managementCompany.durations.hour': '1 ώρα',
  'managementCompany.durations.hours': '{{ count }} ώρες',
  'managementCompany.durations.day': '1 ημέρα',
  'managementCompany.durations.days': '{{ count }} ημέρες',
};

const translate: Translate = (key, params) =>
  (GREEK[key] ?? key).replace('{{ count }}', String(params?.['count']));

describe('the company formats', () => {
  it('names a length in its largest whole unit', () => {
    expect(formatMinutes(15, translate)).toBe('15 λεπτά');
    expect(formatMinutes(30, translate)).toBe('30 λεπτά');
    expect(formatMinutes(60, translate)).toBe('1 ώρα');
    expect(formatMinutes(120, translate)).toBe('2 ώρες');
    expect(formatMinutes(1440, translate)).toBe('1 ημέρα');
    expect(formatMinutes(2880, translate)).toBe('2 ημέρες');
  });

  it('keeps a length that is not whole hours in minutes', () => {
    expect(formatMinutes(45, translate)).toBe('45 λεπτά');
    expect(formatMinutes(90, translate)).toBe('90 λεπτά');
    expect(formatMinutes(1, translate)).toBe('1 λεπτό');
  });

  it('names days', () => {
    expect(formatDays(1, translate)).toBe('1 ημέρα');
    expect(formatDays(60, translate)).toBe('60 ημέρες');
  });

  it('shows one day as one date, and a span inside one month once', () => {
    expect(formatDateRange('2026-12-24', '2026-12-24', 'el', 2026)).toBe('24 Δεκ');
    expect(formatDateRange('2026-04-14', '2026-04-17', 'el', 2026)).toBe('14–17 Απρ');
  });

  it('shows the year when a day is not in this year, also across a year', () => {
    expect(formatDateRange('2027-04-14', '2027-04-17', 'el', 2026)).toBe('14–17 Απρ 2027');
    const across = formatDateRange('2026-12-30', '2027-01-02', 'el', 2026);
    expect(across).toContain('30 Δεκ 2026');
    expect(across).toContain('2 Ιαν 2027');
  });

  it('reads today in the zone of the shop, not of the browser', () => {
    const lateInUtc = new Date('2026-10-11T22:30:00Z');
    expect(shopToday('Europe/Athens', lateInUtc)).toBe('2026-10-12');
    expect(shopToday('UTC', lateInUtc)).toBe('2026-10-11');
  });

  it('moves a date by whole days, across a month and a year', () => {
    expect(addDays('2026-10-11', -1)).toBe('2026-10-10');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-10-11', '2026-10-11')).toBe(0);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });
});

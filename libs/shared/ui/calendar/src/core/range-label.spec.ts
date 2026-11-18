import {
  dayHeading,
  dayLabel,
  monthLabel,
  rangeLabel,
  timeLabel,
  weekLabel,
  yearLabel,
} from './range-label';

/** `Intl` sets thin and no-break spaces around a range dash; the words are what is asserted. */
const plain = (label: string): string => label.replace(/\s+/g, ' ');

describe('range labels', () => {
  it('names a day with its weekday, in the locale order', () => {
    expect(dayLabel('2026-09-21', 'el')).toBe('Δευτέρα 21 Σεπτεμβρίου 2026');
    expect(dayLabel('2026-09-21', 'en-GB')).toBe('Monday, 21 September 2026');
  });

  it('heads a column with the short weekday and the day', () => {
    expect(dayHeading('2026-09-21', 'el')).toBe('Δευ 21');
    expect(dayHeading('2026-09-21', 'en-GB')).toBe('Mon 21');
  });

  it('names a week and repeats only the parts that differ', () => {
    // Inside one month. The Greek range takes no spaces around its dash.
    expect(plain(weekLabel('2026-09-23', 'en-GB', 1))).toBe('21 – 27 Sept 2026');
    expect(plain(weekLabel('2026-09-23', 'el', 1))).toBe('21–27 Σεπ 2026');
    // Across a month.
    expect(plain(weekLabel('2026-09-30', 'en-GB', 1))).toBe('28 Sept – 4 Oct 2026');
    // Across a year.
    expect(plain(weekLabel('2026-12-30', 'en-GB', 1))).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  it('names a month and a year', () => {
    expect(monthLabel('2026-09-21', 'el')).toBe('Σεπτέμβριος 2026');
    expect(yearLabel('2026-09-21', 'el')).toBe('2026');
  });

  it('picks the label by view, with month and agenda naming the month', () => {
    expect(rangeLabel('2026-09-21', 'agenda', 'el', 1)).toBe(monthLabel('2026-09-21', 'el'));
    expect(rangeLabel('2026-09-21', 'week', 'el', 1)).toBe(weekLabel('2026-09-21', 'el', 1));
    expect(rangeLabel('2026-09-21', 'year', 'el', 1)).toBe('2026');
  });

  it('formats a time on the 24-hour clock whatever the locale prefers', () => {
    expect(timeLabel('09:05', 'el')).toBe('09:05');
    expect(timeLabel('17:30', 'en-GB')).toBe('17:30');
  });
});

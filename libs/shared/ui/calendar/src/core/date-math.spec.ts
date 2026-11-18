import {
  datesBetween,
  eventMinutes,
  isoWeekdayOf,
  monthGridDays,
  shiftAnchor,
  snapMinutes,
  startOfWeek,
  viewRange,
  weekDays,
  yearMonths,
  zoneClock,
} from './date-math';

describe('isoWeekdayOf and startOfWeek', () => {
  it('numbers Monday 1 and Sunday 7', () => {
    expect(isoWeekdayOf('2026-09-21')).toBe(1);
    expect(isoWeekdayOf('2026-09-27')).toBe(7);
  });

  it('starts the week on the locale first day, in either convention', () => {
    expect(startOfWeek('2026-09-23', 1)).toBe('2026-09-21');
    expect(startOfWeek('2026-09-23', 7)).toBe('2026-09-20');
    expect(startOfWeek('2026-09-21', 1)).toBe('2026-09-21');
  });

  it('lists seven days from that start', () => {
    const days = weekDays('2026-09-23', 1);

    expect(days).toHaveLength(7);
    expect(days.at(0)).toBe('2026-09-21');
    expect(days.at(-1)).toBe('2026-09-27');
  });
});

describe('monthGridDays', () => {
  it('draws whole weeks and only as many rows as the month needs', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday: five rows.
    const days = monthGridDays('2026-09', 1);

    expect(days).toHaveLength(35);
    expect(days.at(0)).toBe('2026-08-31');
    expect(days.at(-1)).toBe('2026-10-04');
  });

  it('needs four rows for a February that starts the week', () => {
    // February 2027 starts on a Monday and has 28 days.
    expect(monthGridDays('2027-02', 1)).toHaveLength(28);
  });

  it('needs six rows when a long month starts late in the week', () => {
    // August 2026 starts on a Saturday and has 31 days.
    expect(monthGridDays('2026-08', 1)).toHaveLength(42);
  });
});

describe('viewRange', () => {
  it('is one day for day view', () => {
    expect(viewRange('2026-09-21', 'day', 1)).toEqual({
      start: '2026-09-21',
      end: '2026-09-22',
      view: 'day',
    });
  });

  it('is the whole week for week view', () => {
    expect(viewRange('2026-09-23', 'week', 1)).toEqual({
      start: '2026-09-21',
      end: '2026-09-28',
      view: 'week',
    });
  });

  it('is the whole grid for month view, leading and trailing days included', () => {
    expect(viewRange('2026-09-15', 'month', 1)).toEqual({
      start: '2026-08-31',
      end: '2026-10-05',
      view: 'month',
    });
  });

  it('is the month proper for agenda', () => {
    expect(viewRange('2026-09-15', 'agenda', 1)).toEqual({
      start: '2026-09-01',
      end: '2026-10-01',
      view: 'agenda',
    });
  });

  it('is the calendar year for year view', () => {
    expect(viewRange('2026-09-15', 'year', 1)).toEqual({
      start: '2026-01-01',
      end: '2027-01-01',
      view: 'year',
    });
  });

  it('lists every date of a range, end excluded', () => {
    expect(datesBetween('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
    expect(datesBetween('2026-01-02', '2026-01-02')).toEqual([]);
  });

  it('yields the twelve months of a year', () => {
    const months = yearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months.at(0)).toBe('2026-01');
    expect(months.at(-1)).toBe('2026-12');
  });
});

describe('shiftAnchor', () => {
  it('steps a day and a week by their length', () => {
    expect(shiftAnchor('2026-09-30', 'day', 1)).toBe('2026-10-01');
    expect(shiftAnchor('2026-09-01', 'week', -1)).toBe('2026-08-25');
  });

  it('steps a month and clamps the day, so 31 January lands on 28 February', () => {
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftAnchor('2026-01-31', 'agenda', 1)).toBe('2026-02-28');
    expect(shiftAnchor('2026-03-31', 'month', -1)).toBe('2026-02-28');
  });

  it('keeps a mid-month day across a month step, so a chosen day survives a round trip', () => {
    expect(shiftAnchor(shiftAnchor('2026-09-15', 'month', 1), 'month', -1)).toBe('2026-09-15');
  });

  it('steps a year and clamps a leap day', () => {
    expect(shiftAnchor('2024-02-29', 'year', 1)).toBe('2025-02-28');
    expect(shiftAnchor('2026-06-10', 'year', -1)).toBe('2025-06-10');
  });

  it('leaves text that is not a date alone', () => {
    expect(shiftAnchor('soon', 'day', 1)).toBe('soon');
  });
});

describe('eventMinutes and snapMinutes', () => {
  it('reads a half-open interval in minutes', () => {
    expect(eventMinutes('09:30', '10:15')).toEqual({ start: 570, end: 615 });
  });

  it('reads an end at or before the start as the end of the day', () => {
    expect(eventMinutes('22:00', '22:00')).toEqual({ start: 1320, end: 1440 });
    expect(eventMinutes('22:00', '01:00')).toEqual({ start: 1320, end: 1440 });
  });

  it('answers null for a start that is not a time', () => {
    expect(eventMinutes('noon', '13:00')).toBeNull();
  });

  it('floors to the scale and stays inside the day', () => {
    expect(snapMinutes(577, 30)).toBe(570);
    expect(snapMinutes(577, 5)).toBe(575);
    expect(snapMinutes(-20, 10)).toBe(0);
    expect(snapMinutes(1439, 30)).toBe(1410);
  });
});

describe('zoneClock', () => {
  it('reads the wall clock of the zone, not of the machine', () => {
    // 21:30 UTC on 21 September is 00:30 on the 22nd in Athens (UTC+3 in summer).
    const instant = new Date('2026-09-21T21:30:00Z');

    expect(zoneClock('Europe/Athens', instant)).toEqual({
      date: '2026-09-22',
      time: '00:30',
      minutes: 30,
    });
    expect(zoneClock('UTC', instant)).toEqual({ date: '2026-09-21', time: '21:30', minutes: 1290 });
  });
});

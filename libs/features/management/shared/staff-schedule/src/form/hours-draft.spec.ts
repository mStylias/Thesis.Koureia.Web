import {
  hoursRequest,
  nextRange,
  outsideShop,
  toFormRanges,
  weekFromHours,
  weekFromShop,
} from './hours-draft';
import { rangeError } from './hours.form';

describe('the hours draft', () => {
  it('builds the week Monday first, a day with ranges working, ranges by start', () => {
    const week = weekFromHours([
      { dayOfWeek: 1, startTime: '15:00', endTime: '20:00' },
      { dayOfWeek: 1, startTime: '10:00', endTime: '14:00' },
      { dayOfWeek: 7, startTime: '10:00', endTime: '14:00' },
    ]);

    expect(week.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.days[0]).toEqual({
      dayOfWeek: 1,
      working: true,
      ranges: [
        { startTime: '10:00', endTime: '14:00' },
        { startTime: '15:00', endTime: '20:00' },
      ],
    });
    expect(week.days[1]?.working).toBe(false);
  });

  it("copies the shop's opening hours", () => {
    const week = weekFromShop([{ dayOfWeek: 2, openTime: '09:00', closeTime: '17:00' }]);
    expect(week.days[1]?.ranges).toEqual([{ startTime: '09:00', endTime: '17:00' }]);
    expect(week.days.filter((day) => day.working)).toHaveLength(1);
  });

  it('sends nothing for a day off, and remembers where each range came from', () => {
    const week = weekFromHours([
      { dayOfWeek: 1, startTime: '10:00', endTime: '14:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '14:00' },
      { dayOfWeek: 3, startTime: '15:00', endTime: '20:00' },
    ]);
    week.days[0] = { ...week.days[0], working: false };

    const { request, refs } = hoursRequest(week);

    expect(request.workHours.map((hour) => hour.dayOfWeek)).toEqual([3, 3]);
    expect(refs).toEqual([
      { day: 2, range: 0 },
      { day: 2, range: 1 },
    ]);
  });

  it("moves a refusal on workHours[i] to that range, and an unknown one to the form's area", () => {
    const failure = toFormRanges(
      {
        errors: [
          { code: 'STAFF_WORK_HOURS_OVERLAP', message: 'overlap', path: ['workHours', 1] },
          { code: 'STAFF_INVALID_WORK_HOURS', message: 'bad', path: ['workHours', 9] },
        ],
      },
      [
        { day: 2, range: 0 },
        { day: 2, range: 1 },
      ],
    );

    expect(failure.errors[0]?.path).toEqual(['days', 2, 'ranges', 1]);
    expect(failure.errors[1]?.path).toBeUndefined();
  });

  it("tells a range outside every opening of the shop's day", () => {
    const shop = [{ startTime: '10:00', endTime: '20:00' }];
    expect(outsideShop({ startTime: '09:00', endTime: '12:00' }, shop)).toBe(true);
    expect(outsideShop({ startTime: '10:00', endTime: '20:00' }, shop)).toBe(false);
    expect(outsideShop({ startTime: '10:00', endTime: '12:00' }, [])).toBe(true);
  });

  it('adds the next range an hour after the last one', () => {
    expect(
      nextRange({
        dayOfWeek: 1,
        working: true,
        ranges: [{ startTime: '10:00', endTime: '14:00' }],
      }),
    ).toEqual({ startTime: '15:00', endTime: '17:00' });
  });

  it('checks each range: both ends, steps of five, order, and overlap with an earlier one', () => {
    const ranges = [
      { startTime: '10:00', endTime: '14:00' },
      { startTime: '13:00', endTime: '17:00' },
    ];
    expect(rangeError(ranges[0] ?? ranges[1], ranges, 0)).toBeUndefined();
    expect(rangeError(ranges[1] ?? ranges[0], ranges, 1)?.kind).toBe('overlap');
    expect(rangeError({ startTime: '', endTime: '14:00' }, [], 0)?.kind).toBe('required');
    expect(rangeError({ startTime: '10:02', endTime: '14:00' }, [], 0)?.kind).toBe('step');
    expect(rangeError({ startTime: '14:00', endTime: '10:00' }, [], 0)?.kind).toBe('order');
  });
});

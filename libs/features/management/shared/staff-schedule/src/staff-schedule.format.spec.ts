import { formatDay, formatSpan, localParts } from './staff-schedule.format';

describe('staff schedule formatting', () => {
  it('reads an instant in the shop zone, not the browser one', () => {
    // 21:30 UTC on 4 Oct is 00:30 on 5 Oct in Athens.
    expect(localParts(new Date('2026-10-04T21:30:00Z'), 'Europe/Athens')).toEqual({
      day: '2026-10-05',
      time: '00:30',
    });
  });

  it('adds the year only when it is not this one', () => {
    expect(formatDay('2026-10-12', 'en', 2026)).toBe('Oct 12');
    expect(formatDay('2027-01-02', 'en', 2026)).toBe('Jan 2, 2027');
  });

  it('reads one day as one date and a span as two', () => {
    const year = new Date().getFullYear();
    expect(formatSpan(`${year}-10-12`, `${year}-10-12`, 'en')).toBe('Oct 12');
    expect(formatSpan(`${year}-10-12`, `${year}-10-14`, 'en')).toBe('Oct 12 – Oct 14');
  });
});

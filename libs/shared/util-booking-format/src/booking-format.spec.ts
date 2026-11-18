import {
  formatDuration,
  formatPrice,
  formatRelativeDay,
  formatShopDate,
  formatShopInstant,
  formatShopTime,
} from './booking-format';

describe('booking format', () => {
  it('formats a shop-local day without shifting it to the browser zone', () => {
    expect(formatShopDate('2026-09-25', 'en')).toBe('Fri, Sep 25');
  });

  it('returns an unparsable day as it came', () => {
    expect(formatShopDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('writes a duration with a prime', () => {
    expect(formatDuration(50)).toBe('50′');
  });

  it('drops the cents of a whole price and keeps them otherwise', () => {
    expect(formatPrice(25, 'EUR', 'en')).toBe('€25');
    expect(formatPrice(25.5, 'EUR', 'en')).toBe('€25.50');
  });

  it('reads an instant on the shop wall clock', () => {
    // 14:30 UTC is 17:30 in Athens summer time.
    expect(formatShopInstant('2026-09-25T14:30:00Z', 'Europe/Athens', 'en')).toBe(
      'Fri, Sep 25, 17:30',
    );
  });

  it('reads the time of an instant on the shop wall clock', () => {
    expect(formatShopTime('2026-09-25T14:50:00Z', 'Europe/Athens', 'en')).toBe('17:50');
  });

  describe('relative day', () => {
    // 23:30 UTC on 7 October is already 8 October in Athens.
    const now = Date.parse('2026-10-07T23:30:00Z');
    const relative = (date: string, locale = 'en'): string =>
      formatRelativeDay(date, 'Europe/Athens', locale, now);

    it('counts from the shop’s today, not the browser’s', () => {
      expect(relative('2026-10-08')).toBe('Today');
      expect(relative('2026-10-09')).toBe('Tomorrow');
      expect(relative('2026-10-07')).toBe('Yesterday');
    });

    it('says days under a week', () => {
      expect(relative('2026-10-13')).toBe('In 5 days');
      expect(relative('2026-10-02')).toBe('6 days ago');
    });

    it('says weeks under a month', () => {
      expect(relative('2026-10-15')).toBe('In 1 week');
      expect(relative('2026-10-29')).toBe('In 3 weeks');
    });

    it('says months, not days, under a year', () => {
      expect(relative('2026-08-08')).toBe('2 months ago');
      expect(relative('2026-11-09')).toBe('In 1 month');
    });

    it('says years from a year on', () => {
      expect(relative('2027-10-01')).toBe('In 1 year');
      expect(relative('2024-10-08')).toBe('2 years ago');
    });

    it('speaks the language it is given', () => {
      expect(relative('2026-10-09', 'el')).toBe('Αύριο');
      expect(relative('2026-08-08', 'el')).toBe('Πριν από 2 μήνες');
    });

    it('returns an unparsable day as it came', () => {
      expect(relative('not-a-date')).toBe('not-a-date');
    });
  });
});

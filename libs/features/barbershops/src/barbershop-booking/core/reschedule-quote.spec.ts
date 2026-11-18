import type { CompanyBookingOptionsResponse } from '../../data/booking.api.types';
import { appointment, bookingOptions } from '../booking.fixture';
import { rescheduleQuote } from './reschedule-quote';

describe('rescheduleQuote', () => {
  const options: CompanyBookingOptionsResponse = bookingOptions();
  // Booked with barber A at an older price than today's catalog.
  const booked = appointment({
    staffMemberId: 'barber-a',
    services: [{ serviceId: 'service-haircut', name: 'Haircut', price: 12, durationMinutes: 25 }],
    totalPrice: 12,
  });

  it('keeps the booked price of a service kept with the same barber', () => {
    const quote = rescheduleQuote(options, ['service-haircut'], 'barber-a', booked, null);

    expect(quote.totals.price).toBe(12);
    expect(quote.chosen[0]).toMatchObject({ price: 12, durationMinutes: 25 });
  });

  it('charges today’s price for a new barber', () => {
    const named = rescheduleQuote(options, ['service-haircut'], 'barber-b', booked, null);

    expect(named.totals).toEqual({ price: 18, durationMinutes: 35, exact: true });
  });

  it('with Anyone and the current barber busy, quotes the lowest catalog price as a floor', () => {
    const quote = rescheduleQuote(options, ['service-haircut'], null, booked, ['barber-b']);

    expect(quote.totals).toMatchObject({ price: 15, exact: false });
  });

  it('charges today’s price for a service added to the move', () => {
    const quote = rescheduleQuote(
      options,
      ['service-haircut', 'service-beard'],
      'barber-a',
      booked,
      null,
    );

    expect(quote.totals.price).toBe(12 + 10);
  });

  it('with Anyone, keeps the current barber when they are free at the chosen slot', () => {
    const quote = rescheduleQuote(options, ['service-haircut'], null, booked, ['barber-a']);

    expect(quote.totals.price).toBe(12);
  });
});

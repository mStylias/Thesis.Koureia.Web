import { formatDuration, formatPrice } from '@util/booking-format';

import type { BookingTotals, ChosenService } from '../booking.types';

export { formatDuration, formatPrice, formatShopDate } from '@util/booking-format';

/** `50′ · €25`. What the collapsed bar and the totals row both end with. */
export function formatTotals(totals: BookingTotals, currency: string, locale: string): string {
  return `${formatDuration(totals.durationMinutes)} • ${formatPrice(totals.price, currency, locale)}`;
}

/** `Κούρεμα + Γένια`. The services as one phrase, for a line that has room for one. */
export function joinServiceNames(services: readonly ChosenService[]): string {
  return services.map((service) => service.name).join(' + ');
}

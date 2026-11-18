import type { Translation } from '@jsverse/transloco';
import type { LandingBrandCopy } from '@features/landing';
import type { RemindersBrandCopy } from '@features/reminders';
import { customerUiCopyEn } from '@util/ui-copy';

/**
 * The landing page's brand-bearing copy — app-owned rather than library-owned,
 * because the Greek dictionary cannot interpolate a brand name. See the Greek
 * file and `LandingBrandCopy`. Typed, so a new app cannot ship with a key
 * missing.
 */
const landing: LandingBrandCopy = {
  label: 'Koureia home page',
  howTitle: 'How Koureia works',
  ctaTitle: 'We are building Koureia with you.',
  copyright: '© {{year}} Koureia',
};

/** The reminders copy that names the brand. See `RemindersBrandCopy`. */
const reminders: RemindersBrandCopy = {
  iphoneLine: 'On an iPhone, notifications work once you add Koureia to your Home Screen.',
  openFromHomeScreen: 'Open Koureia from the icon on your Home Screen.',
};

/**
 * Root English translations. Feature libraries ship their own strings via
 * Transloco scopes (`provideTranslocoScope`), so only app-level keys — and the
 * brand copy those libraries deliberately do not own — live here.
 */
const en: Translation = {
  titles: {
    home: 'Online bookings for barbershops',
    how: 'How it works',
    barbershops: 'Barbershops',
    verifyEmail: 'Confirm your email address',
    reminders: {
      unsubscribe: 'Email reminders',
    },
    notFound: 'Page not found',
    barbershopNotFound: 'Barbershop not found',
    booking: 'Book an appointment',
    bookingConfirmed: 'Your appointment',
    account: {
      appointments: 'My appointments',
      appointment: 'My appointment',
      reviews: 'My reviews',
      profile: 'My profile',
      settings: 'Account settings',
    },
  },
  /**
   * One `<meta name="description">` per page, per language. See the Greek file: this is
   * marketing copy rather than a translation of the heading, which is why it lives beside
   * the titles instead of being derived from them.
   */
  descriptions: {
    home: 'Find a barbershop that suits you, pick a service and book your next appointment online — no phone calls, no waiting on hold.',
    how: 'Three steps: pick a barbershop, pick a time, book it. See how Koureia works for you and for your barber.',
    barbershops:
      'Browse barbershops near you, compare services and prices, and book an appointment online in seconds.',
    // A barbershop with no description of its own. `area` is its neighborhood, or its city.
    barbershop: '{{name}}, {{area}}: see services, prices and barbers, and book online.',
  },
  notFound: {
    title: 'We could not find that page',
    lead: 'The link may be wrong, or the page may no longer exist.',
    home: 'Go to the home page',
  },
  errors: {
    NETWORK_ERROR: 'The connection failed.',
    TIMEOUT: 'The response took too long.',
    CANCELLED: 'The request was cancelled.',
    PARSE_ERROR: 'The response was not valid.',
    UNKNOWN_ERROR: 'Something went wrong.',
  },
  brand: { landing, reminders },
  // Shared-control copy for the customer pages. See `provideCustomerUiCopy`.
  uiCopy: customerUiCopyEn,
};

export default en;

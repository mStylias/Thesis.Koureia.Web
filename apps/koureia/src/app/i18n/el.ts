import type { Translation } from '@jsverse/transloco';
import type { LandingBrandCopy } from '@features/landing';
import type { RemindersBrandCopy } from '@features/reminders';
import { customerUiCopyEl } from '@util/ui-copy';

/**
 * The landing page's brand-bearing copy. It lives here rather than in the
 * feature library because Greek will not let a brand name be interpolated:
 * *"Πώς λειτουργεί το Koureia"* needs the article and case that this name
 * takes, and the next tenant's name will take different ones. Typed, so a new
 * app cannot ship with a key missing.
 */
const landing: LandingBrandCopy = {
  label: 'Αρχική σελίδα Koureia',
  howTitle: 'Πώς λειτουργεί το Koureia',
  ctaTitle: 'Χτίζουμε το Koureia μαζί σου.',
  copyright: '© {{year}} Koureia',
};

/** The reminders copy that names the brand. See `RemindersBrandCopy`. */
const reminders: RemindersBrandCopy = {
  iphoneLine:
    'Στο iPhone, οι ειδοποιήσεις λειτουργούν όταν προσθέσεις το Koureia στην οθόνη Αφετηρίας.',
  openFromHomeScreen: 'Άνοιξε το Koureia από το εικονίδιο στην οθόνη σου.',
};

/**
 * Root Greek translations. Feature libraries ship their own strings via
 * Transloco scopes (`provideTranslocoScope`), so only app-level keys — and the
 * brand copy those libraries deliberately do not own — live here.
 */
const el: Translation = {
  titles: {
    home: 'Online ραντεβού για κουρεία',
    how: 'Πώς λειτουργεί',
    barbershops: 'Κουρεία',
    verifyEmail: 'Επιβεβαίωση email',
    reminders: {
      unsubscribe: 'Υπενθυμίσεις με email',
    },
    notFound: 'Η σελίδα δεν βρέθηκε',
    barbershopNotFound: 'Το κουρείο δεν βρέθηκε',
    booking: 'Κλείσε ραντεβού',
    bookingConfirmed: 'Το ραντεβού σου',
    account: {
      appointments: 'Τα ραντεβού μου',
      appointment: 'Το ραντεβού μου',
      reviews: 'Οι κριτικές μου',
      profile: 'Το προφίλ μου',
      settings: 'Ρυθμίσεις λογαριασμού',
    },
  },
  /**
   * One `<meta name="description">` per page, per language — the text Google shows under
   * the title, so it is marketing copy and not a translation of the heading. Read during
   * the render by `PageMetadata`, keyed off each route's `data.description`.
   *
   * Around 150 characters is what fits before Google truncates it.
   */
  descriptions: {
    home: 'Βρες το κουρείο που σου ταιριάζει, διάλεξε υπηρεσία και κλείσε online το επόμενο ραντεβού σου — χωρίς τηλέφωνα και χωρίς αναμονή.',
    how: 'Τρία βήματα: διάλεξε κουρείο, διάλεξε ώρα, κλείσε. Δες πώς λειτουργεί το Koureia για εσένα και για τον κουρέα σου.',
    barbershops:
      'Δες τα κουρεία της περιοχής σου, σύγκρινε υπηρεσίες και τιμές, και κλείσε ραντεβού online σε λίγα δευτερόλεπτα.',
    // A barbershop with no description of its own. `area` is its neighborhood, or its city.
    barbershop:
      '{{name}}, {{area}}: δες υπηρεσίες, τιμές και κουρείς, και κλείσε το ραντεβού σου online.',
  },
  notFound: {
    title: 'Δεν βρήκαμε αυτή τη σελίδα',
    lead: 'Ο σύνδεσμος μπορεί να είναι λάθος ή η σελίδα να μην υπάρχει πια.',
    home: 'Στην αρχική σελίδα',
  },
  errors: {
    NETWORK_ERROR: 'Η σύνδεση απέτυχε.',
    TIMEOUT: 'Η απάντηση άργησε πολύ.',
    CANCELLED: 'Το αίτημα ακυρώθηκε.',
    PARSE_ERROR: 'Η απάντηση δεν ήταν έγκυρη.',
    UNKNOWN_ERROR: 'Κάτι πήγε στραβά.',
  },
  brand: { landing, reminders },
  // The singular for shared controls on the customer pages. See `provideCustomerUiCopy`.
  uiCopy: customerUiCopyEl,
};

export default el;

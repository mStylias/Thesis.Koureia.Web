import type { UserResponse } from '@api/users';

import type {
  AppointmentResponse,
  CompanyBookingOptionsResponse,
  DayAvailabilityResponse,
} from '../data/booking.api.types';
import type { BookingDraft } from './booking.types';

/** Test data only. A shop as `GET /api/v1/companies/{slug}/booking-options` returns it. */
export function bookingOptions(
  overrides: Partial<CompanyBookingOptionsResponse> = {},
): CompanyBookingOptionsResponse {
  return {
    companyId: 'company-1',
    slug: 'barber-house-kolonaki',
    name: 'Barber House Κολωνάκι',
    logoUrl: 'https://images.test/logo.jpg',
    timezone: 'Europe/Athens',
    currency: 'EUR',
    slotIntervalMinutes: 15,
    minLeadTimeMinutes: 60,
    maxAdvanceDays: 60,
    cancellationCutoffMinutes: 120,
    serviceCategories: [
      {
        id: 'category-haircut',
        name: 'Κούρεμα',
        services: [
          {
            id: 'service-haircut',
            name: 'Ανδρικό κούρεμα',
            description: null,
            price: 15,
            durationMinutes: 30,
            staffMemberIds: ['barber-a', 'barber-b'],
          },
        ],
      },
    ],
    uncategorizedServices: [
      {
        id: 'service-beard',
        name: 'Περιποίηση γενιών',
        description: null,
        price: 10,
        durationMinutes: 20,
        staffMemberIds: ['barber-a'],
      },
    ],
    barbers: [
      {
        id: 'barber-a',
        displayName: 'Γιώργος Π.',
        initials: 'ΓΠ',
        avatarUrl: null,
        offerings: [
          { serviceId: 'service-haircut', price: 15, durationMinutes: 30 },
          { serviceId: 'service-beard', price: 10, durationMinutes: 20 },
        ],
      },
      {
        id: 'barber-b',
        displayName: 'Νίκος Κ.',
        initials: 'ΝΚ',
        avatarUrl: null,
        offerings: [{ serviceId: 'service-haircut', price: 18, durationMinutes: 35 }],
      },
    ],
    ...overrides,
  };
}

/** Test data only. A draft as the browser stored it. */
export function bookingDraft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return {
    slug: 'barber-house-kolonaki',
    serviceIds: ['service-haircut'],
    staffMemberId: null,
    date: null,
    time: null,
    startsAtUtc: null,
    notes: '',
    step: 'services',
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Test data only. One day's slots. */
export function dayAvailability(
  date: string,
  times: readonly string[] = ['17:30', '18:00'],
): DayAvailabilityResponse {
  return {
    date,
    timezone: 'Europe/Athens',
    slots: times.map((time) => ({
      time,
      startsAtUtc: `${date}T${time}:00Z`,
      staffMemberIds: ['barber-a'],
    })),
  };
}

/** Test data only. A booked appointment as the API returns it. */
export function appointment(overrides: Partial<AppointmentResponse> = {}): AppointmentResponse {
  return {
    id: 'appointment-1',
    companyId: 'company-1',
    companySlug: 'barber-house-kolonaki',
    companyName: 'Barber House Κολωνάκι',
    companyLogoUrl: null,
    companyAddress: 'Σκουφά 12, Κολωνάκι, Αθήνα',
    companyStreet: 'Σκουφά 12',
    companyNeighborhood: 'Κολωνάκι',
    companyCity: 'Αθήνα',
    companyLatitude: 37.9794,
    companyLongitude: 23.7389,
    companyPhone: '+302101234567',
    companyEmail: 'hello@barberhouse.test',
    staffMemberId: 'barber-a',
    staffDisplayName: 'Γιώργος Π.',
    startsAtUtc: '2026-09-25T14:30:00Z',
    endsAtUtc: '2026-09-25T15:00:00Z',
    timezone: 'Europe/Athens',
    localDate: '2026-09-25',
    localTime: '17:30',
    status: 'confirmed',
    cancelledBy: null,
    cancelledAtUtc: null,
    services: [
      { serviceId: 'service-haircut', name: 'Ανδρικό κούρεμα', price: 15, durationMinutes: 30 },
    ],
    totalPrice: 15,
    currency: 'EUR',
    cancellationCutoffMinutes: 120,
    notes: null,
    changeableUntilUtc: '2026-09-25T12:30:00Z',
    canChange: true,
    canAddToCalendar: true,
    reviewableUntilUtc: null,
    canReview: false,
    review: null,
    ...overrides,
  };
}

/** Test data only. The caller's own profile, with no phone number stored yet. */
export function profile(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'user-1',
    keycloakId: 'kc-1',
    firstName: 'Νίκος',
    lastName: 'Π.',
    email: 'nikos@example.com',
    phoneNumber: null,
    language: { id: 'lang-el', code: 'el', name: 'Ελληνικά' },
    emailRemindersEnabled: true,
    ...overrides,
  };
}

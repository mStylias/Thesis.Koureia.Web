import type { AppointmentResponse } from '@api/customer-appointments';
import type { ReviewResponse } from '@api/customer-reviews';

/** Test data only. An upcoming appointment that can still be changed. */
export function appointment(overrides: Partial<AppointmentResponse> = {}): AppointmentResponse {
  return {
    id: 'appointment-1',
    companyId: 'company-1',
    companySlug: 'barber-house',
    companyName: 'Barber House',
    companyLogoUrl: null,
    companyAddress: 'Skoufa 12, Kolonaki, Athens',
    companyStreet: 'Skoufa 12',
    companyNeighborhood: 'Kolonaki',
    companyCity: 'Athens',
    companyLatitude: 37.9794,
    companyLongitude: 23.7389,
    companyPhone: '+30 210 123 4567',
    companyEmail: 'hello@barberhouse.test',
    staffMemberId: 'barber-a',
    staffDisplayName: 'George P.',
    startsAtUtc: '2099-09-25T14:30:00Z',
    endsAtUtc: '2099-09-25T15:00:00Z',
    timezone: 'Europe/Athens',
    localDate: '2099-09-25',
    localTime: '17:30',
    status: 'confirmed',
    cancelledBy: null,
    cancelledAtUtc: null,
    services: [{ serviceId: 'haircut', name: 'Haircut', price: 15, durationMinutes: 30 }],
    totalPrice: 15,
    currency: 'EUR',
    cancellationCutoffMinutes: 120,
    notes: null,
    changeableUntilUtc: '2099-09-25T12:30:00Z',
    canChange: true,
    canAddToCalendar: true,
    reviewableUntilUtc: null,
    canReview: false,
    review: null,
    ...overrides,
  };
}

/** Test data only. One of the customer's reviews. */
export function review(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    id: 'review-1',
    appointmentId: 'appointment-1',
    companyId: 'company-1',
    companySlug: 'barber-house',
    companyName: 'Barber House',
    companyLogoUrl: null,
    staffMemberId: 'barber-a',
    staffDisplayName: 'George P.',
    visitDate: '2026-09-25',
    rating: 4,
    comment: 'Sharp fade.',
    createdAt: '2026-09-26T08:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

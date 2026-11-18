import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  gridLabel: "The shop's appointments",
  add: 'New appointment',
  refresh: 'Refresh',
  columns: {
    startsAt: 'Date & time',
    customer: 'Customer',
    barber: 'Barber',
    services: 'Services',
    status: 'Status',
    totalPrice: 'Total',
    createdAt: 'Created',
    localEndTime: 'Ends',
    durationMinutes: 'Duration',
    phone: 'Phone',
    email: 'Email',
    hasNotes: 'Notes',
    source: 'Booked via',
    rating: 'Rating',
    cancelledAt: 'Cancelled on',
    cancelledBy: 'Cancelled by',
    cancellationReason: 'Cancellation reason',
    updatedAt: 'Last changed',
    customerBlocked: 'Blocked customer',
    customerHasNote: 'Shop note',
    customerNoShows: 'No-shows (customer)',
  },
  blocked: 'Blocked',
  notBlocked: 'Not blocked',
  source: {
    online: 'Online',
    staff: 'By the shop',
  },
  minutes: '{{ count }} min',
  stars: '{{ count }} ★',
  notRated: 'Not rated',
  inactive: '{{ name }} (inactive)',
  inactiveService: '{{ name }} (inactive)',
  customerView: {
    loading: 'Customer',
    description: "Created automatically from the customer's appointment. It is not saved.",
  },
};

export default en;

import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  gridLabel: 'Ραντεβού του καταστήματος',
  add: 'Νέο ραντεβού',
  refresh: 'Ανανέωση',
  columns: {
    startsAt: 'Ημερομηνία & ώρα',
    customer: 'Πελάτης',
    barber: 'Κουρέας',
    services: 'Υπηρεσίες',
    status: 'Κατάσταση',
    totalPrice: 'Σύνολο',
    createdAt: 'Καταχώριση',
    localEndTime: 'Λήξη',
    durationMinutes: 'Διάρκεια',
    phone: 'Τηλέφωνο',
    email: 'Email',
    hasNotes: 'Σημειώσεις',
    source: 'Κανάλι κράτησης',
    rating: 'Αξιολόγηση',
    cancelledAt: 'Ημ/νία ακύρωσης',
    cancelledBy: 'Ακυρώθηκε από',
    cancellationReason: 'Λόγος ακύρωσης',
    updatedAt: 'Τελευταία αλλαγή',
    customerBlocked: 'Αποκλεισμένος πελάτης',
    customerHasNote: 'Σημείωση καταστήματος',
    customerNoShows: 'Δεν ήρθε (πελάτης)',
  },
  blocked: 'Αποκλεισμένος',
  notBlocked: 'Χωρίς αποκλεισμό',
  source: {
    online: 'Online',
    staff: 'Από το κατάστημα',
  },
  minutes: '{{ count }} λεπτά',
  stars: '{{ count }} ★',
  notRated: 'Χωρίς αξιολόγηση',
  inactive: '{{ name }} (ανενεργός)',
  inactiveService: '{{ name }} (ανενεργή)',
  customerView: {
    loading: 'Πελάτης',
    description: 'Δημιουργήθηκε αυτόματα από το ραντεβού του πελάτη. Δεν αποθηκεύεται.',
  },
};

export default el;

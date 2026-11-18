import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  toolbar: {
    label: 'Φίλτρα στατιστικών',
    range: 'Διάστημα',
    compareTo: 'Σύγκριση με',
    compareHint: 'Η σύγκριση αφορά τους δείκτες και το γράφημα «Έσοδα στον χρόνο».',
    granularity: 'Ανάλυση',
    staff: 'Κουρέας',
    staffAll: 'Όλοι οι κουρείς',
    staffInactive: '{{ name }} (ανενεργός)',
    staffTeamTab: 'Η καρτέλα συγκρίνει όλους τους κουρείς.',
  },
  // The filter's options. They follow the label "Σύγκριση με".
  compareTo: {
    PreviousPeriod: 'Προηγούμενη περίοδο',
    PreviousYear: 'Ίδιες ημερομηνίες πέρσι',
  },
  // The name of the comparison series in the charts and the tooltips.
  comparison: {
    PreviousPeriod: 'Προηγούμενη περίοδος',
    PreviousYear: 'Πέρσι',
  },
  granularity: {
    auto: 'Αυτόματη',
    Day: 'Ημέρα',
    Week: 'Εβδομάδα',
    Month: 'Μήνας',
  },
  kpis: {
    label: 'Δείκτες',
    revenue: 'Έσοδα',
    appointments: 'Ραντεβού',
    averageTicket: 'Μέση αξία ραντεβού',
    uniqueCustomers: 'Μοναδικοί πελάτες',
    lostRate: 'Χαμένα ραντεβού',
    averageRating: 'Μέση βαθμολογία',
    previous: '{{ comparison }} ({{ dates }}): {{ value }}',
    trend: 'Τάση: {{ label }}',
    up: 'Αύξηση',
    down: 'Μείωση',
    flat: 'Χωρίς αλλαγή',
    none: 'Χωρίς σύγκριση',
    points: '{{ value }} μ.',
    failed: 'Η φόρτωση των δεικτών απέτυχε.',
  },
  tabs: {
    label: 'Ενότητες στατιστικών',
    revenue: 'Έσοδα',
    demand: 'Ζήτηση',
    team: 'Ομάδα',
    services: 'Υπηρεσίες',
    customers: 'Πελάτες',
    lost: 'Απώλειες',
    quality: 'Ποιότητα',
  },
  card: {
    empty: 'Δεν υπάρχουν δεδομένα για αυτό το διάστημα.',
    failed: 'Η φόρτωση απέτυχε.',
    retry: 'Νέα προσπάθεια',
    reloading: 'Ενημέρωση γραφήματος',
    legend: 'Σειρές του γραφήματος',
  },
  units: {
    hours: '{{ count }} ώ.',
    minutes: '{{ count }} λ.',
    hoursAndMinutes: '{{ hours }} ώ. {{ minutes }} λ.',
    hoursOf: '{{ booked }} / {{ available }} ώρες',
    stars: '{{ value }} ★',
  },
  // The day bands of a range axis: booking lead time and days between visits.
  ranges: {
    sameDay: 'Ίδια ημέρα',
    oneDay: '1 ημέρα',
    days: '{{ count }} ημέρες',
    span: '{{ from }}–{{ to }} ημέρες',
    open: '{{ from }}+ ημέρες',
  },
  // ISO weekdays: Monday is 1 and Sunday is 7.
  weekdays: {
    1: 'Δευ',
    2: 'Τρί',
    3: 'Τετ',
    4: 'Πέμ',
    5: 'Παρ',
    6: 'Σάβ',
    7: 'Κυρ',
  },
  // The category keys that come with no `label` from the server.
  axisKeys: {
    online: 'Online',
    staff: 'Από το κατάστημα',
    customer: 'Πελάτης',
    shop: 'Κατάστημα',
    uncategorized: 'Χωρίς κατηγορία',
  },
  // Keyed by the series `key`. The status names come from the appointments dictionary.
  series: {
    value: 'Τιμή',
    revenue: 'Έσοδα',
    completedAppointments: 'Ολοκληρωμένα ραντεβού',
    appointments: 'Ραντεβού',
    bookedMinutes: 'Χρόνος ραντεβού',
    availableMinutes: 'Διαθέσιμος χρόνος',
    utilization: 'Πληρότητα',
    averageRating: 'Μέση βαθμολογία',
    reviews: 'Κριτικές',
    new: 'Νέοι',
    returning: 'Επιστρέφοντες',
    cancellationRate: 'Ακυρώσεις',
    noShowRate: 'Μη εμφανίσεις',
    visits: 'Επισκέψεις',
    bookings: 'Κρατήσεις',
    spend: 'Δαπάνη',
    online: 'Online',
    staff: 'Από το κατάστημα',
  },
  tooltip: {
    previous: '{{ name }} ({{ dates }})',
  },
  // One entry per chart, grouped by tab, keyed by the property name of the response.
  charts: {
    revenue: {
      revenueOverTime: {
        title: 'Έσοδα στον χρόνο',
        note: 'Μετρούν μόνο τα ολοκληρωμένα ραντεβού.',
      },
      revenuePerStaff: { title: 'Έσοδα ανά κουρέα' },
      revenuePerService: { title: 'Έσοδα ανά κατηγορία υπηρεσιών' },
    },
    demand: {
      appointmentsByStatus: { title: 'Ραντεβού ανά κατάσταση' },
      upcomingLoad: {
        title: 'Επόμενες 14 ημέρες',
        note: 'Δεν ακολουθεί το διάστημα των φίλτρων.',
      },
      busiestHours: { title: 'Ώρες αιχμής' },
      busyHeatmap: { title: 'Φόρτος ανά ημέρα και ώρα' },
      bookingLeadTime: { title: 'Πόσο νωρίς κλείνονται τα ραντεβού' },
      bookingSource: { title: 'Προέλευση κρατήσεων' },
    },
    team: {
      appointmentsPerStaff: { title: 'Ραντεβού ανά κουρέα' },
      staffUtilization: {
        title: 'Πληρότητα ανά κουρέα',
        noSchedule: 'Χωρίς ωράριο',
      },
      ratingPerStaff: {
        title: 'Βαθμολογία ανά κουρέα',
        noReviews: 'Χωρίς κριτικές',
      },
    },
    services: {
      bookingsPerService: { title: 'Κρατήσεις ανά υπηρεσία' },
      revenuePerService: { title: 'Έσοδα ανά υπηρεσία' },
    },
    customers: {
      newVsReturning: { title: 'Νέοι και επιστρέφοντες πελάτες' },
      daysBetweenVisits: {
        title: 'Ημέρες ανάμεσα στις επισκέψεις',
        note: 'Μετρούνται επισκέψεις, όχι πελάτες.',
      },
      topCustomers: {
        title: 'Κορυφαίοι πελάτες',
        rank: 'Θέση',
        name: 'Πελάτης',
        visits: 'Επισκέψεις',
        spend: 'Δαπάνη',
      },
    },
    lost: {
      statusMix: { title: 'Ραντεβού ανά κατάσταση' },
      lostRateOverTime: { title: 'Ακυρώσεις και μη εμφανίσεις στον χρόνο' },
      cancelledBy: {
        title: 'Ποιος ακύρωσε',
        note: 'Οι πελάτες δεν μπορούν ακόμη να ακυρώσουν μόνοι τους.',
      },
    },
    quality: {
      ratingOverTime: {
        title: 'Βαθμολογία στον χρόνο',
        note: 'Με την ημερομηνία του ραντεβού, όχι της κριτικής.',
      },
      ratingDistribution: { title: 'Κατανομή βαθμολογιών' },
    },
  },
  errors: {
    ANALYTICS_INVALID_PERIOD: 'Το διάστημα δεν είναι έγκυρο. Εμφανίζονται οι τελευταίες 30 ημέρες.',
    ANALYTICS_INVALID_GRANULARITY:
      'Η ανάλυση ανά ημέρα δέχεται έως 92 ημέρες. Η ανάλυση έγινε αυτόματη.',
    ANALYTICS_STAFF_MEMBER_NOT_FOUND:
      'Ο κουρέας δεν βρέθηκε στο κατάστημα. Εμφανίζονται όλοι οι κουρείς.',
    ANALYTICS_FETCH_FAILED: 'Η φόρτωση των στατιστικών απέτυχε.',
    COMPANY_NOT_FOUND: 'Το κατάστημα δεν βρέθηκε.',
  },
};

export default el;

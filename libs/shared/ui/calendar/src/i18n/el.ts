import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  toolbar: 'Εργαλεία ημερολογίου',
  previous: 'Προηγούμενο',
  next: 'Επόμενο',
  goToDate: 'Μετάβαση σε ημερομηνία',
  view: 'Προβολή',
  views: {
    day: 'Ημέρα',
    week: 'Εβδομάδα',
    month: 'Μήνας',
    year: 'Έτος',
    agenda: 'Ατζέντα',
  },
  filters: 'Φίλτρα',
  filtersActive: '{{count}} ενεργά',
  settings: 'Ρυθμίσεις',
  refresh: 'Ανανέωση',
  create: 'Νέα καταχώρηση',
  overflow: 'Περισσότερα',
  timeScale: 'Κλίμακα χρόνου',
  minutes: 'λεπτά',
  showTime: 'Ώρα στις καταχωρήσεις',
  dayColumns: 'Μία στήλη ανά πόρο',
  today: 'Σήμερα',
  closed: 'Κλειστό',
  eventLabel: '{{start}} έως {{end}}, {{title}}',
  more: '+{{count}}',
  moreLabel: '{{count}} ακόμη, από {{start}} έως {{end}}',
  moreTitle: 'Περισσότερες καταχωρήσεις',
  columnHint: 'Τα βελάκια επιλέγουν ώρα. Το Enter δημιουργεί καταχώρηση εκεί.',
  slotSelected: 'Επιλέχθηκε {{time}}',
  entries: '{{count}} καταχωρήσεις',
  moreCount: '{{count}} ακόμη',
  agendaEmpty: 'Τίποτα αυτόν τον μήνα.',
  densityLegend: 'Καταχωρήσεις ανά ημέρα',
  gridHint:
    'Τα βελάκια μετακινούν ανάμεσα στις ημέρες. Το Enter ανοίγει μια ημέρα, Shift και Enter δημιουργούν καταχώρηση σε αυτήν.',
};

export default el;

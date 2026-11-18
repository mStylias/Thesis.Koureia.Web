import type { UiCopyDictionary } from './customer-ui-copy.types';

/**
 * The singular for every shared-control string that addresses the reader. Keyed by the lib key,
 * so `timePicker.placeholder` here replaces the time picker's `timePicker.placeholder`. The keys
 * of this file are the override map: add a key here and in the English file, and nowhere else.
 */
export const customerUiCopyEl = {
  confirmationDialog: {
    message: 'Σίγουρα θέλεις να συνεχίσεις;',
  },
  datePicker: {
    calendar: 'Επίλεξε ημερομηνία',
    errors: {
      required: 'Επίλεξε ημερομηνία.',
      dateFormat: 'Γράψε έγκυρη ημερομηνία με τη μορφή που εμφανίζεται.',
      dateUnavailable: 'Επίλεξε μία από τις διαθέσιμες ημερομηνίες.',
    },
  },
  dateRangePicker: {
    panel: 'Επίλεξε διάστημα ημερομηνιών',
    pickEnd: 'Επίλεξε την τελευταία ημέρα',
    errors: {
      required: 'Επίλεξε διάστημα ημερομηνιών.',
      dateFormat: 'Γράψε έγκυρες ημερομηνίες με τη μορφή που εμφανίζεται.',
      dateUnavailable: 'Επίλεξε ημερομηνίες μέσα στα διαθέσιμα όρια.',
    },
  },
  datetimePicker: {
    placeholder: 'Επίλεξε ημερομηνία',
    panel: 'Επίλεξε ημερομηνία και προαιρετική ώρα',
  },
  fileUpload: {
    dropHint: 'Σύρε αρχεία εδώ ή χρησιμοποίησε το κουμπί',
    errors: {
      network:
        'Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά',
      unknown: 'Δεν ήταν δυνατή η μεταφόρτωση του αρχείου. Δοκίμασε ξανά',
      required: 'Πρόσθεσε τουλάχιστον ένα αρχείο',
    },
  },
  field: {
    errors: {
      email: 'Γράψε έγκυρη διεύθυνση email',
      minLength: 'Χρησιμοποίησε τουλάχιστον {{minLength}} χαρακτήρες',
      maxLength: 'Χρησιμοποίησε έως {{maxLength}} χαρακτήρες',
      min: 'Γράψε {{min}} ή μεγαλύτερο',
      max: 'Γράψε {{max}} ή μικρότερο',
      minDate: 'Επίλεξε μεταγενέστερη ημερομηνία',
      maxDate: 'Επίλεξε προγενέστερη ημερομηνία',
    },
  },
  imageCropper: {
    hint: 'Σύρε τη φωτογραφία ή χρησιμοποίησε τα βέλη. Μεγέθυνση με τον ολισθητή ή με + και −.',
  },
  inputNumber: {
    errors: {
      required: 'Συμπλήρωσε έναν αριθμό.',
      min: 'Γράψε τιμή {{min}} ή μεγαλύτερη.',
      max: 'Γράψε τιμή {{max}} ή μικρότερη.',
      invalid: 'Γράψε έγκυρο αριθμό.',
    },
  },
  inputOtp: {
    errors: {
      required: 'Γράψε τον κωδικό.',
      minLength: 'Συμπλήρωσε όλα τα ψηφία του κωδικού.',
    },
  },
  multiSelect: {
    typeToSearch: 'Πληκτρολόγησε για αναζήτηση',
  },
  passwordInput: {
    strength: {
      none: 'Γράψε κωδικό',
    },
  },
  phoneInput: {
    errors: {
      phoneGreekMobile: 'Γράψε έγκυρο ελληνικό κινητό (ξεκινά από 69)',
    },
  },
  rangePicker: {
    errors: {
      required: 'Επίλεξε ένα εύρος.',
      invalid: 'Επίλεξε ένα έγκυρο εύρος.',
      min: 'Επίλεξε ελάχιστο {{min}} ή μεγαλύτερο.',
      max: 'Επίλεξε μέγιστο {{max}} ή μικρότερο.',
    },
  },
  select: {
    typeToSearch: 'Πληκτρολόγησε για αναζήτηση',
  },
  timePicker: {
    placeholder: 'Επίλεξε ή πληκτρολόγησε ώρα',
    errors: {
      required: 'Επίλεξε ώρα.',
      timeFormat: 'Γράψε έγκυρη ώρα, π.χ. 09:30.',
      timeUnavailable: 'Επίλεξε μία από τις διαθέσιμες ώρες.',
    },
  },
} as const satisfies UiCopyDictionary;

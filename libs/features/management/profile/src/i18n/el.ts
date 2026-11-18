import type { Translation } from '@jsverse/transloco';

// Management copy: actions are nouns, and text that addresses the reader uses the polite plural.
const el: Translation = {
  actions: {
    edit: 'Επεξεργασία',
    save: 'Αποθήκευση',
    cancel: 'Ακύρωση',
  },
  discard: {
    message: 'Οι αλλαγές στο προφίλ σας δεν έχουν αποθηκευτεί.',
  },
  profile: {
    title: 'Προφίλ',
    firstName: 'Όνομα',
    lastName: 'Επώνυμο',
    phone: 'Τηλέφωνο',
    email: 'Email',
    emailHint: 'Το email χρησιμοποιείται για τη σύνδεση και δεν αλλάζει από εδώ.',
    nameHint: 'Το όνομα εμφανίζεται στους πελάτες.',
    saved: 'Το προφίλ αποθηκεύτηκε.',
    saveFailed: 'Οι αλλαγές δεν αποθηκεύτηκαν.',
    errors: {
      firstNameRequired: 'Συμπληρώστε το όνομα.',
      lastNameRequired: 'Συμπληρώστε το επώνυμο.',
      nameSymbols: 'Χρησιμοποιήστε γράμματα χωρίς σύμβολα όπως ( ) < > &.',
    },
    password: {
      label: 'Κωδικός πρόσβασης',
      hint: 'Θα μεταφερθείτε στη σελίδα σύνδεσης για να ορίσετε νέο κωδικό.',
      action: 'Αλλαγή κωδικού',
      updated: 'Ο κωδικός άλλαξε.',
      failed: 'Ο κωδικός δεν άλλαξε.',
    },
  },
  workHours: {
    title: 'Ώρες εργασίας',
    readOnly: 'Τις ώρες εργασίας σας τις ορίζει ο υπεύθυνος του καταστήματος.',
    zone: 'Ώρες καταστήματος ({{ zone }}).',
    none: 'Δεν έχουν οριστεί ώρες εργασίας.',
    timeOff: {
      title: 'Άδειες',
      add: 'Προσθήκη άδειας',
    },
    errors: {
      AUTH_PERMISSION_DENIED: 'Δεν έχετε δικαίωμα για αυτή την αλλαγή.',
      STAFF_NOT_OWN_ROW: 'Μπορείτε να αλλάξετε μόνο το δικό σας ωράριο και τις δικές σας άδειες.',
      STAFF_UPDATE_FAILED: 'Η αποθήκευση απέτυχε. Δοκιμάστε ξανά.',
      STAFF_INVALID_WORK_HOURS: 'Το διάστημα δεν είναι έγκυρο.',
      STAFF_WORK_HOURS_OVERLAP: 'Το διάστημα επικαλύπτει άλλο της ίδιας ημέρας.',
      STAFF_INVALID_TIME_OFF: 'Η άδεια δεν είναι έγκυρη.',
      STAFF_TIME_OFF_OVERLAP: 'Η άδεια επικαλύπτει άλλη άδειά σας.',
      STAFF_TIME_OFF_NOT_FOUND: 'Η άδεια δεν βρέθηκε. Ίσως διαγράφηκε.',
    },
  },
  preferences: {
    title: 'Προτιμήσεις',
    theme: {
      label: 'Εμφάνιση',
      light: 'Φωτεινή',
      dark: 'Σκοτεινή',
      system: 'Όπως η συσκευή',
      saveFailed: 'Η εμφάνιση δεν αποθηκεύτηκε στον λογαριασμό σας.',
    },
    language: {
      label: 'Γλώσσα',
      hint: 'Ισχύει και για τα email που λαμβάνετε.',
    },
  },
  notifications: {
    title: 'Ειδοποιήσεις',
    soon: 'Σύντομα διαθέσιμο.',
    description:
      'Θα μπορείτε να επιλέξετε πώς ενημερώνεστε για νέα ραντεβού, αλλαγές και ακυρώσεις.',
    email: {
      label: 'Email',
      hint: 'Στο email του λογαριασμού σας.',
    },
    platform: {
      label: 'Στην πλατφόρμα',
      hint: 'Στο εικονίδιο ειδοποιήσεων της διαχείρισης.',
    },
    push: {
      label: 'Push',
      hint: 'Στις συσκευές όπου τις επιτρέψετε.',
    },
  },
};

export default el;

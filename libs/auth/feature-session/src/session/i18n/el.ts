import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  entry: {
    signIn: 'Σύνδεση',
    // «Εγγραφή» and not «Δημιουργία λογαριασμού»: it sits next to «Σύνδεση» in a header
    // where one word each is what keeps the two reading as a pair of equals.
    signUp: 'Εγγραφή',
    accountMenu: 'Μενού λογαριασμού',
    openAccountMenu: 'Άνοιγμα μενού λογαριασμού',
    profile: 'Προφίλ',
    bookings: 'Τα ραντεβού μου',
    reviews: 'Οι κριτικές μου',
    signOut: 'Αποσύνδεση',
    management: 'Διαχείριση',
  },
  expired: {
    title: 'Η σύνδεσή σας έληξε',
    // Says what happened and what it cost, because the alternative is a screen that looks
    // broken. Nothing the person did caused this.
    body: 'Για την ασφάλειά σας, η σύνδεσή σας έκλεισε μετά από μεγάλο διάστημα. Συνδεθείτε ξανά για να συνεχίσετε από εκεί που μείνατε.',
    signIn: 'Σύνδεση',
  },
  unverified: {
    // One sentence, in the singular the rest of the product speaks in. It names what the address
    // buys rather than what is wrong with it: a reminder with nothing at stake is one a person
    // learns to look past.
    message: 'Επιβεβαίωσε τη διεύθυνση email σου, ώστε να μπορέσεις να κλείσεις ραντεβού',
    verify: 'Επιβεβαίωση τώρα',
    dismiss: 'Απόκρυψη της υπενθύμισης',
  },
};

export default el;

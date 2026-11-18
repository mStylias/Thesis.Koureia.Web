import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  navLabel: 'Πλοήγηση διαχείρισης',
  groups: {
    operations: 'Λειτουργία',
    analytics: 'Στατιστικά',
    settings: 'Ρυθμίσεις',
  },
  // One label per page, read three times: the sidebar option, the top bar heading and the
  // browser tab. The route `title` points at the same key, so the three cannot disagree.
  nav: {
    calendar: 'Ημερολόγιο',
    appointments: 'Ραντεβού',
    customers: 'Πελάτες',
    services: 'Υπηρεσίες & τιμές',
    staff: 'Προσωπικό',
    dashboard: 'Πίνακας ελέγχου',
    roles: 'Ρόλοι & δικαιώματα',
    // Opened from the account menu, not the sidebar.
    profile: 'Το προφίλ μου',
    company: 'Το κατάστημά μου',
  },
  // The account menu at the right end of the top bar.
  account: {
    menu: 'Μενού λογαριασμού',
    profile: 'Το προφίλ μου',
    company: 'Το κατάστημά μου',
    signOut: 'Αποσύνδεση',
  },
  // The superadmin's shop picker in the top bar.
  workspace: {
    shop: 'Κουρείο',
    pickShop: 'Επιλογή κουρείου',
    inactive: 'ανενεργό',
  },
  placeholder: {
    title: 'Υπό κατασκευή',
    lead: 'Αυτή η σελίδα δεν έχει περιεχόμενο ακόμη.',
  },
};

export default el;

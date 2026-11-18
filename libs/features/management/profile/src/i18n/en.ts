import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  actions: {
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
  },
  discard: {
    message: 'The changes to your profile are not saved.',
  },
  profile: {
    title: 'Profile',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    email: 'Email',
    emailHint: 'You sign in with this email. It cannot be changed here.',
    nameHint: 'Customers see this name.',
    saved: 'Profile saved.',
    saveFailed: 'The changes were not saved.',
    errors: {
      firstNameRequired: 'Enter the first name.',
      lastNameRequired: 'Enter the last name.',
      nameSymbols: 'Use letters without symbols such as ( ) < > &.',
    },
    password: {
      label: 'Password',
      hint: 'You go to the sign-in page to set a new password.',
      action: 'Change password',
      updated: 'Password changed.',
      failed: 'The password did not change.',
    },
  },
  workHours: {
    title: 'Work hours',
    readOnly: 'The shop manager sets your work hours.',
    zone: 'Shop hours ({{ zone }}).',
    none: 'No work hours are set.',
    timeOff: {
      title: 'Time off',
      add: 'Add time off',
    },
    errors: {
      AUTH_PERMISSION_DENIED: 'You do not have permission for this change.',
      STAFF_NOT_OWN_ROW: 'You can change only your own hours and time off.',
      STAFF_UPDATE_FAILED: 'The save failed. Try again.',
      STAFF_INVALID_WORK_HOURS: 'The range is not valid.',
      STAFF_WORK_HOURS_OVERLAP: 'The range overlaps another one on the same day.',
      STAFF_INVALID_TIME_OFF: 'The time off is not valid.',
      STAFF_TIME_OFF_OVERLAP: 'The time off overlaps another time off of yours.',
      STAFF_TIME_OFF_NOT_FOUND: 'The time off was not found. It may have been deleted.',
    },
  },
  preferences: {
    title: 'Preferences',
    theme: {
      label: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      system: 'Same as device',
      saveFailed: 'The appearance was not saved to your account.',
    },
    language: {
      label: 'Language',
      hint: 'Also applies to the emails you get.',
    },
  },
  notifications: {
    title: 'Notifications',
    soon: 'Coming soon.',
    description:
      'You will be able to choose how you hear about new appointments, changes and cancellations.',
    email: {
      label: 'Email',
      hint: 'To your account email.',
    },
    platform: {
      label: 'In the platform',
      hint: 'In the notifications icon of the management area.',
    },
    push: {
      label: 'Push',
      hint: 'On the devices where you allow them.',
    },
  },
};

export default en;

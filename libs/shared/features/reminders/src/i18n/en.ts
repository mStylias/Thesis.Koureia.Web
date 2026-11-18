import type { Translation } from '@jsverse/transloco';

/** Mirrors `el.ts`. The labels in the steps must match what a device set to English shows. */
const en: Translation = {
  card: {
    title: 'Want a notification as well?',
    lineWithEmail:
      'When you turn on notifications, you will get a push notification on this device to remind you of your appointment, as well as the reminder email.',
    line: 'You can get a notification on this device, a day and two hours before.',
    inApp: 'Open the page in your browser to get notifications.',
    enable: 'Turn on notifications',
    howTo: 'See how',
    notNow: 'Not now',
    cue: 'Want a notification?',
    on: 'You will get a notification on this device.',
  },
  outcome: {
    on: 'Notifications are on for this device.',
    failed: 'We could not turn on notifications. Try again.',
  },
  guide: {
    title: 'Notification setup',
    platforms: 'Device',
    ios: 'iPhone and iPad',
    android: 'Android',
    desktop: 'Computer',
    close: 'Close',
    copyLink: 'Copy link',
    noInstall: 'Nothing to install. Press "Turn on", then "Allow".',
    homeScreen: {
      intro: 'On an iPhone or iPad, notifications work from the Home Screen.',
      share: 'Tap the Share button in the Safari toolbar.',
      add: 'Choose "Add to Home Screen".',
      signIn: 'Sign in again. The Home Screen app has its own sign-in.',
      enable: 'Go to Settings and tap "Turn on".',
    },
    safari:
      'Open this page in Safari. Only Safari adds the page to the Home Screen with notifications.',
    inApp: {
      intro: 'This app opens pages in its own browser, which cannot show notifications.',
      menu: "Tap the app's menu, usually at the top right.",
      open: 'Choose to open the page in your browser or in Safari.',
      copy: 'Or copy the link and open it in your browser.',
    },
    blocked: {
      intro: 'If you blocked notifications:',
      siteIcon: 'Select the icon to the left of the page address.',
      siteSettings: 'Open "Site settings".',
      allow: 'Under "Notifications", choose "Allow".',
      reload: 'Reload the page.',
      firefoxClear: 'Clear the block on notifications.',
      firefoxEnable: 'Reload the page and press "Turn on".',
      safariSettings: 'Open Safari, Settings, Websites, Notifications.',
      safariAllow: 'Find this website and choose "Allow".',
      iosSettings: 'Open the iPhone Settings.',
      iosApp: 'Tap "Notifications" and choose the app from the list.',
      iosAllow: 'Turn on "Allow Notifications".',
      chrome: 'Chrome and Edge',
      firefox: 'Firefox',
      safari: 'Safari',
      system:
        "If nothing arrives, check that the browser may show notifications in the computer's settings: Notifications on Windows, Focus on macOS.",
    },
  },
  homeScreen: {
    title: 'Appointment reminders',
    line: 'Turn on notifications to get appointment reminders.',
    enable: 'Turn on',
    notNow: 'Not now',
  },
  unsubscribe: {
    title: 'Email reminders',
    loading: 'Loading…',
    question: 'Stop the email reminders?',
    address: 'For {{email}}',
    stop: 'Stop the reminders',
    done: 'You will no longer get email reminders. Emails about a booking, a change or a cancellation still arrive.',
    undo: 'Undo',
    resubscribe: 'Turn on again',
    resubscribed:
      'You will get email reminders again, a day and two hours before each appointment.',
    settings: 'Go to Settings',
    invalid: 'This link is not valid.',
    invalidHint: 'The next reminder email will have a new link.',
    failed: 'Something went wrong. Try again.',
    retry: 'Try again',
  },
};

export default en;

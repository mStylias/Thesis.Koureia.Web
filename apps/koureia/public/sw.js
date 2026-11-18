/*
 * The service worker. It shows appointment reminders and nothing else.
 *
 * CAUTION: Do not add a `fetch` handler or a cache. The pages are server rendered, and a worker
 * that answers requests can serve an old version of the site. `server.ts` serves this file with
 * `Cache-Control: no-cache`, so a change reaches the browser on the next visit.
 *
 * Plain JavaScript, copied to the build as is.
 */

const ICON = '/brand/icon-192.png';
const BADGE = '/brand/badge-96.png';

/** Shown when a payload cannot be read. Safari removes a subscription that shows nothing. */
function fallbackReminder() {
  const english = (self.navigator.language || '').toLowerCase().startsWith('en');
  return {
    title: english ? 'Appointment reminder' : 'Υπενθύμιση ραντεβού',
    body: '',
    url: '/',
    tag: 'reminder',
  };
}

/** The payload is `{ title, body, url, tag }`. Anything else gets the fallback. */
function readReminder(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data.title === 'string' && data.title !== '') {
      return {
        title: data.title,
        body: typeof data.body === 'string' ? data.body : '',
        url: typeof data.url === 'string' ? data.url : '/',
        tag: typeof data.tag === 'string' && data.tag !== '' ? data.tag : 'reminder',
      };
    }
  } catch {
    // Not JSON. Show the fallback.
  }
  return fallbackReminder();
}

/** Only a path on this site. A full address from the payload could open another site. */
function safePath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

// The worker holds no cache, so a new version can take over at once. `claim` lets it control the
// open pages, which `notificationclick` must have to navigate them.
self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const reminder = readReminder(event);
  // Every push must show a notification. Both reminders of one appointment share a tag, so the
  // second replaces the first, and `renotify` makes the second alert again.
  event.waitUntil(
    self.registration.showNotification(reminder.title, {
      body: reminder.body,
      icon: ICON,
      badge: BADGE,
      tag: reminder.tag,
      renotify: true,
      data: { url: safePath(reminder.url) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    safePath(event.notification.data && event.notification.data.url),
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(target);
      // `navigate` refuses a window this worker does not control. Open a new one then.
      return open
        .focus()
        .then((client) => client.navigate(target))
        .catch(() => self.clients.openWindow(target));
    }),
  );
});

// The worker has no access token, so it cannot tell the API about a new subscription. The app
// registers the subscription again the next time it opens.
self.addEventListener('pushsubscriptionchange', () => undefined);

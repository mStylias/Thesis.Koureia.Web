# @features/reminders

Appointment reminders on the customer's side: push on this browser, the setup guide, and the
unsubscribe page of the reminder emails.

```ts
import {
  HomeScreenPrompt,
  PushReminders,
  ReminderCard,
  ReminderGuide,
  remindersRoutes,
} from '@features/reminders';
```

| Export             | Where                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| `PushReminders`    | The push state of this browser, `enable()`, `disable()`, `sendTest()` |
| `ReminderCard`     | The booking success screen. `cue` floats a pill that scrolls to it    |
| `ReminderGuide`    | The card and Settings: iPhone Home Screen, in-app browser, unblock    |
| `HomeScreenPrompt` | The site layout: once per launch of the iPhone Home Screen app        |
| `remindersRoutes`  | `/{lang}/reminders/unsubscribe?token=…`                               |

## The app's half

The session lives in `@auth/data-access`, which a `scope:shared` library must not import. The
app supplies it, starts the sync, and turns push off on sign-out:

```ts
// apps/<app>/src/app/app.config.ts
{
  provide: REMINDERS_ACCOUNT,
  useFactory: () => {
    const session = inject(SessionStore);
    return { signedIn: session.isSignedIn, verified: session.isEmailVerified };
  },
},
providePushReminders(),
provideBeforeSignOut(() => {
  const injector = inject(Injector);
  return () => injector.get(PushReminders).disable();
}),
```

The sign-out hook resolves `PushReminders` when it runs. An eager `inject` is a cycle:
`SessionStore` reads the hooks, and `PushReminders` reads the session.

The copy that names the brand is the app's too, under `brand.reminders.*`. See
`RemindersBrandCopy`.

## Why the browser subscription is the setting

Push on this browser is on if and only if a subscription exists. Nothing stores a flag that could
disagree with it. Each start registers the subscription again for a verified customer, which keeps
the device on the API's list of the 20 most recent, and replaces a subscription made with an old
key.

## Why the question comes first

The browser asks for permission only inside a user gesture, and Safari is strict about it.
`enable()` asks before it awaits anything, so it must be called straight from a click handler.

## Why the guide is a dialog

`@ui/bottom-sheet` is a surface that never goes away. The guide and the Home Screen prompt are a
`lib-dialog`, placed at the bottom on a phone.

## Why nothing renders on the server

The state needs the browser's permission and its subscription. On the server it is `unknown`,
and every screen renders nothing for `unknown`.

## The service worker

`apps/<app>/public/sw.js`, plain JavaScript. It shows the push and opens its `url` on a click. It
has no `fetch` handler and no cache, so it cannot serve an old version of a server-rendered page.
`server.ts` serves it with `Cache-Control: no-cache`.

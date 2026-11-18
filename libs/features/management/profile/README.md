# `@features/management-profile`

The signed-in person's own page, `/management/profile`. It is not a sidebar page: the account
menu at the right end of the top bar opens it, and every person who can open the workspace can
open it.

```ts
// libs/features/management/layout/src/lib.routes.ts
{ path: 'profile', ...profileRoute, title: 'management.nav.profile' }
```

## Layout

One column of cards: Profile, Work hours, Preferences, Notifications. Each card is a component
that renders `lib-page-section` from `@features/management-shared-page-sections`, which owns the
heading, the hint, the actions slot, the loading skeleton and the failure with a retry. So each
card loads and fails on its own.

| Folder           | Card                                                       |
| ---------------- | ---------------------------------------------------------- |
| `account/`       | Profile: name and phone (view, then Edit), email, password |
| `work/`          | Work hours and time off                                    |
| `preferences/`   | Theme and language. Both save on change                    |
| `notifications/` | A disabled preview. It makes no request                    |
| `page/`          | The page and its unsaved-changes guard                     |

## Adding a card

1. Render `lib-page-section` with a `sectionId`. The id is the fragment that opens the page at
   the card.
2. A card that edits implements `PageSectionEditor` and calls `registerPageEditor(this)` in its
   constructor. The route's `canDeactivate` and the page's `beforeunload` then cover it.
3. Put it in `page/management-profile.html`, in the order of the plan.

## The Work hours card

`ProfileScheduleStore` reads `GET users/me/staff-member` and is the card's
`STAFF_SCHEDULE_CONTEXT`, so the shared week and time-off editors get the shop's hours, slot step and
zone from the same answer. The card hides itself on `USER_NOT_STAFF_MEMBER` and for a member who
takes no online bookings. It provides its own copy for the `STAFF_*` refusals a save can get,
because the schedule lib ships none and the server's description is English.
`loadProfileDictionaries` also loads the schedule lib's dictionary, because that lib translates day
names in `computed`s.

## Why the theme sync is in this library

`ThemePreferenceSync` reads and writes the user resource `ui_preferences`. `ManagementShell`
provides it and runs `sync()` once after its first render, so a device takes the account's theme
the first time the person opens management there. The Preferences card injects the same instance
to write. The account wins over the browser. The public site does not read the account.

## Why the language reloads to this page

`/management/profile` has no language segment, so the switcher gets
`reloadUrl="/management/profile#preferences"`. It stores the choice, replaces the address and
reloads, because `LOCALE_ID` is fixed at bootstrap.

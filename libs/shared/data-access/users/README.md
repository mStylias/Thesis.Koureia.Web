# @api/users

The caller's **own** profile — the half of a user record that a token cannot supply.

```ts
import { UserProfileApi } from '@api/users';
```

## `PATCH /users/me` is a merge patch

An absent property is left alone. That is the whole reason
`updatePreferredLanguage(code)` can be a one-field call rather than a read-modify-write:
writing a language cannot clobber a phone number that this client never read.

```ts
private readonly profile = inject(UserProfileApi);
this.profile.updatePreferredLanguage('en').subscribe();
```

## Why a code and not an id

The endpoint takes `preferredLanguageCode` — `'el'`, `'en'` — and resolves it to
`preferred_language_id` itself, so a client can set a language without first fetching the
language table. It also copies the code to the identity provider, which is what keeps the
next sign-in's `locale` claim from being stale.

A code the server does not recognise is a `400` carrying
`errorCode: USER_LANGUAGE_NOT_FOUND`. Callers send one of two constants, so that response
means a bug on this side: log it, never show it.

## What this deliberately is not

There is no `getProfile()` here yet. Nothing needs one — the session's claims already carry
the name and email a screen shows, and adding a read that no caller has would be a wire
shape maintained on speculation. Add it when a screen needs the phone number.

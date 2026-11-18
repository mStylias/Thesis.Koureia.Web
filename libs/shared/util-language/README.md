# @util/language

The **language seam**. Every page has one address per language — `/el/barbershops` and
`/en/barbershops` — so that Greek and English can be indexed separately instead of one
being picked and the other discarded. This library is the vocabulary that arrangement is
built from.

```ts
import { ActiveLanguage, LangLink, activateLanguage, languageMatches } from '@util/language';
```

## The rule

**The URL decides the language on a public page.** It is a published address: it must serve
the same content to everyone, forever, or a crawler following `/en/barbershops` is
redirected to Greek and concludes the English page does not exist.

Both languages are prefixed — there is no unprefixed default, so a bare path is never
ambiguous and two addresses never compete for the same content. Slugs are shared and
English (`/el/how-it-works`, not `/el/pos-leitourgei`), which gives up Greek keywords in the
path deliberately, in exchange for one route table, one set of link targets, and a language
switcher that is a path-segment swap rather than a lookup.

## The route shape

```ts
export const routes: Routes = [
  {
    path: ':lang',
    canMatch: [languageMatches], // only 'el' | 'en'; anything else falls through
    resolve: { lang: activateLanguage }, // sets Transloco before any child resolver
    children: localizedRoutes,
  },
  { path: '', pathMatch: 'full', children: [] }, // the server negotiates this
  notFoundRoute,
];
```

`canMatch` rather than a guard inside the route: an unknown first segment must _fail to
match_, so the wildcard can answer it rather than the route matching and then redirecting.
`/foo` is a 404, not a language.

### `activateLanguage` is the ordering constraint

Every feature library's `preload…Translations` resolver reads
`transloco.getActiveLang()`. A parent `resolve` runs before child resolvers, so this is the
only hook early enough. A component constructor, an `effect`, or an `APP_INITIALIZER` are
all too late — the child resolver will already have loaded the wrong dictionary, and on a
prerendered route that wrong dictionary is baked into a file.

That failure reads as a translation bug rather than an ordering one, so the assertion worth
writing is against the _prerendered output_ — see `tools/seo/check-prerender.mjs`.

## `[langLink]`

`routerLink` with the active language in front of it. Write targets the way they read in the
route table and the prefix is added for you:

```html
<a langLink="/barbershops">…</a>
<a [langLink]="['/barbershops', slug]" [queryParams]="{ near: 'me' }">…</a>
```

It _is_ a `RouterLink` with one input renamed, so every other input still works. Relative
targets and `UrlTree`s are passed through untouched — they are already anchored to a route
that carries the prefix.

A missed link is not a crash: it navigates to an unprefixed path, fails `canMatch`, and
lands on the 404 page. Loud, deliberately — the quiet version of this failure is the one
that survives testing.

`@ui/*` components are not swept, because they take link targets as data from their callers.
That seam is what keeps the change small: build the target with `withLanguagePrefix` at the
call site and the UI library stays unaware that the site has languages at all.

## `LOCALE_ID` does not follow Transloco

Angular's date, number and currency pipes read `LOCALE_ID`, a DI value fixed at bootstrap.
Transloco moving does not move it. The app provides it from the path instead
(`provideAppLanguage` in `apps/koureia`), which works because a server injector is per
request and a language switch in the browser is a full navigation.

**This is a silent failure mode.** Nothing throws — a Greek page just renders American
dates.

## Greek is the answer, not a fallback

The site is Greek until a person says otherwise. `Accept-Language` is not read anywhere: a
device setting is not a person speaking, and an English-configured browser in Greece is the
common case, not the exception.

English is reached two ways, and both are statements about a person: the switcher, which
writes the preference cookie while anonymous and the profile while signed in, and the
account's stored preference, which outranks the cookie. That is the whole of the precedence
order in `chooseLanguage` (`apps/koureia/src/language-routes.ts`).

`toAppLanguage` returns `null` rather than the default when it cannot answer, because every
caller in that chain needs to tell "no answer" from "the answer happens to be Greek".

The decision stays on Express, because the winning source is the sealed session cookie, which
is `HttpOnly`. Deciding in the browser would also flash the wrong language on first load.

## `/auth/*` is never language-prefixed

`/auth/callback` is a registered redirect URI in Keycloak, and one per language means two
registrations that have to stay in step forever. The language rides in `returnUrl` instead,
and the authorization request carries `ui_locales` so Keycloak's own form matches the site
the person came from.

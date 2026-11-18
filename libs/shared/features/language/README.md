# @features/language

The language switcher — the control that moves a visitor to the same page in another
language.

```ts
import { LANGUAGE_PREFERENCE, LanguageSwitcher } from '@features/language';
```

```html
<lib-language-switcher size="sm" />
```

It lives in its own library because it appears in two places that share nothing else: the
landing header, and the account menu the signed-in chrome will grow.

## The target is a path-segment swap

`/el/how-it-works` → `/en/how-it-works`. Nothing is looked up, because both languages share
one set of English slugs. That is the same property that lets one route table serve both
languages, and adopting translated slugs later would turn this into a per-language map — see
`@util/language`.

## Switching is a full page load

On purpose. `LOCALE_ID` is a DI value fixed at bootstrap; Angular's date, number and currency
pipes read it and it does **not** follow Transloco. The only way the two cannot drift is for
the new language to arrive in a new injector, so the switcher assigns
`document.location` rather than calling the router. A `navigateByUrl` here would leave a Greek
page formatting American dates, and nothing would throw.

## Language-free pages pass `reloadUrl`

`/management/profile` has no language segment, so the swap would send it to
`/en/management/profile`, which does not exist. Such a page passes its own address:

```html
<lib-language-switcher reloadUrl="/management/profile#preferences" />
```

After the choice is stored, the switcher replaces the address with `history.replaceState` and
then calls `location.reload()`. A plain `location.assign()` to the same path with another
fragment only scrolls and never reloads.

## A page with unsaved edits passes `beforeSwitch`

The switch stores the language on the account before the page unloads. If a `beforeunload`
prompt then keeps the page, the account holds the new language and the page shows the old one.
A page with its own leave check passes it as `beforeSwitch`. When it returns `false`, nothing is
stored and the select shows the current language again.

```html
<lib-language-switcher ariaDescribedby="language-hint" [beforeSwitch]="canLeave" />
```

`ariaDescribedby` points the combobox at a hint beside it. Pages that pass neither input work
as before.

## `LANGUAGE_PREFERENCE` — the half the app owns

The switcher navigates; remembering is somebody else's job, and it has to be, because the
answer depends on whether there is a session:

- **anonymous** → a cookie, so the next visit and the negotiating root honour it;
- **signed in** → the profile, so the URL and the stored preference can never disagree.

Deciding that means reading the session, which lives in a `scope:auth` library that a
`scope:shared` one may not depend on. The boundary is right rather than in the way: a switcher
that hard-required an auth library could not ship in an app without accounts. So the app
supplies the half that knows about people:

```ts
// apps/<app>/src/app/app.config.ts
{ provide: LANGUAGE_PREFERENCE, useExisting: LanguagePreferenceStore }
```

The token is optional. Unprovided, the switcher still switches — it just forgets.

## Names are endonyms

«Ελληνικά», not «Greek». Someone hunting for their own language recognises its name _in_ that
language, which is also why the two names are not in the dictionaries: they would be the same
strings in every translation, and a translator would eventually "fix" one.

## The flags

`<lib-language-flag>` draws them inline. They carry the only hard-coded colours outside the
theme packages, and deliberately so: a national flag is artwork, not a design decision — it
has no light and dark variant, and the day it re-themes with the brand accent is the day it
stops being a flag. `check-tokens.mjs` exempts the `flags/` directory by name for exactly
that reason.

They are `aria-hidden`. A flag is a country and a language is not — Greek is spoken outside
Greece, English outside the United States — so announcing it would announce the wrong noun.
The language name beside it is what gets read.

## A note on the combobox

Two `<a href>` elements would work without JavaScript and be followed by a crawler; a combobox
is neither. Crawler discovery is covered regardless, because every public page carries
reciprocal `hreflang` alternates naming both languages — that is the signal a crawler reads
for this. What is given up is the no-JavaScript switch.

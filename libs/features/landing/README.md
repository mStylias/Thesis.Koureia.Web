# @features/landing

The marketing landing page — hero, customer journey, features, call to action,
`/how-it-works` — as a **routable feature any app can mount**. It carries no
brand of its own: name, wordmark, logo, hero image and colours all come from the
app it runs inside.

```ts
// apps/<app>/src/app/app.routes.ts
{ path: '', loadChildren: () => import('@features/landing').then((m) => m.landingRoutes) }
```

## What an app must provide

**1. A brand.** `provideBrand()` from [`@util/brand`](../../shared/util-brand/README.md).
The wordmark reads `wordmark` and `logo`; the hero reads `heroImage`. The logo
must be square — it renders in a square box.

**2. The brand-bearing copy**, in every available language, under the root
`brand.landing.*` keys. Type it with `LandingBrandCopy` and the compiler will
tell you when one is missing:

```ts
// apps/<app>/src/app/i18n/el.ts
import type { LandingBrandCopy } from '@features/landing';

const landing: LandingBrandCopy = {
  label: 'Αρχική σελίδα Koureia',      // accessible name of the wordmark link
  howTitle: 'Πώς λειτουργεί το Koureia', // <h1> of /how-it-works
  ctaTitle: 'Χτίζουμε το Koureia μαζί σου.',
  copyright: '© {{year}} Koureia',
};

const el: Translation = { titles: { … }, brand: { landing } };
```

Everything else — every string with no brand name in it — ships from this
library's own `landing` Transloco scope and needs nothing from the app.

### Why those four strings are app-owned

The obvious move is `'How {{brand}} works'` with the name interpolated. That
works in English and breaks in Greek: _"Πώς λειτουργεί **το** Koureia"_ needs the
article and case that this particular name takes, and the next tenant's name
takes different ones. One template string cannot be right for both, so the
strings themselves are the app's.

They deliberately sit **outside** the `landing.*` prefix. Transloco flattens a
scoped dictionary under its scope key and merges it into the plain language
dictionary — scoped and root keys share one namespace, so reading a root key
from inside this scope is fine, but a key placed under `landing.*` would be
overwritten when the scope loads.

`lib.routes.ts` therefore preloads the **root** dictionary alongside the scope.
Routes here are prerendered, and a missing root key at prerender time would bake
the fallback language into the static HTML.

## Scope of reuse

Every tenant gets the same sections in the same order — only brand, theme and
the copy above differ. Making sections droppable or reorderable per tenant is a
larger change (the routed page would compose from config instead of a fixed
template) and is deliberately not supported.

## Tests

`nx test features-landing`. Beyond rendering, the spec provides a **fake brand**
and asserts the string "koureia" appears nowhere in the rendered output — the
regression guard for a brand literal creeping back into a template, a dictionary
or an asset path.

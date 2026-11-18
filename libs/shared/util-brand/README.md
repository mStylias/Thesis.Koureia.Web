# @util/brand

The **tenant seam**. Two things a shared component may need that are not styling:
which brand it is running inside, and which theme the visitor wants.

```ts
import { BRAND, ThemeService, provideBrand } from '@util/brand';
```

## `BRAND`

An `InjectionToken<BrandConfig>` provided once per app. Shared UI and feature
libraries read it instead of hardcoding a name, wordmark, logo or hero image —
that is what lets `libs/features/landing` be reused by a second barbershop.

```ts
// apps/<app>/src/app/app.config.ts
providers: [
  provideBrand({
    id: 'koureia',
    name: 'Koureia',
    wordmark: 'koureia',
    logo: '/brand/koureia_icon.png',
    heroImage: '/images/hero-barbershop.webp',
    defaultTheme: 'system',
  }),
];
```

```ts
// in a shared component
private readonly brand = inject(BRAND);
```

Keep `BrandConfig` to facts the _design system or a shared feature_ needs.
Anything only one app cares about belongs in that app.

`logo` **must be square** — the wordmark renders it in a square box, so a wider
logo is letterboxed rather than cropped.

`BrandConfig` holds no _copy_. Translated strings that name the brand cannot be
interpolated in Greek, so they stay in the app's own dictionaries — see
[`@features/landing`](../../features/landing/README.md) for the pattern
and the `LandingBrandCopy` contract.

`provideBrand()` is a function returning providers, not a bare provider object,
so that a request-resolved variant (one deployment serving several domains) can
be added beside it without changing the token, the interface, or any consumer.
The workspace is build-time-per-brand today.

> **Never cache a `BrandConfig` in module scope or in a field of a root-provided
> singleton.** It is harmless with one app per brand, but it is precisely what
> would hand one request's brand to the next under a shared deployment. Read it
> per injection. `ThemeService` keeps only the resolved `defaultTheme` string for
> this reason.

## `ThemeService`

Owns `data-theme` on `<html>` and remembers the choice in `localStorage`.

```ts
private readonly theme = inject(ThemeService);

this.theme.set('dark');     // or 'light' | 'system'
this.theme.toggle();        // flips from whatever is showing now
this.theme.preference();    // 'light' | 'dark' | 'system'
this.theme.resolved();      // 'light' | 'dark' — `system` resolved against the OS
```

Three states, because `system` is a real choice and not the absence of one:

| `preference()` | `<html>`              |
| -------------- | --------------------- |
| `'light'`      | `data-theme="light"`  |
| `'dark'`       | `data-theme="dark"`   |
| `'system'`     | **attribute removed** |

Removing it is the mechanism, not an omission — absent is what hands control
back to `prefers-color-scheme`, which both `_dark.scss` and Tailwind's `dark:`
variant already honour. The CSS needs nothing else.

**No flash of the wrong theme.** Routes are prerendered at build time, so the
served HTML cannot know a visitor's choice — a cookie would not help either.
Each app's `index.html` therefore carries a small pre-paint script that applies
the stored value before first paint. Its storage key must match
`THEME_STORAGE_KEY`; the script runs before the bundle, so it cannot import it.
Change one, change the other.

**SSR-safe.** DOM access goes through `DOCUMENT`; `localStorage` and
`matchMedia` are reached via `document.defaultView`, which is absent on the
server. `localStorage` is also a getter that _throws_ in some privacy modes, so
even reaching for it is guarded — a denied read falls back to the OS rather than
breaking the app.

Nothing in the app injects `ThemeService` yet: it is constructed on first use, so
adding a toggle control is all that is left to make the choice reachable by a
visitor.

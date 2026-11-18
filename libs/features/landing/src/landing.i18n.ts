import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope definition for the landing route and its component tree. */
export const landingTranslocoScope = {
  scope: 'landing',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/** Scoped-loader form required when preloading translations directly. */
export const landingInlineLoader = {
  'landing/el': landingTranslocoScope.loader.el,
  'landing/en': landingTranslocoScope.loader.en,
} satisfies InlineLoader;

/**
 * The brand-bearing copy this library deliberately does **not** own.
 *
 * A `{{brand}}` placeholder cannot work in Greek: *"Πώς λειτουργεί το Barbershop"* needs
 * the right article and case per name, so one template string gets the next tenant's
 * grammar wrong. These strings live in the app's root dictionary under `brand.landing.*`,
 * and every app must supply them in every language.
 *
 * Reading a root key from inside the `landing` scope is safe — Transloco merges a scoped
 * dictionary into the plain one, so they share a namespace. The prefix must stay *outside*
 * `landing.*`: that merge lets a scope load overwrite same-prefixed keys, so an override
 * under `landing.*` would be silently clobbered.
 *
 * ```ts
 * // apps/<app>/src/app/i18n/el.ts
 * const landing: LandingBrandCopy = { label: '…', howTitle: '…', … };
 * const el: Translation = { titles: { … }, brand: { landing } };
 * ```
 */
export interface LandingBrandCopy {
  /** Accessible name of the wordmark link, e.g. `'Barbershop home page'`. */
  readonly label: string;

  /** `<h1>` of `/how-it-works`, e.g. `'How Barbershop works'`. */
  readonly howTitle: string;

  /** Heading of the closing call to action. */
  readonly ctaTitle: string;

  /** Footer fine print. Receives `{{year}}`. */
  readonly copyright: string;
}

/**
 * Root prefix the templates read `LandingBrandCopy` from. Exported for tests and CI;
 * templates spell the keys out so they stay greppable.
 */
export const LANDING_BRAND_COPY_PREFIX = 'brand.landing';

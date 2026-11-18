import { inject, InjectionToken } from '@angular/core';

/**
 * What a shared component needs to know about the brand it runs inside. One app serves one
 * brand, so a provider supplies this once at bootstrap.
 *
 * Keep it to facts the design system or a shared feature needs. A fact that only one app uses
 * belongs in that app.
 */
export interface BrandConfig {
  /**
   * A stable slug, such as `'barbershop-x'`. It never reaches a user. Use it for asset paths,
   * logging and analytics. A one-deployment-many-domains setup writes it to `data-brand` on
   * `<html>`.
   */
  readonly id: string;

  /** The display name, such as `'Barbershop X'`. Headings and the copyright line use it. */
  readonly name: string;

  /** The lowercase wordmark text, such as `'barbershop-x'`. */
  readonly wordmark: string;

  /**
   * The logo path under the app's public directory, such as `'/brand/icon.png'`.
   *
   * CAUTION: The image must be square. The wordmark draws it in a square box sized by
   * `--wordmark-icon-size`, so a wider logo is letterboxed and not cropped.
   */
  readonly logo: string;

  /** The landing hero image path, such as `'/images/hero.webp'`. */
  readonly heroImage: string;

  /** The theme to use when the visitor stated no preference. */
  readonly defaultTheme: 'light' | 'dark' | 'system';
}

export const BRAND = new InjectionToken<BrandConfig>('BRAND');

/**
 * Registers the brand for an app.
 *
 * ```ts
 * // apps/<app>/src/app/app.config.ts
 * providers: [provideBrand({ id: 'barbershop-x', name: 'Barbershop X', … })]
 * ```
 *
 * It is a function and not a bare provider object, so a request-resolved variant, for one
 * deployment across several domains, can join it without a change to this token, this
 * interface or any consumer.
 */
export function provideBrand(config: BrandConfig) {
  return [{ provide: BRAND, useValue: config }];
}

/**
 * A shorthand for the common case.
 *
 * CAUTION: Read the brand once per injection. Never cache the result in module scope or in a
 * field of a root-provided singleton. Under SSR that hands one request's brand to another.
 */
export function injectBrand(): BrandConfig {
  return inject(BRAND);
}

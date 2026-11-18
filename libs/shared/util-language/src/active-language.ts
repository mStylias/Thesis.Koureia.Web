import { Service, inject, signal } from '@angular/core';
import { CanMatchFn, ResolveFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';

import { AppLanguage, DEFAULT_APP_LANGUAGE, isAppLanguage, toAppLanguage } from './language';

/**
 * The language the current page is published in, as a signal.
 *
 * {@link activateLanguage} writes it once per navigation, and anything that builds an address
 * reads it: `[langLink]`, the `hreflang` alternates and the switcher. It is a signal and not a
 * constant, because one server process renders many languages, and a constant would hold
 * whichever request bootstrapped first.
 */
@Service()
export class ActiveLanguage {
  private readonly current = signal<AppLanguage>(DEFAULT_APP_LANGUAGE);

  readonly value = this.current.asReadonly();

  set(language: AppLanguage): void {
    this.current.set(language);
  }
}

/**
 * Matches only a real language as the first segment.
 *
 * It is a `canMatch` and not a guard inside the route. An unknown first segment must fail to
 * match, so the wildcard answers it instead of the route matching and then redirecting. `/foo`
 * is a 404 and not a language.
 */
export const languageMatches: CanMatchFn = (_route, segments) => isAppLanguage(segments[0]?.path);

/**
 * Sets the active language, then loads its root dictionary.
 *
 * WARNING: This is the ordering constraint of the whole design. Every feature library's
 * `preload…Translations` resolver reads `transloco.getActiveLang()`, and a parent `resolve` is
 * the only hook that runs before them. A component constructor, an `effect` and an
 * `APP_INITIALIZER` are all too late: the child resolver has already loaded the wrong
 * dictionary. On a prerendered route that wrong dictionary is baked into a file, where it
 * reads as a translation bug and not an ordering one.
 *
 * This resolver loads the root dictionary instead of leaving it to the children, because two
 * things outside every feature library read root keys during the render: the page title and
 * the `<meta name="description">`.
 */
export const activateLanguage: ResolveFn<AppLanguage> = (route) => {
  const transloco = inject(TranslocoService);
  const active = inject(ActiveLanguage);

  // `canMatch` already refused anything else. The fallback satisfies the type.
  const language = toAppLanguage(route.paramMap.get('lang')) ?? DEFAULT_APP_LANGUAGE;

  transloco.setActiveLang(language);
  active.set(language);

  return transloco.load(language).pipe(map(() => language));
};

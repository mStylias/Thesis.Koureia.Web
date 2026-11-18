import {
  afterNextRender,
  booleanAttribute,
  Component,
  DestroyRef,
  inject,
  input,
  isDevMode,
  signal,
} from '@angular/core';
import { LucideMenu } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { AuthEntry } from '@auth/feature-session';
import { LanguageSwitcher } from '@features/language';
import { Button } from '@ui/button';
import { Drawer } from '@ui/drawer';
import { ThemeToggle } from '@ui/theme-toggle';
import { LangLink } from '@util/language';

import { SiteBrand } from '../site-brand/site-brand';
import { siteLayoutTranslocoScope } from '../site-layout.i18n';

/**
 * The bar at the top of a public page: the wordmark, the site's pages, the language and the
 * account. Below `md` the pages and controls move into a drawer.
 *
 * ```html
 * <lib-site-header overlay />
 * <lib-site-header />
 * ```
 *
 * A route that renders it must resolve {@link preloadSiteHeaderTranslations}.
 */
@Component({
  selector: 'lib-site-header',
  imports: [
    AuthEntry,
    Button,
    Drawer,
    SiteBrand,
    LanguageSwitcher,
    LangLink,
    LucideMenu,
    ThemeToggle,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope(siteLayoutTranslocoScope)],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  host: {
    role: 'banner',
    '[class.is-scrolled]': 'scrolled()',
    '[attr.data-overlay]': 'overlay() ? "" : null',
  },
})
export class SiteHeader {
  /**
   * Lies over a dark hero, transparent and fixed, until the page scrolls. Without it the bar is
   * solid and sticks to the top of the page.
   */
  readonly overlay = input(false, { transform: booleanAttribute });

  /**
   * The theme toggle is a development control, not a published one.
   *
   * A constant and not a signal: the build decides this and it cannot change while the page is
   * open. Prerendering runs the production build, so a prerendered header carries no toggle.
   */
  protected readonly showThemeToggle = isDevMode();

  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const updateScrolled = (): void => {
        this.scrolled.set(window.scrollY > 0);
      };

      updateScrolled();
      window.addEventListener('scroll', updateScrolled, { passive: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', updateScrolled);
      });
    });
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}

import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { LucideMailWarning, LucideX } from '@lucide/angular';
import { SessionStore } from '@auth/data-access';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';
import { filter, map } from 'rxjs';

import { sessionTranslocoScope } from '../session.i18n';
import { EmailUnverifiedDismissalStore } from './email-unverified-dismissal.store';

/**
 * The address is still unproven, said on whatever page the person opened.
 *
 * The BFF callback sends every unverified session to the verification screen once. Somebody who
 * leaves that screen without a code is signed in, unverified, and told nothing: the API answers
 * their first real action with a 403 that reads as a broken product. This is the standing reminder
 * that closes that gap, with the way back to the screen attached.
 *
 * The app shell renders it, because it belongs to the session and not to a route, as a bar fixed to
 * the bottom of the viewport — the top edge belongs to each page's own fixed header. It says
 * nothing on the verification screen itself, and nothing until the session has actually answered:
 * a reminder shown to somebody who turns out to be verified is worse than a late one.
 */
@Component({
  selector: 'auth-email-unverified',
  imports: [Banner, Button, LucideX, RouterLink, TranslocoPipe],
  providers: [provideTranslocoScope(sessionTranslocoScope)],
  templateUrl: './email-unverified.html',
  styleUrl: './email-unverified.scss',
  host: {
    // The element stays in the accessibility tree empty, and the notice arrives as a change
    // inside it. A live region inserted with its message already in it is announced by no
    // screen reader reliably, and `hidden` on the host would make revealing it the same
    // insertion again.
    role: 'status',
  },
})
export class EmailUnverified {
  private readonly session = inject(SessionStore);
  private readonly dismissal = inject(EmailUnverifiedDismissalStore);
  private readonly language = inject(ActiveLanguage);
  private readonly router = inject(Router);

  protected readonly mailIcon = LucideMailWarning;

  /**
   * Browser only. A personal server render knows the address is unproven but cannot know this tab
   * put the reminder away, so it would ship a banner hydration then deletes. Arriving after
   * hydration also makes the notice a change inside the live region instead of part of the
   * document, which is the form a screen reader actually reads out.
   */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Also the `returnUrl` the verification screen brings the person back to. */
  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed(
    () =>
      this.isBrowser &&
      this.session.isReady() &&
      this.session.isSignedIn() &&
      !this.session.isEmailVerified() &&
      !this.dismissal.dismissed() &&
      !isVerificationPage(this.currentUrl()),
  );

  protected readonly verifyLink = computed(() =>
    withLanguagePrefix(`/${VERIFY_EMAIL_PATH}`, this.language.value()),
  );

  constructor() {
    // Proving the address makes an old dismissal a trap: this tab can sign out and back in as a
    // second, unverified account, and the stale flag would keep that account uninformed.
    effect(() => {
      if (this.session.isEmailVerified()) this.dismissal.reset();
    });
  }

  protected dismiss(): void {
    this.dismissal.dismiss();
  }
}

/**
 * The verification route's path segment.
 *
 * It is spelled out and not imported: the route is the app's (`app.routes.ts`) and the redirect
 * that first sends people to it is the BFF's (`auth-routes.ts`), and this library may depend on
 * neither. All three must agree.
 */
const VERIFY_EMAIL_PATH = 'verify-email';

function isVerificationPage(url: string): boolean {
  const [path] = url.split(/[?#]/);
  const segments = path.split('/').filter((segment) => segment !== '');
  // Matches `/el/verify-email` and an unprefixed `/verify-email` alike.
  return segments.at(-1) === VERIFY_EMAIL_PATH;
}

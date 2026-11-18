import { isPlatformBrowser } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope, translateSignal } from '@jsverse/transloco';
import {
  LucideCalendarDays,
  LucideCircleUserRound,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideStar,
  LucideUser,
} from '@lucide/angular';
import { SessionStore, StaffAccessStore } from '@auth/data-access';
import { Button, ButtonSize } from '@ui/button';
import { Menu, MenuItem, MenuTrigger } from '@ui/menu';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';

import { sessionTranslocoScope } from '../session.i18n';

/**
 * The session entry point: sign in when anonymous, account menu when signed in.
 *
 * ```html
 * <auth-entry size="sm" />
 * <auth-entry layout="block" size="lg" signUp />
 * ```
 *
 * The action starts on the app server, which redirects the browser to Keycloak. This app never
 * renders a password field.
 *
 * It never shows a signed-out guess. Without a signed-in hint it holds the space of the
 * anonymous actions but keeps them invisible until `isReady()`. Sign-out sits in the account
 * menu beside the identity, so the action always shows which session it ends.
 */
@Component({
  selector: 'auth-entry',
  imports: [Button, LucideCircleUserRound, Menu, MenuTrigger, TranslocoPipe],
  providers: [provideTranslocoScope(sessionTranslocoScope)],
  template: `
    @if (!session.isSignedIn()) {
      <button
        libButton
        class="auth-entry__sign-in"
        type="button"
        variant="outlined"
        severity="secondary"
        [size]="size()"
        [disabled]="!session.isReady()"
        [attr.aria-hidden]="session.isReady() ? null : true"
        (click)="signIn()"
      >
        {{ 'auth.entry.signIn' | transloco }}
      </button>
      @if (signUp()) {
        <button
          libButton
          class="auth-entry__sign-up"
          type="button"
          [size]="size()"
          [disabled]="!session.isReady()"
          [attr.aria-hidden]="session.isReady() ? null : true"
          (click)="startSignUp()"
        >
          {{ 'auth.entry.signUp' | transloco }}
        </button>
      }
    } @else {
      <button
        libButton
        class="auth-entry__avatar"
        type="button"
        variant="text"
        severity="secondary"
        size="md"
        iconOnly
        rounded
        [libMenuTriggerFor]="accountMenu"
        [attr.aria-label]="openAccountMenuLabel()"
      >
        <svg lucideCircleUserRound aria-hidden="true"></svg>
      </button>
      <lib-menu #accountMenu [items]="accountItems()" [ariaLabel]="accountMenuLabel()" />
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    :host([data-deciding]) .auth-entry__sign-in,
    :host([data-deciding]) .auth-entry__sign-up {
      visibility: hidden;
    }

    .auth-entry__avatar svg {
      width: var(--icon-size-lg);
      height: var(--icon-size-lg);
      stroke-width: var(--icon-stroke);
    }

    :host([data-layout='block']) .auth-entry__sign-in,
    :host([data-layout='block']) .auth-entry__sign-up {
      flex: 1 1 0;
    }
  `,
  host: {
    '[attr.data-layout]': 'layout()',
    '[attr.data-deciding]': 'session.isReady() ? null : ""',
  },
})
export class AuthEntry {
  private readonly router = inject(Router);
  private readonly language = inject(ActiveLanguage);

  protected readonly session = inject(SessionStore);
  private readonly access = inject(StaffAccessStore);
  protected readonly accountMenuLabel = translateSignal('entry.accountMenu');
  protected readonly openAccountMenuLabel = translateSignal('entry.openAccountMenu');

  private readonly profileLabel = translateSignal('entry.profile');
  private readonly bookingsLabel = translateSignal('entry.bookings');
  private readonly reviewsLabel = translateSignal('entry.reviews');
  private readonly signOutLabel = translateSignal('entry.signOut');
  private readonly managementLabel = translateSignal('entry.management');

  protected readonly accountItems = computed<readonly MenuItem[]>(() => {
    const claims = this.session.claims();
    const displayName = [claims?.givenName, claims?.familyName].filter(Boolean).join(' ');
    // `@ui/menu` hands link targets straight to `routerLink`, so `langLink` never sees them.
    // The prefix goes on here, which also keeps the ui library unaware of languages.
    const path = (target: string): string => withLanguagePrefix(target, this.language.value());

    // `/management` carries no language segment, so it takes no prefix.
    const pages: readonly MenuItem[] = this.access.canOpenWorkspace()
      ? [{ label: this.managementLabel(), icon: LucideLayoutDashboard, routerLink: '/management' }]
      : [
          {
            label: this.bookingsLabel(),
            icon: LucideCalendarDays,
            routerLink: path('/account/appointments'),
          },
          { label: this.reviewsLabel(), icon: LucideStar, routerLink: path('/account/reviews') },
          { label: this.profileLabel(), icon: LucideUser, routerLink: path('/account/profile') },
        ];

    return [
      ...(displayName === '' ? [] : [{ label: displayName, heading: true }]),
      ...pages,
      { separator: true },
      {
        label: this.signOutLabel(),
        icon: LucideLogOut,
        command: () => {
          void this.session.signOut();
        },
      },
    ];
  });

  /** Matches the surrounding controls. `sm` in a header, `lg` on a landing section. */
  readonly size = input<ButtonSize>('md');

  /** `inline` shrinks to the label. `block` fills the width of a column. */
  readonly layout = input<'inline' | 'block'>('inline');

  /**
   * Adds a primary sign-up button beside sign-in. Off by default, because one way in is enough
   * in a header. Turn it on where the copy has just explained why an account is worth having.
   */
  readonly signUp = input(false, { transform: booleanAttribute });

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    // The API refuses an unverified address, so the read waits for the claim. A hinted session
    // has no claims yet.
    effect(() => {
      if (isBrowser && this.session.isEmailVerified()) void this.access.resolve();
    });
  }

  protected signIn(): void {
    this.session.signIn(this.router.url);
  }

  protected startSignUp(): void {
    this.session.signUp(this.router.url);
  }
}

import { DOCUMENT, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Component, effect, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCalendarCheck, LucideChevronDown, LucideChevronRight } from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { SessionStore, StaffAccessStore } from '@auth/data-access';
import { Button } from '@ui/button';
import { BRAND } from '@util/brand';
import { LangLink } from '@util/language';

@Component({
  selector: 'lib-landing-hero',
  imports: [
    Button,
    LucideCalendarCheck,
    LucideChevronDown,
    LucideChevronRight,
    NgOptimizedImage,
    LangLink,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './landing-hero.html',
  styleUrl: './landing-hero.scss',
})
export class LandingHero {
  private readonly document = inject(DOCUMENT);
  private readonly session = inject(SessionStore);
  private readonly access = inject(StaffAccessStore);
  protected readonly brand = inject(BRAND);

  /** Staff get their workspace in place of booking. Customer copy shows until the read answers. */
  protected readonly isStaff = this.access.canOpenWorkspace;

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    // The API refuses an unverified address, so the read waits for the claim.
    effect(() => {
      if (isBrowser && this.session.isEmailVerified()) void this.access.resolve();
    });
  }

  protected scrollToJourney(event: MouseEvent): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = this.document.getElementById('how-it-works');
    const window = this.document.defaultView;
    if (!target || !window) {
      return;
    }

    event.preventDefault();

    if (window.location.hash !== '#how-it-works') {
      window.history.pushState(null, '', '#how-it-works');
    }

    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

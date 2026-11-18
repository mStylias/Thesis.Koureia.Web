import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LucideBellRing, LucideChevronDown } from '@lucide/angular';
import { UserProfileApi } from '@api/users';
import { Button } from '@ui/button';
import { ToasterService } from '@ui/toaster';

import { PushReminders } from '../push-reminders';
import { remindersTranslocoScope } from '../reminders.i18n';
import { ReminderGuide } from '../setup-guide/reminder-guide';
import { ReminderCardDismissal } from './reminder-card-dismissal';

/** The states in which the card offers push. */
const OFFERED = new Set(['available', 'off', 'needs-home-screen', 'in-app-browser']);

/** The states in which the pill points at the card. An in-app browser has nothing to tap. */
const CUED = new Set(['available', 'off', 'needs-home-screen']);

/** The share of the card that must be on screen before it counts as seen. */
const SEEN_RATIO = 0.5;

/**
 * The offer to turn push on, after a booking.
 *
 * ```html
 * <lib-reminder-card />
 * ```
 *
 * It renders nothing on the server, nothing while the state is unknown, and nothing when push
 * cannot work here or is blocked: Settings handles those. "Not now" hides it on this browser for
 * 30 days. Once push is on, it is one line.
 *
 * The card fades in after `--reminder-card-delay`, so a host can place it last in its own
 * sequence.
 *
 * With `cue`, a pill floats at the bottom of a screen narrower than `lg` while the card is below
 * the fold. A tap scrolls to the card. The pill goes for good once the card has been seen.
 */
@Component({
  selector: 'lib-reminder-card',
  imports: [Button, LucideBellRing, LucideChevronDown, ReminderGuide, TranslocoPipe],
  providers: [provideTranslocoScope(remindersTranslocoScope)],
  templateUrl: './reminder-card.html',
  styleUrl: './reminder-card.scss',
})
export class ReminderCard {
  private readonly push = inject(PushReminders);
  private readonly profiles = inject(UserProfileApi);
  private readonly dismissal = inject(ReminderCardDismissal);
  private readonly toaster = inject(ToasterService);
  private readonly transloco = inject(TranslocoService);
  private readonly window = inject(DOCUMENT).defaultView;

  /** Floats a pill that scrolls to the card while the card is below the fold. */
  readonly cue = input(false, { transform: booleanAttribute });

  protected readonly state = this.push.state;
  protected readonly enabling = signal(false);
  protected readonly guideOpen = signal(false);

  /** Read after the first render, so the server and the browser render the same nothing. */
  private readonly dismissed = signal(true);

  private readonly offered = computed(() => OFFERED.has(this.state()));

  /** The email sentence goes when the customer turned the reminder emails off. */
  private readonly profile = rxResource({
    params: () => (this.offered() && !this.dismissed() ? {} : undefined),
    stream: () => this.profiles.current(),
  });

  protected readonly emailOn = computed(() =>
    this.profile.hasValue() ? this.profile.value().emailRemindersEnabled : true,
  );

  protected readonly visible = computed(() => {
    if (this.state() === 'on') return true;
    return this.offered() && !this.dismissed() && !this.profile.isLoading();
  });

  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  private readonly cardBelow = signal(false);
  private readonly cueSpent = signal(false);

  protected readonly cueVisible = computed(
    () =>
      this.cue() &&
      this.visible() &&
      CUED.has(this.state()) &&
      this.cardBelow() &&
      !this.cueSpent(),
  );

  /** Set once by the pill. Its CSS animation plays once, so nothing has to clear it. */
  protected readonly highlighted = signal(false);

  constructor() {
    afterNextRender(() => {
      this.dismissed.set(this.dismissal.isDismissed());
      void this.push.check();
    });

    effect((onCleanup) => {
      const card = this.card()?.nativeElement;
      // The server and jsdom have no IntersectionObserver.
      if (!this.cue() || card === undefined || this.window?.IntersectionObserver === undefined) {
        return;
      }

      const observer = new this.window.IntersectionObserver(
        ([entry]) => {
          if (entry.intersectionRatio >= SEEN_RATIO) {
            this.cueSpent.set(true);
            observer.disconnect();
            return;
          }
          this.cardBelow.set(entry.boundingClientRect.top > 0);
        },
        { threshold: [0, SEEN_RATIO] },
      );
      observer.observe(card);
      onCleanup(() => {
        observer.disconnect();
      });
    });
  }

  protected reveal(): void {
    const card = this.card()?.nativeElement;
    if (card === undefined) return;

    this.cueSpent.set(true);
    const still = this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
    card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    // The pill is gone, so focus must land somewhere a keyboard or a screen reader can go on from.
    card.focus({ preventScroll: true });
    this.highlighted.set(true);
  }

  protected async enable(): Promise<void> {
    if (this.enabling()) return;
    this.enabling.set(true);
    const outcome = await this.push.enable();
    this.enabling.set(false);

    if (outcome === 'on') this.toaster.success(this.transloco.translate('reminders.outcome.on'));
    if (outcome === 'failed') {
      this.toaster.error(this.transloco.translate('reminders.outcome.failed'));
    }
  }

  protected notNow(): void {
    this.dismissal.dismiss();
    this.dismissed.set(true);
  }
}

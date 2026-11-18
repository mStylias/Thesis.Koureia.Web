import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Button } from '@ui/button';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import { appHomeUrl } from '../../app-home';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';
import { REDIRECT_SECONDS, describeOutcome, isFinished, resolveLink } from './info.logic';

/**
 * The end of every Keycloak flow that finishes with a message, a password reset included.
 *
 * A finished flow returns to the site after {@link REDIRECT_SECONDS}. The link is the way out
 * for anyone who will not wait and for the case where the timer cannot run. Only a success
 * redirects. See {@link isFinished}.
 *
 * The countdown ships with a control that stops it, because WCAG 2.2.1 allows a time limit only
 * when the reader can turn it off. Five seconds is too short to extend instead.
 */
@Component({
  selector: 'kc-info-page',
  imports: [AuthFrame, Button],
  templateUrl: './info.html',
  styleUrl: './info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'info.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  private readonly document = inject(DOCUMENT);

  protected readonly finished = isFinished(this.kcContext.message.type);

  protected readonly link = resolveLink({
    finished: this.finished,
    skipLink: this.kcContext.skipLink,
    pageRedirectUri: this.kcContext.pageRedirectUri,
    actionUri: this.kcContext.actionUri,
    clientBaseUrl: this.kcContext.client.baseUrl,
    appHome: appHomeUrl(this.kcContext, this.i18n),
  });

  protected readonly secondsLeft = signal(REDIRECT_SECONDS);
  /** Whether the page is still going to leave on its own. False once cancelled. */
  protected readonly redirecting = signal(false);

  /** Two strings, so neither language reads "in 1 seconds". */
  protected readonly countdown = computed(() =>
    this.secondsLeft() === 1
      ? this.i18n.msgStr('infoRedirectCountdownOne')
      : this.i18n.msgStr('infoRedirectCountdown', String(this.secondsLeft())),
  );

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    const destination = this.finished ? this.link?.href : undefined;
    if (destination === undefined) return;

    this.redirecting.set(true);
    this.timer = setInterval(() => {
      const remaining = this.secondsLeft() - 1;
      this.secondsLeft.set(remaining);

      if (remaining <= 0) {
        this.stopRedirect();
        this.document.location.assign(destination);
      }
    }, 1_000);

    // For a test that destroys the page and for a hot reload. This page normally navigates away
    // instead, but an interval that outlives its component still fires the redirect.
    inject(DestroyRef).onDestroy(() => {
      this.stopRedirect();
    });
  }

  /**
   * The headline. Keycloak sends a message key such as `accountUpdatedTitle`, not a sentence,
   * so it goes through `advancedMsgStr`. Printed raw it reads as the key.
   */
  protected title(): string {
    const header = this.kcContext.messageHeader;
    if (header !== undefined) return this.i18n.advancedMsgStr(header);

    return this.i18n.msgStr(this.finished ? 'infoSuccessTitle' : 'infoNoticeTitle');
  }

  /** Keycloak names each pending action by key, so translate them here. */
  protected description(): string {
    const requiredActions = this.kcContext.requiredActions ?? [];

    return describeOutcome(
      this.kcContext.message.summary,
      requiredActions.map((action) => this.i18n.advancedMsgStr(`requiredAction.${action}`)),
    );
  }

  /** Cancels the automatic redirect. The link stays; only the timer goes. */
  protected stopRedirect(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.redirecting.set(false);
  }
}

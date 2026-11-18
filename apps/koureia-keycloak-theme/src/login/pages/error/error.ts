import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Button } from '@ui/button';
import { appHomeUrl } from '../../app-home';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

/**
 * Where a flow ends when it cannot continue: a bad or reused action token, a misconfigured
 * client, an identity provider that refused.
 *
 * Nothing can be retried from here, so the page offers one way out. `skipLink` is Keycloak asking
 * for no way back at all, which it does when returning to the client would restart the failure.
 */
@Component({
  selector: 'kc-error-page',
  imports: [AuthFrame, Button],
  templateUrl: './error.html',
  styleUrl: './error.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'error.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);

  protected readonly link = this.resolveLink();

  private resolveLink(): { href: string; labelKey: 'goToHome' | 'backToApplication' } | undefined {
    if (this.kcContext.skipLink) return undefined;

    const clientBaseUrl = this.kcContext.client.baseUrl;

    return clientBaseUrl === undefined
      ? { href: appHomeUrl(this.kcContext, this.i18n), labelKey: 'goToHome' }
      : { href: clientBaseUrl, labelKey: 'backToApplication' };
  }
}

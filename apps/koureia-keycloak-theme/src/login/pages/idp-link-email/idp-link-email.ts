import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import { identityProviderName } from '../../identity-provider';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

/**
 * The step after the visitor agrees to link: prove the existing account is theirs.
 *
 * Keycloak mails a link and waits. The mail can be opened anywhere, so the flow also finishes in
 * a different browser than the one holding this page, which is why the page offers a way to carry
 * on as well as a way to send the mail again.
 */
@Component({
  selector: 'kc-idp-link-email-page',
  imports: [AuthFrame, Banner, Button],
  templateUrl: './idp-link-email.html',
  styleUrl: './idp-link-email.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdpLinkEmailPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-idp-link-email.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);

  protected readonly providerName = identityProviderName(this.kcContext.idpAlias);

  protected description(): string {
    return this.i18n.msgStr(
      'idpLinkEmailDescription',
      this.kcContext.brokerContext.username,
      this.providerName,
    );
  }
}

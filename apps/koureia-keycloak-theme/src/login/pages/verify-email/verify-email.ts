import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

/**
 * The wait after the `VERIFY_EMAIL` required action sends its mail.
 *
 * Nothing here completes the flow. The link in the mail does that, in whichever tab it opens, so
 * the only action this page offers is sending the mail again — `url.loginAction`, which Keycloak
 * treats as "resend" on this page.
 */
@Component({
  selector: 'kc-verify-email-page',
  imports: [AuthFrame, Banner, Button],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-verify-email.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);

  /**
   * Keycloak sends the address as a placeholder. It is omitted rather than left as a literal
   * `{0}` when the flow has no user attached, which happens on a restarted session.
   */
  protected description(): string {
    const email = this.kcContext.user?.email;

    return email === undefined
      ? this.i18n.msgStr('emailVerifyNoAddress')
      : this.i18n.msgStr('emailVerifyInstruction1', email);
  }
}

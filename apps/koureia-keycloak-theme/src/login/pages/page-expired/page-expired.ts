import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Button } from '@ui/button';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

/**
 * What a stale sign-in tab lands on: the authentication session behind it has expired.
 *
 * Keycloak offers two exits and they are not equivalent. `loginRestartFlowUrl` throws the old
 * session away and starts a clean one, which always works. `loginAction` resumes the flow at the
 * step it stopped at, which is faster but fails if the session is gone rather than stale. The
 * restart therefore leads.
 */
@Component({
  selector: 'kc-page-expired-page',
  imports: [AuthFrame, Button],
  templateUrl: './page-expired.html',
  styleUrl: './page-expired.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageExpiredPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-page-expired.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
}

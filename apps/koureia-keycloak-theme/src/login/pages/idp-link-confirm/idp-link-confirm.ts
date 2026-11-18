import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

/**
 * Where Google sign-in lands when the address already belongs to a password account.
 *
 * Keycloak accepts two answers here and this page sends only one of them. `linkAccount` attaches
 * the provider and leaves the stored profile alone. `updateProfile` detours through
 * `idp-review-user-profile.ftl`, which Keycloak fills from the provider rather than from the
 * account, so submitting it replaces a name the person chose with the one on their Google
 * profile. There is no way to fill that form from the account instead — the account is not in the
 * page context — so the detour is not offered.
 */
@Component({
  selector: 'kc-idp-link-confirm-page',
  imports: [AuthFrame, Banner, Button],
  templateUrl: './idp-link-confirm.html',
  styleUrl: './idp-link-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdpLinkConfirmPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-idp-link-confirm.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);

  protected readonly submitting = signal(false);
}

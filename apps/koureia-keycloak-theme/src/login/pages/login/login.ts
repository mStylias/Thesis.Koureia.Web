import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { InputText } from '@ui/input-text';
import { PasswordInput } from '@ui/password-input';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';
import { withKcLocale } from '../../locale-url';
import { themeAssetUrl } from '../../theme-assets';

@Component({
  selector: 'kc-login-page',
  imports: [AuthFrame, Banner, Button, Checkbox, InputText, PasswordInput],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  protected readonly submitting = signal(false);
  protected readonly rememberMe = signal(this.kcContext.login.rememberMe === 'on');
  protected readonly googleIconUrl = themeAssetUrl(
    this.kcContext.url.resourcesPath,
    '/brand/google-g.png',
  );

  /**
   * Keycloak reports a failed login twice: once as the global message and once against the
   * username and password fields. Suppress the banner when the inline error carries it.
   */
  protected readonly pageMessage = computed(() =>
    this.kcContext.messagesPerField.existsError('username', 'password')
      ? undefined
      : this.kcContext.message,
  );

  /** Carries the page language into the reset flow, which is what sends the mail. */
  protected readonly resetCredentialsUrl = computed(() =>
    withKcLocale(
      this.kcContext.url.loginResetCredentialsUrl,
      this.i18n.currentLanguage.languageTag,
    ),
  );

  protected isGoogleProvider(alias: string): boolean {
    return alias.toLowerCase() === 'google';
  }

  protected usernameLabel(): string {
    const realm = this.kcContext.realm;
    if (!realm.loginWithEmailAllowed) {
      return this.i18n.msgStr('username');
    }
    if (!realm.registrationEmailAsUsername) {
      return this.i18n.msgStr('usernameOrEmail');
    }
    return this.i18n.msgStr('email');
  }
}

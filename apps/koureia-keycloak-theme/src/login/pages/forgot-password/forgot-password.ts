import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { InputText } from '@ui/input-text';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';
import { passwordResetInstructionKey, usernameLabelKey } from './forgot-password.logic';

@Component({
  selector: 'kc-forgot-password-page',
  imports: [AuthFrame, Banner, Button, InputText],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-reset-password.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  protected readonly submitting = signal(false);

  protected usernameLabel(): string {
    return this.i18n.msgStr(usernameLabelKey(this.kcContext.realm));
  }

  protected instruction(): string {
    return this.i18n.msgStr(passwordResetInstructionKey(this.kcContext.realm));
  }
}

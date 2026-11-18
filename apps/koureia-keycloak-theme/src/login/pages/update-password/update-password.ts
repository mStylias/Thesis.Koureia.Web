import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { PasswordInput } from '@ui/password-input';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';
import { createPasswordRules } from '../../password-rules';
import { PASSWORD_ERROR_FIELDS, canCancel, meetsPasswordRules } from './update-password.logic';

/**
 * Where an emailed reset link ends: choose the new password.
 *
 * Keycloak reaches this page two ways and it serves both. A reset link arrives with no previous
 * page and no old password. The account console sends the same person here on purpose, and
 * Keycloak marks that with `isAppInitiatedAction`, the only case with somewhere to cancel to.
 *
 * Keycloak's form takes `password-new` and `password-confirm` and rejects a mismatched pair.
 * This page shows one field and posts its value as both, the same trade
 * `doMakeUserConfirmPassword: false` makes on registration: the reveal control already stops the
 * typo a second field would catch, and a second field is the one people abandon.
 *
 * The requirements come from {@link createPasswordRules}, because Keycloak sends no
 * `passwordPolicies` here.
 */
@Component({
  selector: 'kc-update-password-page',
  imports: [AuthFrame, Banner, Button, Checkbox, PasswordInput],
  templateUrl: './update-password.html',
  styleUrl: './update-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatePasswordPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-update-password.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('form');

  protected readonly password = signal('');
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);
  /**
   * On deliberately. Keycloak ships this box unchecked, but a visitor who forgot a password may
   * have lost it to somebody else. Ending the other sessions costs an honest visitor one more
   * sign-in and costs an intruder the account.
   */
  protected readonly logoutOtherSessions = signal(true);

  protected readonly passwordRules = createPasswordRules(undefined);
  protected readonly canCancel = canCancel(this.kcContext.isAppInitiatedAction);

  protected readonly hasServerFieldError = computed(() =>
    this.kcContext.messagesPerField.existsError(...PASSWORD_ERROR_FIELDS),
  );
  protected readonly hasLocalError = computed(
    () => this.submitAttempted() && !meetsPasswordRules(this.password(), this.passwordRules),
  );
  protected readonly hasError = computed(() => this.hasServerFieldError() || this.hasLocalError());
  protected readonly globalError =
    this.kcContext.message?.type === 'error' && !this.hasServerFieldError()
      ? this.kcContext.message
      : undefined;

  /**
   * Keycloak attributes the same rejection to either field name, so both appear under the one
   * field this page renders.
   */
  protected error(): string {
    if (this.hasLocalError()) {
      return this.i18n.msgStr('passwordRequirementsError');
    }
    return this.kcContext.messagesPerField.getFirstError(...PASSWORD_ERROR_FIELDS);
  }

  protected onSubmit(event: SubmitEvent): void {
    if ((event.submitter as HTMLButtonElement | null)?.name === 'cancel-aia') {
      this.submitting.set(true);
      return;
    }

    /*
     * Read the field, not the signal. The signal moves only on `input`, so a password manager
     * that assigns `.value` leaves it empty. The gate below would then refuse a password the
     * person can see, and the confirmation would go up blank.
     *
     * Write the confirmation straight to the DOM. The form leaves with this event, and Angular
     * has not flushed the binding by then.
     */
    const password = this.readPasswordField();
    this.password.set(password);
    this.writeConfirmationField(password);

    this.submitAttempted.set(true);
    if (!meetsPasswordRules(password, this.passwordRules)) {
      event.preventDefault();
      return;
    }

    this.submitting.set(true);
  }

  private readPasswordField(): string {
    return this.field('password-new')?.value ?? this.password();
  }

  private writeConfirmationField(password: string): void {
    const confirmation = this.field('password-confirm');
    if (confirmation !== null) confirmation.value = password;
  }

  private field(name: string): HTMLInputElement | null {
    return this.formElement().nativeElement.querySelector<HTMLInputElement>(
      `input[name="${name}"]`,
    );
  }
}

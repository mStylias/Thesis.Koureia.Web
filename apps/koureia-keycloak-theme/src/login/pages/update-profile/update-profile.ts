import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type FormState,
  UserProfileFormService,
} from '@keycloakify/angular/login/services/user-profile-form';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import { revealProfileErrors } from '../../components/user-profile-fields/reveal-profile-errors';
import { UserProfileFields } from '../../components/user-profile-fields/user-profile-fields';
import {
  isHiddenField,
  shouldShowGlobalMessage,
  shouldShowProfileErrors,
} from '../../components/user-profile-fields/user-profile-fields.logic';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

const EMPTY_FORM_STATE: FormState = {
  isFormSubmittable: false,
  formFieldStates: [],
};

/**
 * Where Keycloak sends a person whose stored profile no longer satisfies the realm.
 *
 * Two required actions render this page. `UPDATE_PROFILE` is set on the account deliberately.
 * `VERIFY_PROFILE` is set by Keycloak itself the moment a sign-in finds a profile that breaks the
 * current user profile configuration — so tightening a rule sends every account that already
 * violates it here, holding the sign-in until the profile is fixed.
 *
 * The form is the register form without the parts that only apply to a new account: no terms
 * checkbox, no reCAPTCHA, and no offer to sign in instead. Everything else, the error timing
 * included, is the register page's behaviour, because it renders the same user profile.
 */
@Component({
  selector: 'kc-update-profile-page',
  imports: [AuthFrame, Banner, Button, UserProfileFields],
  templateUrl: './update-profile.html',
  styleUrl: './update-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UserProfileFormService],
})
export class UpdateProfilePage {
  readonly displayMessage = false;

  private readonly userProfile = inject(UserProfileFormService);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('form');

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'login-update-profile.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  protected readonly formState = toSignal(this.userProfile.formState$, {
    initialValue: EMPTY_FORM_STATE,
  });
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);

  /*
   * A forced required action leaves the flag unset, and then there is nowhere to cancel to — the
   * sign-in cannot continue until the profile is fixed. Only the account console sets it.
   */
  protected readonly canCancel = this.kcContext.isAppInitiatedAction === true;

  protected readonly showErrors = computed(() =>
    shouldShowProfileErrors({
      submitAttempted: this.submitAttempted(),
      fields: this.formState().formFieldStates,
      hasOtherServerError: this.kcContext.message?.type === 'error',
    }),
  );
  protected readonly showGlobalMessage = computed(() => {
    const visible = this.formState()
      .formFieldStates.filter((field) => !isHiddenField(field.attribute))
      .map((field) => field.attribute.name);

    return shouldShowGlobalMessage(visible, this.kcContext.messagesPerField);
  });

  protected onSubmit(event: SubmitEvent): void {
    // Leaving, not saving. The button carries `formnovalidate` for the same reason.
    if ((event.submitter as HTMLButtonElement | null)?.name === 'cancel-aia') {
      this.submitting.set(true);
      return;
    }

    this.submitAttempted.set(true);

    if (!this.formState().isFormSubmittable) {
      event.preventDefault();
      revealProfileErrors({
        userProfile: this.userProfile,
        fields: this.formState().formFieldStates,
        form: this.formElement(),
        injector: this.injector,
      });
      return;
    }

    this.submitting.set(true);
  }
}

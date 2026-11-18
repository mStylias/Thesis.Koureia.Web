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
 * The profile check Keycloak runs before it creates or links an account from a provider.
 *
 * The fields arrive filled from the provider, not from any account here — Keycloak has not
 * matched one yet at this point in the flow. That is why `login-idp-link-confirm.ftl` does not
 * offer the button that returns to this page: on an address that already has an account, saving
 * this form replaces the stored name with the provider's.
 *
 * The page still exists because the realm's Review Profile execution shows it whenever the
 * provider leaves a required field empty, which no theme can prevent.
 */
@Component({
  selector: 'kc-idp-review-profile-page',
  imports: [AuthFrame, Banner, Button, UserProfileFields],
  templateUrl: './idp-review-profile.html',
  styleUrl: './idp-review-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UserProfileFormService],
})
export class IdpReviewProfilePage {
  readonly displayMessage = false;

  private readonly userProfile = inject(UserProfileFormService);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('form');

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'idp-review-user-profile.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  protected readonly formState = toSignal(this.userProfile.formState$, {
    initialValue: EMPTY_FORM_STATE,
  });
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);

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

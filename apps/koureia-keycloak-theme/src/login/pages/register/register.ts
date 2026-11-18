import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  type OnDestroy,
  type OnInit,
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
import { Checkbox } from '@ui/checkbox';
import { appBaseUrl, createTermsUrl } from '../../app-home';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import { revealProfileErrors } from '../../components/user-profile-fields/reveal-profile-errors';
import { UserProfileFields } from '../../components/user-profile-fields/user-profile-fields';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';
import {
  isHiddenField,
  shouldShowGlobalMessage,
  shouldShowProfileErrors,
} from '../../components/user-profile-fields/user-profile-fields.logic';
import { canSubmitRegistration } from './register.logic';

/** Not a profile field, so it is named here to be counted among the visible ones. */
const TERMS_FIELD = 'termsAccepted';

const EMPTY_FORM_STATE: FormState = {
  isFormSubmittable: false,
  formFieldStates: [],
};

type RecaptchaWindow = Window & {
  onSubmitRecaptcha?: () => void;
};

@Component({
  selector: 'kc-register-page',
  imports: [AuthFrame, Banner, Button, Checkbox, UserProfileFields],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UserProfileFormService],
})
export class RegisterPage implements OnInit, OnDestroy {
  readonly displayMessage = false;

  private readonly userProfile = inject(UserProfileFormService);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('form');
  private readonly termsCheckbox = viewChild.required<Checkbox>('termsCheckbox');

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'register.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  protected readonly formState = toSignal(this.userProfile.formState$, {
    initialValue: EMPTY_FORM_STATE,
  });
  protected readonly termsAccepted = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly showErrors = computed(() =>
    shouldShowProfileErrors({
      submitAttempted: this.submitAttempted(),
      fields: this.formState().formFieldStates,
      hasOtherServerError:
        this.kcContext.messagesPerField.existsError('termsAccepted') ||
        this.kcContext.message?.type === 'error',
    }),
  );
  protected readonly showGlobalMessage = computed(() => {
    const visible = this.formState()
      .formFieldStates.filter((field) => !isHiddenField(field.attribute))
      .map((field) => field.attribute.name);

    return shouldShowGlobalMessage([...visible, TERMS_FIELD], this.kcContext.messagesPerField);
  });
  protected readonly termsInvalid = computed(
    () =>
      this.showErrors() &&
      (!this.termsAccepted() || this.kcContext.messagesPerField.existsError('termsAccepted')),
  );
  protected readonly termsUrl = computed(() => {
    return createTermsUrl(
      appBaseUrl(this.kcContext.properties),
      this.i18n.currentLanguage.languageTag,
    );
  });

  ngOnInit(): void {
    (window as RecaptchaWindow).onSubmitRecaptcha = () => {
      this.formElement().nativeElement.requestSubmit();
    };
  }

  ngOnDestroy(): void {
    delete (window as RecaptchaWindow).onSubmitRecaptcha;
  }

  protected onSubmit(event: SubmitEvent): void {
    this.submitAttempted.set(true);

    const profileValid = this.formState().isFormSubmittable;
    const termsValid = this.termsAccepted();

    if (!profileValid) {
      event.preventDefault();
      revealProfileErrors({
        userProfile: this.userProfile,
        fields: this.formState().formFieldStates,
        form: this.formElement(),
        injector: this.injector,
      });
    }

    if (!termsValid) {
      event.preventDefault();
      this.termsCheckbox().focus();
    }

    if (canSubmitRegistration(profileValid, termsValid)) {
      this.submitting.set(true);
    }
  }
}

import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideKeyRound } from '@lucide/angular';
import {
  profilePatch,
  UserProfileApi,
  userProfileFormValue,
  type UserProfileFormValue,
} from '@api/users';
import { passwordActionHref, readPasswordActionStatus, SessionStore } from '@auth/data-access';
import { injectFormErrors } from '@synax/forms';
import { Button, ButtonIcon } from '@ui/button';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { PhoneInput, validatePhone } from '@ui/phone-input';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';
import { firstValueFrom } from 'rxjs';

import { PROFILE_FIELDS } from './profile.form';

/**
 * The customer's name and phone, their email as it stands, and the way to their password.
 *
 * The password is changed on the sign-in provider's own page. The BFF sends the customer there
 * and back, and says how it went in a query parameter.
 */
@Component({
  selector: 'lib-account-profile',
  imports: [
    Button,
    ButtonIcon,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    LucideKeyRound,
    PhoneInput,
    TranslocoPipe,
  ],
  templateUrl: './account-profile.html',
  styleUrl: './account-profile.scss',
})
export class AccountProfile {
  private readonly api = inject(UserProfileApi);
  private readonly session = inject(SessionStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(ActiveLanguage);
  private readonly formErrors = injectFormErrors();

  private readonly profile = rxResource({ stream: () => this.api.current() });

  private readonly model = signal<UserProfileFormValue>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });
  private readonly saved = signal<UserProfileFormValue | null>(null);

  protected readonly editor = formEditor({
    model: this.model,
    fields: PROFILE_FIELDS,
    rules: (path) => {
      validatePhone(path.phoneNumber);
    },
    action: () => this.write(),
  });

  protected readonly loading = computed(() => this.profile.isLoading() && this.saved() === null);
  protected readonly failed = computed(() => this.profile.status() === 'error');
  protected readonly email = computed(
    () =>
      (this.profile.hasValue() ? this.profile.value().email : this.session.claims()?.email) ?? '',
  );

  /** A document load through the BFF, which brings the customer back to this page. */
  protected readonly passwordHref = computed(() => {
    return passwordActionHref(withLanguagePrefix('/account/profile', this.language.value()));
  });

  constructor() {
    effect(() => {
      if (!this.profile.hasValue()) return;
      const user = this.profile.value();
      untracked(() => {
        this.load(userProfileFormValue(user));
      });
    });

    afterNextRender(() => {
      this.announcePasswordChange();
    });
  }

  protected retry(): void {
    this.profile.reload();
  }

  protected save(): void {
    void this.editor.commit();
  }

  private load(value: UserProfileFormValue): void {
    this.editor.reset(value);
    this.saved.set(value);
  }

  private async write(): Promise<FormFailure | undefined> {
    const saved = this.saved();
    if (saved === null) return undefined;

    const patch = profilePatch(this.model(), saved);
    if (Object.keys(patch).length === 0) {
      this.toaster.success(this.transloco.translate('account.profile.saved'));
      return undefined;
    }

    const result = await firstValueFrom(this.api.update(patch));
    if (!result.isSuccess) return this.formErrors(result.error);

    this.toaster.success(this.transloco.translate('account.profile.saved'));
    if (result.data !== null) this.load(userProfileFormValue(result.data));
    // The account menu reads the name from the session, which the sign-in provider updates
    // a moment after the API does. One refresh picks it up in the common case.
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      void this.session.refresh();
    }
    return undefined;
  }

  /** Says how the password page went. */
  private announcePasswordChange(): void {
    const status = readPasswordActionStatus(this.route, this.router);
    if (status === 'success') {
      this.toaster.success(this.transloco.translate('account.profile.password.updated'));
    } else if (status === 'error') {
      this.toaster.error(this.transloco.translate('account.profile.password.failed'));
    }
  }
}

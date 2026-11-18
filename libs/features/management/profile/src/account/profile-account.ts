import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideKeyRound, LucidePencil } from '@lucide/angular';
import {
  profilePatch,
  UserProfileApi,
  UserProfileErrorCodes,
  userProfileFormValue,
  type UserProfileFormValue,
  type UserResponse,
} from '@api/users';
import { passwordActionHref, readPasswordActionStatus, SessionStore } from '@auth/data-access';
import { flattenValidationErrors, type HttpError } from '@synax/client/core';
import { injectFormErrors } from '@synax/forms';
import { Button, ButtonIcon } from '@ui/button';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { PhoneInput, validatePhone } from '@ui/phone-input';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';
import { firstValueFrom } from 'rxjs';
import { PageSection, registerPageEditor } from '@features/management-shared-page-sections';
import type {
  PageSectionEditor,
  PageSectionState,
} from '@features/management-shared-page-sections';

import { PROFILE_ACCOUNT_FIELDS } from './profile-account.form';

const K = 'managementProfile.profile';

/** The BFF brings the person back to this page after the password page. */
const PASSWORD_HREF = passwordActionHref('/management/profile');

/** The refusals that belong to a field. Any other failure is a toast. */
const FIELD_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(UserProfileErrorCodes));

const EMPTY: UserProfileFormValue = { firstName: '', lastName: '', phoneNumber: '' };

/** The waits between session refreshes until the sign-in provider has the new name. */
const NAME_REFRESH_DELAYS_MS = [1000, 2000, 4000];

/**
 * The Profile card: the person's name and phone, their email as it stands, and the way to their
 * password. View first, then Edit turns the values into fields.
 */
@Component({
  selector: 'lib-profile-account',
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
    LucidePencil,
    PhoneInput,
    PageSection,
    TranslocoPipe,
  ],
  templateUrl: './profile-account.html',
  styleUrl: './profile-account.scss',
})
export class ProfileAccount implements PageSectionEditor {
  private readonly api = inject(UserProfileApi);
  private readonly session = inject(SessionStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formErrors = injectFormErrors();
  private readonly injector = inject(Injector);

  /** Read as an element: the ref alone gives the `libButton` component. */
  private readonly editButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('editButton', {
    read: ElementRef,
  });

  private readonly profile = rxResource({ stream: () => this.api.current() });

  private readonly model = signal<UserProfileFormValue>(EMPTY);
  private readonly user = signal<UserResponse | null>(null);
  private readonly saved = computed(() => {
    const user = this.user();
    return user === null ? null : userProfileFormValue(user);
  });

  protected readonly editor = formEditor({
    model: this.model,
    fields: PROFILE_ACCOUNT_FIELDS,
    mode: () => 'view',
    rules: (path) => {
      validatePhone(path.phoneNumber);
    },
    action: () => this.write(),
  });

  protected readonly passwordHref = PASSWORD_HREF;

  protected readonly state = computed<PageSectionState>(() => {
    if (this.user() !== null) return 'ready';
    return this.profile.status() === 'error' ? 'error' : 'loading';
  });

  protected readonly email = computed(() => this.user()?.email ?? '');

  /** View mode omits an empty phone. */
  protected readonly hasPhone = computed(() => (this.saved()?.phoneNumber ?? '') !== '');

  constructor() {
    registerPageEditor(this);

    effect(() => {
      if (!this.profile.hasValue()) return;
      const user = this.profile.value();
      untracked(() => {
        if (!this.editor.editing()) this.load(user);
      });
    });

    afterNextRender(() => {
      this.announcePasswordChange();
    });
  }

  hasChanges(): boolean {
    const saved = this.saved();
    return (
      this.editor.editing() &&
      saved !== null &&
      Object.keys(profilePatch(this.model(), saved)).length > 0
    );
  }

  discard(): void {
    const user = this.user();
    if (user !== null) this.load(user);
    this.editor.mode.set('view');
  }

  protected retry(): void {
    this.profile.reload();
  }

  protected edit(): void {
    const user = this.user();
    if (user === null) return;
    this.load(user);
    this.editor.mode.set('edit');
  }

  protected cancel(): void {
    this.discard();
    this.focusEdit();
  }

  protected save(): void {
    void this.editor.commit();
  }

  private load(user: UserResponse): void {
    this.user.set(user);
    this.editor.reset(userProfileFormValue(user));
  }

  private async write(): Promise<FormFailure | undefined> {
    const saved = this.saved();
    if (saved === null) return undefined;

    const patch = profilePatch(this.model(), saved);
    if (Object.keys(patch).length === 0) {
      this.editor.mode.set('view');
      this.focusEdit();
      return undefined;
    }

    const result = await firstValueFrom(this.api.update(patch));
    if (!result.isSuccess) {
      if (blamesField(result.error)) return this.formErrors(result.error);
      // The form stays open with the person's values.
      this.toaster.error(this.transloco.translate(`${K}.saveFailed`));
      return undefined;
    }

    if (result.data !== null) this.load(result.data);
    this.editor.mode.set('view');
    this.focusEdit();
    this.toaster.success(this.transloco.translate(`${K}.saved`));
    if (result.data !== null && (patch.firstName !== undefined || patch.lastName !== undefined)) {
      void this.followNameInSession(result.data.firstName, result.data.lastName);
    }
    return undefined;
  }

  /**
   * Refreshes the session until its claims carry the saved name, so the account menu shows it.
   * The API sends the name to the sign-in provider through an outbox, a few seconds after the
   * save. It goes on after the person leaves the page, because the menu stays.
   */
  private async followNameInSession(firstName: string, lastName: string): Promise<void> {
    const caughtUp = (): boolean => {
      const claims = this.session.claims();
      return claims?.givenName === firstName && claims.familyName === lastName;
    };
    for (const delay of [0, ...NAME_REFRESH_DELAYS_MS]) {
      if (delay > 0) await wait(delay);
      if (!(await this.session.refresh())) return;
      if (caughtUp()) return;
    }
  }

  /** The buttons that had focus go away with edit mode, so focus goes back to Edit. */
  private focusEdit(): void {
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }

  private announcePasswordChange(): void {
    const status = readPasswordActionStatus(this.route, this.router);
    if (status === 'success') {
      this.toaster.success(this.transloco.translate(`${K}.password.updated`));
    } else if (status === 'error') {
      this.toaster.error(this.transloco.translate(`${K}.password.failed`));
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blamesField(error: HttpError): boolean {
  return (
    FIELD_ERROR_CODES.has(error.errorCode) ||
    flattenValidationErrors(error).some((entry) => FIELD_ERROR_CODES.has(entry.code))
  );
}

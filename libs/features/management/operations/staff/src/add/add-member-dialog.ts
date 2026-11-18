import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { alreadyMemberOf, StaffApi, type StaffAlreadyMemberExtensions } from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import { injectErrorMessageResolver } from '@synax/client';
import type { HttpError } from '@synax/client/core';
import { injectFormErrors } from '@synax/forms';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { Select, type SelectOption } from '@ui/select';
import { Switch } from '@ui/switch';
import { ToasterService } from '@ui/toaster';
import { field, fields, formEditor, type FormFailure } from '@util/forms';

import { StaffAvatar } from '../avatar/staff-avatar';
import { jobTitleLabel, roleLabel } from '../staff.format';
import { StaffStore } from '../staff.store';
import { createRequest, defaultsFor } from './add-member-draft';
import type {
  AddDefaultsFormValue,
  AddEmailFormValue,
  AddMemberStep,
} from './add-member-dialog.types';

const K = 'managementStaff.addMember';

const EMAIL_FIELDS = fields<AddEmailFormValue>({
  lookup: field({
    label: `${K}.email`,
    hint: `${K}.emailHint`,
    required: `${K}.errors.emailRequired`,
  }),
});

/** Refusals about the person rather than the settings: the address step owns them. */
const PERSON_CODES: ReadonlySet<string> = new Set([
  'STAFF_INVALID_EMAIL',
  'STAFF_CANDIDATE_NOT_FOUND',
  'STAFF_ALREADY_MEMBER',
  'STAFF_EMPLOYED_ELSEWHERE',
]);

const DEFAULTS_FIELDS = fields<AddDefaultsFormValue>({
  roleId: field({ label: `${K}.role` }),
  jobTitleCode: field({ label: `${K}.jobTitle` }),
});

/**
 * Adds a person who already has an account. The owner types the whole address, and nothing is
 * ever suggested: the page must not reveal other people's addresses. The lookup shows the name,
 * the confirm step sets the role and the defaults, and the add opens the new member.
 *
 * ```html
 * <lib-add-member-dialog [(visible)]="open" />
 * ```
 */
@Component({
  selector: 'lib-add-member-dialog',
  imports: [
    Button,
    Checkbox,
    Dialog,
    DialogFooter,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    Select,
    StaffAvatar,
    Switch,
    TranslocoPipe,
  ],
  templateUrl: './add-member-dialog.html',
  styleUrl: './add-member-dialog.scss',
})
export class AddMemberDialog {
  private readonly api = inject(StaffApi);
  private readonly store = inject(StaffStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);

  protected readonly step = signal<AddMemberStep>({ kind: 'email' });

  /** The person is on this team already. The dialog offers to open them, or to bring them back. */
  protected readonly existing = signal<StaffAlreadyMemberExtensions | null>(null);

  protected readonly activating = signal(false);

  /** `ΜΚ`, for the found person's avatar. */
  protected readonly candidateInitials = computed(() => {
    const step = this.step();
    if (step.kind !== 'confirm') return '';
    const first = (name: string): string => name.trim().charAt(0).toLocaleUpperCase();
    return first(step.candidate.firstName) + first(step.candidate.lastName);
  });

  protected readonly canAssignRoles = computed(() => this.access.has('roles:assign'));
  protected readonly options = this.store.options;
  protected readonly optionsFailed = this.store.optionsFailed;

  private readonly emailModel = signal<AddEmailFormValue>({ lookup: '' });

  protected readonly emailEditor = formEditor({
    model: this.emailModel,
    fields: EMAIL_FIELDS,
    action: () => this.lookUp(),
  });

  private readonly defaultsModel = signal<AddDefaultsFormValue>(defaultsFor(null, false));

  protected readonly defaultsEditor = formEditor({
    model: this.defaultsModel,
    fields: DEFAULTS_FIELDS,
    action: () => this.add(),
  });

  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() => {
    this.transloco.getActiveLang();
    const translate = this.translate;
    return [
      { value: '', label: translate(`${K}.noRole`) },
      ...(this.options()?.roles ?? []).map((role) => ({
        value: role.id,
        label: roleLabel(role.name, role.isSystem, translate),
      })),
    ];
  });

  protected readonly jobTitleOptions = computed<readonly SelectOption<string>[]>(() => {
    this.transloco.getActiveLang();
    return [
      { value: '', label: jobTitleLabel(null, this.translate) },
      ...(this.options()?.jobTitles ?? []).map((code) => ({
        value: code,
        label: jobTitleLabel(code, this.translate),
      })),
    ];
  });

  private readonly translate = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(key, params);

  constructor() {
    // Every opening starts from an empty address. Nothing typed survives a close.
    effect(() => {
      if (this.visible()) return;
      untracked(() => {
        this.step.set({ kind: 'email' });
        this.existing.set(null);
        this.emailEditor.reset({ lookup: '' });
      });
    });
  }

  protected search(): void {
    void this.emailEditor.commit();
  }

  protected confirm(): void {
    void this.defaultsEditor.commit();
  }

  protected back(): void {
    this.step.set({ kind: 'email' });
  }

  protected close(): void {
    this.visible.set(false);
  }

  protected reloadOptions(): void {
    void this.store.loadOptions();
  }

  /** The person on this team already: their drawer. */
  protected openExisting(): void {
    const existing = this.existing();
    if (existing !== null) this.openMember(existing.staffMemberId);
  }

  /** Brings an inactive member back, then opens them. */
  protected async reactivate(): Promise<void> {
    const existing = this.existing();
    if (existing === null || this.activating()) return;
    this.activating.set(true);
    const result = await firstValueFrom(this.api.setActive(existing.staffMemberId, true));
    this.activating.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.translate('managementStaff.toast.activated'));
    void this.store.reload();
    this.openMember(existing.staffMemberId);
  }

  private async lookUp(): Promise<FormFailure | undefined> {
    this.existing.set(null);
    const email = this.emailModel().lookup.trim();
    const result = await firstValueFrom(this.api.findCandidate({ email }));
    if (!result.isSuccess) return this.refused(result.error);
    if (result.data === null) return undefined;

    this.defaultsEditor.reset(defaultsFor(this.options(), this.canAssignRoles()));
    this.step.set({ kind: 'confirm', candidate: result.data });
    return undefined;
  }

  private async add(): Promise<FormFailure | undefined> {
    const step = this.step();
    if (step.kind !== 'confirm') return undefined;

    const request = createRequest(
      step.candidate.email,
      this.defaultsModel(),
      this.options(),
      this.canAssignRoles(),
    );
    const result = await firstValueFrom(this.api.createMember(request));
    if (!result.isSuccess) {
      // The person changed between the two steps: back to the address, with what happened.
      if (PERSON_CODES.has(result.error.errorCode)) {
        this.existing.set(alreadyMemberOf(result.error));
        this.step.set({ kind: 'email' });
        this.toaster.error(this.errorMessage(result.error));
        return undefined;
      }
      return this.formErrors(result.error);
    }

    this.toaster.success(this.translate('managementStaff.toast.added'));
    void this.store.reload();
    if (result.data !== null) this.openMember(result.data.id);
    else this.close();
    return undefined;
  }

  /** A refused lookup. Too many lookups is a toast: the address itself is not at fault. */
  private refused(error: HttpError): FormFailure {
    if (error.errorCode === 'STAFF_CANDIDATE_RATE_LIMITED') {
      this.toaster.error(this.errorMessage(error));
      return { errors: [] };
    }
    this.existing.set(alreadyMemberOf(error));
    // The API names the address `email`. The form holds it as `lookup`.
    const failure = this.formErrors(error);
    return {
      errors: failure.errors.map((item) =>
        item.path?.[0] === 'email' ? { ...item, path: ['lookup', ...item.path.slice(1)] } : item,
      ),
    };
  }

  private openMember(staffMemberId: string): void {
    this.close();
    void this.router.navigate([staffMemberId], { relativeTo: this.route });
  }
}

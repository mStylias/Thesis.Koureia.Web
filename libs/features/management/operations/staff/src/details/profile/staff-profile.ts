import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField, disabled } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideLock, LucidePhone, LucideStar } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { StaffApi, type StaffMemberResponse } from '@api/staff';
import { StaffAccessStore } from '@auth/data-access';
import { injectFormErrors } from '@synax/forms';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { CopyButton } from '@ui/copy-button';
import { DatePicker } from '@ui/date-picker';
import { Field, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { MultiSelect } from '@ui/multi-select';
import { formatPhone } from '@ui/phone-input';
import { Select, type SelectOption } from '@ui/select';
import { Stat, StatGroup } from '@ui/stat';
import { Switch } from '@ui/switch';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { sameValue } from '../../form/form-values';
import { PROFILE_FIELDS, profileForm, profileRequest } from '../../form/profile.form';
import type { ProfileFormValue } from '../../form/profile.form.types';
import { formatDay, jobTitleLabel, roleLabel } from '../../staff.format';
import { StaffStore } from '../../staff.store';
import type { StaffTabEditor } from '../staff-member-details.types';

/**
 * The member's employment at the shop: job title, whether they take appointments, since when,
 * and their roles. Then their account, read-only, and their figures. The photo is the header's.
 */
@Component({
  selector: 'lib-staff-profile',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    CopyButton,
    DatePicker,
    Field,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    LucideLock,
    LucidePhone,
    LucideStar,
    MultiSelect,
    Select,
    Stat,
    StatGroup,
    Switch,
    TranslocoPipe,
  ],
  templateUrl: './staff-profile.html',
  styleUrl: './staff-profile.scss',
})
export class StaffProfile implements StaffTabEditor {
  private readonly api = inject(StaffApi);
  private readonly store = inject(StaffStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly formErrors = injectFormErrors();

  readonly member = input.required<StaffMemberResponse>();
  readonly language = input.required<string>();

  /** The saved member, after a profile write. */
  readonly changed = output<StaffMemberResponse>();

  private readonly model = signal<ProfileFormValue>({
    jobTitleCode: '',
    isBookable: true,
    joinedAt: '',
    roleIds: [],
  });
  private readonly loaded = signal<ProfileFormValue | null>(null);

  protected readonly editor = formEditor({
    model: this.model,
    fields: PROFILE_FIELDS,
    resetOn: () => this.member().id,
    mode: () => 'view',
    // The roles show, read-only, to a caller who may not change them. The request then sends
    // them unchanged.
    liveRules: (path) => {
      disabled(path.roleIds, { when: () => !this.canEditRoles() });
    },
    action: () => this.write(),
  });

  readonly editing = this.editor.editing;
  readonly submitting = this.editor.submitting;

  /** `members:update`, on a member who holds nothing the caller lacks. */
  readonly canEdit = computed(() => this.access.has('members:update') && this.member().canManage);

  /** Roles change with `roles:assign`, never on the caller's own membership. */
  protected readonly canEditRoles = computed(
    () => this.access.has('roles:assign') && !this.member().isSelf,
  );

  protected readonly jobTitle = computed(() => {
    this.language();
    return jobTitleLabel(this.member().jobTitleCode, this.translate);
  });

  protected readonly roleNames = computed(() => {
    this.language();
    const system = new Map(
      (this.store.options()?.roles ?? []).map((role) => [role.id, role.isSystem]),
    );
    return this.member().roles.map((role) =>
      roleLabel(role.name, system.get(role.id) ?? true, this.translate),
    );
  });

  protected readonly joinedAt = computed(() => formatDay(this.member().joinedAt, this.language()));

  protected readonly phone = computed(() => {
    const phone = this.member().phoneNumber;
    if (phone === null) return null;
    return { stored: phone, shown: formatPhone(phone), href: `tel:${phone.replace(/\s+/g, '')}` };
  });

  protected readonly rating = computed(() => {
    const rating = this.member().stats.rating;
    return rating === null
      ? null
      : new Intl.NumberFormat(this.language(), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(rating);
  });

  protected readonly jobTitleOptions = computed<readonly SelectOption<string>[]>(() => {
    this.language();
    const codes = this.store.options()?.jobTitles ?? [];
    const current = this.member().jobTitleCode;
    // A code the shop no longer offers stays selectable, so a save does not clear it unasked.
    const all = current !== null && !codes.includes(current) ? [...codes, current] : codes;
    return [
      { value: '', label: jobTitleLabel(null, this.translate) },
      ...all.map((code) => ({ value: code, label: jobTitleLabel(code, this.translate) })),
    ];
  });

  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() => {
    this.language();
    const listed = this.store.options()?.roles ?? [];
    const held = this.member().roles.filter((role) => !listed.some((item) => item.id === role.id));
    return [
      ...listed.map((role) => ({
        value: role.id,
        label: roleLabel(role.name, role.isSystem, this.translate),
      })),
      ...held.map((role) => ({ value: role.id, label: role.name })),
    ];
  });

  /** Turning bookings off keeps the appointments already booked. The form says how many. */
  protected readonly upcomingStay = computed(
    () =>
      this.member().isBookable &&
      !this.editor.form.isBookable().value() &&
      this.member().stats.upcomingCount > 0,
  );

  private readonly translate = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(key, params);

  constructor() {
    effect(() => {
      const member = this.member();
      untracked(() => {
        if (!this.editor.editing()) this.load(profileForm(member));
      });
    });
  }

  hasChanges(): boolean {
    const loaded = this.loaded();
    return this.editor.editing() && loaded !== null && !sameValue(this.model(), loaded);
  }

  edit(): void {
    if (!this.canEdit()) return;
    this.load(profileForm(this.member()));
    this.editor.mode.set('edit');
  }

  save(): void {
    void this.editor.commit();
  }

  discard(): void {
    this.load(profileForm(this.member()));
    this.editor.mode.set('view');
  }

  private load(value: ProfileFormValue): void {
    this.editor.reset(value);
    this.loaded.set(value);
  }

  private async write(): Promise<FormFailure | undefined> {
    const result = await firstValueFrom(
      this.api.updateMember(this.member().id, profileRequest(this.model())),
    );
    if (!result.isSuccess) return this.formErrors(result.error);

    this.toaster.success(this.translate('managementStaff.toast.updated'));
    const saved = result.data;
    if (saved !== null) {
      this.load(profileForm(saved));
      this.changed.emit(saved);
    }
    this.editor.mode.set('view');
    return undefined;
  }
}

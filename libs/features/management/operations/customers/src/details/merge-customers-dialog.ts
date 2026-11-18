import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  CustomersApi,
  type CustomerMergeSource,
  type CustomerODataResponse,
  type CustomerResponse,
} from '@api/customers';
import { odataSource } from '@data/odata-source';
import { customerSearchTerm } from '@features/management-shared-appointments';
import { injectErrorMessageResolver } from '@synax/client';
import { guid } from '@synax/client/core';
import {
  Autocomplete,
  AutocompleteOptionTemplate,
  type AutocompleteSelection,
} from '@ui/autocomplete';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import type { DataKey, DataSource } from '@ui/data-source';
import { Dialog, DialogFooter } from '@ui/dialog';
import { RadioGroup, type RadioOption } from '@ui/radio-group';
import { ToasterService } from '@ui/toaster';

import type { MergeChoices, MergeField, MergeRow } from './merge-customers-dialog.types';

const K = 'managementCustomers.merge';

/** The rows of the second step, in order. */
export const MERGE_FIELDS: readonly MergeField[] = ['name', 'phone', 'email', 'preferredStaff'];

/** The line between the two notes of a merged record. */
export const NOTE_SEPARATOR = '———';

/** The value a side holds for one row, as the dialog shows it. `''` when it holds none. */
export function mergeValue(customer: CustomerResponse, field: MergeField): string {
  switch (field) {
    case 'name':
      return `${customer.firstName} ${customer.lastName}`.trim();
    case 'phone':
      return customer.phoneNumber ?? '';
    case 'email':
      return customer.email ?? '';
    case 'preferredStaff':
      return customer.preferredStaffDisplayName ?? '';
  }
}

/**
 * The side each value starts on: the one with the latest visit, unless its value is empty and
 * the other's is not. A side with no visit is older than one with a visit.
 */
export function defaultChoices(kept: CustomerResponse, removed: CustomerResponse): MergeChoices {
  const newer: CustomerMergeSource =
    (removed.lastVisitDate ?? '') > (kept.lastVisitDate ?? '') ? 'Removed' : 'Kept';
  const pick = (field: MergeField): CustomerMergeSource => {
    const keptValue = mergeValue(kept, field);
    const removedValue = mergeValue(removed, field);
    if (newer === 'Kept') return keptValue === '' && removedValue !== '' ? 'Removed' : 'Kept';
    return removedValue === '' && keptValue !== '' ? 'Kept' : 'Removed';
  };
  return {
    name: pick('name'),
    phone: pick('phone'),
    email: pick('email'),
    preferredStaff: pick('preferredStaff'),
  };
}

/** Both notes, the kept record's first. A side with no note adds nothing. */
export function joinedNote(kept: CustomerResponse, removed: CustomerResponse): string {
  return [kept.note?.text, removed.note?.text]
    .filter((text): text is string => text !== undefined && text.trim() !== '')
    .join(`\n${NOTE_SEPARATOR}\n`);
}

/**
 * Merges another walk-in of the shop into the open one, which keeps its id. The owner picks the
 * name, phone, email and preferred barber side by side. Both notes are kept, and a block on
 * either side stays. It cannot be undone.
 *
 * `otherId` skips the first step: the edit form's email clash names the other walk-in.
 *
 * ```html
 * <lib-merge-customers-dialog [(visible)]="open" [customer]="customer" (merged)="show($event)" />
 * ```
 */
@Component({
  selector: 'lib-merge-customers-dialog',
  imports: [
    Autocomplete,
    AutocompleteOptionTemplate,
    Banner,
    Button,
    Dialog,
    DialogFooter,
    RadioGroup,
    TranslocoPipe,
  ],
  templateUrl: './merge-customers-dialog.html',
  styleUrl: './merge-customers-dialog.scss',
})
export class MergeCustomersDialog {
  private readonly api = inject(CustomersApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly errorMessage = injectErrorMessageResolver();

  readonly visible = model(false);
  /** The open customer, which is kept. */
  readonly customer = input.required<CustomerResponse>();
  /** The other walk-in, when the caller already knows it. */
  readonly otherId = input<string | null>(null);

  /** The kept customer as the merge saved them. */
  readonly merged = output<CustomerResponse>();

  protected readonly fields = MERGE_FIELDS;

  /** The other walk-in the first step picked. */
  protected readonly pickedId = signal<string | null>(null);

  /** The search's own value, which the first step does not keep. */
  protected readonly search = signal<DataKey>('');

  protected readonly submitting = signal(false);

  /** The refusal the second step shows: a joined note over the limit. */
  protected readonly noteTooLong = signal(false);

  protected readonly choices = signal<MergeChoices>({
    name: 'Kept',
    phone: 'Kept',
    email: 'Kept',
    preferredStaff: 'Kept',
  });

  /** This shop's other walk-ins. An account holder and the open record are never offered. */
  protected readonly candidates: DataSource<CustomerODataResponse> =
    odataSource<CustomerODataResponse>({
      fetch: (query) => {
        const search = query.search === undefined ? '' : customerSearchTerm(query.search);
        const scope = { isWalkIn: true, id: { ne: guid(this.customer().id) } };
        return this.api.list({
          ...query,
          filter: query.filter === undefined ? scope : { and: [query.filter, scope] },
          search: search === '' ? undefined : search,
          orderBy: query.orderBy ?? 'displayName',
        });
      },
      key: { selector: 'id', type: 'uuid' },
      capabilities: { search: true },
    });

  private readonly otherResource = rxResource({
    params: () => this.pickedId() ?? undefined,
    stream: ({ params }) => this.api.customer(params),
  });

  /** The other record, read whole: its note, its block and its counts. */
  protected readonly other = computed<CustomerResponse | null>(() => {
    const result = this.otherResource.hasValue() ? this.otherResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  protected readonly otherFailed = computed(() => {
    if (this.otherResource.isLoading()) return '';
    const result = this.otherResource.hasValue() ? this.otherResource.value() : null;
    return result?.isFailure === true ? this.errorMessage(result.error) : '';
  });

  protected readonly step = computed(() => (this.other() === null ? 1 : 2));

  protected readonly rows = computed<readonly MergeRow[]>(() => {
    const other = this.other();
    if (other === null) return [];
    const kept = this.customer();
    return MERGE_FIELDS.map((field) => ({
      field,
      kept: mergeValue(kept, field),
      removed: mergeValue(other, field),
    }));
  });

  protected readonly note = computed(() => {
    const other = this.other();
    return other === null ? '' : joinedNote(this.customer(), other);
  });

  protected readonly staysBlocked = computed(
    () => this.customer().block !== null || this.other()?.block != null,
  );

  protected readonly displayName = (candidate: CustomerODataResponse): string =>
    candidate.displayName;

  constructor() {
    // Each opening starts over, on the record the caller named when there is one.
    effect(() => {
      if (!this.visible()) return;
      const otherId = this.otherId();
      untracked(() => {
        this.noteTooLong.set(false);
        this.pickedId.set(otherId);
      });
    });

    // The defaults follow the record the first step picked.
    effect(() => {
      const other = this.other();
      if (other === null) return;
      const kept = this.customer();
      untracked(() => {
        this.choices.set(defaultChoices(kept, other));
      });
    });
  }

  protected options(row: MergeRow): readonly RadioOption<CustomerMergeSource>[] {
    const empty = this.transloco.translate(`${K}.empty`);
    // Named by role, not by name: two walk-ins to merge often share one.
    return [
      {
        value: 'Kept',
        label: row.kept || empty,
        description: this.transloco.translate(`${K}.thisCustomer`),
      },
      {
        value: 'Removed',
        label: row.removed || empty,
        description: this.transloco.translate(`${K}.otherCustomer`),
      },
    ];
  }

  protected choose(field: MergeField, source: CustomerMergeSource | null): void {
    if (source === null) return;
    this.choices.update((choices) => ({ ...choices, [field]: source }));
  }

  protected onPick(selection: AutocompleteSelection<CustomerODataResponse> | undefined): void {
    this.pickedId.set(selection?.item.id ?? null);
  }

  /** Back to the first step, for another record. */
  protected back(): void {
    this.noteTooLong.set(false);
    this.pickedId.set(null);
  }

  protected close(): void {
    this.visible.set(false);
  }

  protected async merge(): Promise<void> {
    const other = this.other();
    if (other === null || this.submitting()) return;
    const choices = this.choices();
    this.submitting.set(true);
    this.noteTooLong.set(false);
    const result = await firstValueFrom(
      this.api.merge({
        keptCustomerId: this.customer().id,
        removedCustomerId: other.id,
        nameFrom: choices.name,
        phoneFrom: choices.phone,
        emailFrom: choices.email,
        preferredStaffFrom: choices.preferredStaff,
      }),
    );
    this.submitting.set(false);

    if (!result.isSuccess) {
      if (result.error.errorCode === 'CUSTOMER_MERGE_NOTE_TOO_LONG') {
        this.noteTooLong.set(true);
      } else {
        this.toaster.error(this.errorMessage(result.error));
      }
      return;
    }

    this.toaster.success(this.transloco.translate(`${K}.toast`));
    this.merged.emit(result.data ?? this.customer());
    this.visible.set(false);
  }
}

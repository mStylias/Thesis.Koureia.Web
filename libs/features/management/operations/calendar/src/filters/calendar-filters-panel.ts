import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  LucideBriefcaseBusiness,
  LucideCircleDot,
  LucideScissors,
  LucideUsers,
} from '@lucide/angular';
import type { CustomerOptionODataResponse } from '@api/appointments';
import { Field, FieldEditor } from '@ui/form-field';
import { MultiSelect } from '@ui/multi-select';
import { SelectOptionTemplate, type SelectOption } from '@ui/select';
import { formEditor } from '@util/forms';

import { APPOINTMENT_STATUSES, statusLabelKey } from '@features/management-shared-appointments';
import { CalendarStore } from '../calendar.store';
import { FILTER_FIELDS } from './calendar-filters.form';

/**
 * The body of the calendar's filters panel. It edits the store's filters in place, so every
 * change is a new query at once. There is no apply button.
 *
 * The barber options are also the legend: each carries its swatch.
 */
@Component({
  selector: 'lib-calendar-filters',
  imports: [Field, FieldEditor, FormField, MultiSelect, SelectOptionTemplate, TranslocoPipe],
  templateUrl: './calendar-filters-panel.html',
  styleUrl: './calendar-filters-panel.scss',
})
export class CalendarFiltersPanel {
  protected readonly store = inject(CalendarStore);
  private readonly transloco = inject(TranslocoService);

  // The barber, customer and category icons are the sidebar's for the staff, customers and
  // services pages.
  protected readonly barbersIcon = LucideBriefcaseBusiness;
  protected readonly customersIcon = LucideUsers;
  protected readonly statusesIcon = LucideCircleDot;
  protected readonly categoriesIcon = LucideScissors;

  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** No commit: the form exists for its field tree, which binds the controls to the store. */
  protected readonly editor = formEditor({
    model: this.store.filters,
    fields: FILTER_FIELDS,
    action: () => Promise.resolve(undefined),
  });

  protected readonly barberOptions = computed<readonly SelectOption<string>[]>(() =>
    this.store.allResources().map((resource) => ({ value: resource.id, label: resource.label })),
  );

  private readonly swatches = computed(
    () =>
      new Map(
        this.store
          .allResources()
          .map((resource) => [resource.id, `var(--swatch-${resource.swatch.toString()})`]),
      ),
  );

  /** The colour of a barber's tiles, for the option's dot. */
  protected swatchOf(barberId: unknown): string | null {
    return typeof barberId === 'string' ? (this.swatches().get(barberId) ?? null) : null;
  }

  protected readonly statusOptions = computed<readonly SelectOption<string>[]>(() => {
    this.language();
    return APPOINTMENT_STATUSES.map((status) => ({
      value: status,
      label: this.transloco.translate(statusLabelKey(status)),
    }));
  });

  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() =>
    this.store.categories().map((category) => ({ value: category.id, label: category.name })),
  );

  private readonly dateFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.language(), { day: 'numeric', month: 'short', year: 'numeric' }),
  );

  protected readonly customerName = (customer: CustomerOptionODataResponse): string =>
    customer.displayName;

  /** The last visit tells apart two customers with the same name. */
  protected lastVisit(item: unknown): string {
    if (!isCustomer(item)) return '';
    // Local midnight: a bare `YYYY-MM-DD` parses as UTC and can print the day before.
    const date = new Date(`${item.lastAppointmentDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? '' : this.dateFormat().format(date);
  }
}

function isCustomer(item: unknown): item is CustomerOptionODataResponse {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Partial<CustomerOptionODataResponse>).lastAppointmentDate === 'string'
  );
}

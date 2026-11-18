import { Service, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  AppointmentsApi,
  type AppointmentODataResponse,
  type CalendarOptionsResponse,
  type CalendarStaffMemberViewDto,
  type CustomerOptionODataResponse,
  type ServiceOptionODataResponse,
} from '@api/appointments';
import { odataSource } from '@data/odata-source';
import { customersSource } from '@features/management-shared-appointments';
import { createArraySource, foldText, type DataSource } from '@ui/data-source';

/** The endpoint's own cap on `$top`. Every page size the grid offers fits under it. */
const APPOINTMENTS_MAX_TOP = 100;

/**
 * What the grid, its header filters and the drawer over it share.
 *
 * `autoProvided: false` and provided by `AppointmentsList`, so each visit starts a new store. The
 * drawer, a child route in the page's outlet, reads the same one.
 */
@Service({ autoProvided: false })
export class AppointmentsStore {
  private readonly api = inject(AppointmentsApi);
  private readonly transloco = inject(TranslocoService);

  /** `calendar-options`: the shop's zone and its barbers. `null` until read, or on a failure. */
  readonly options = signal<CalendarOptionsResponse | null>(null);

  /** Bumped by a write in the drawer or by the toolbar's refresh. The grid reloads on it. */
  readonly revision = signal(0);

  /** The shop's zone. The browser's while the options are missing, as the calendar does. */
  readonly timezone = computed(
    () => this.options()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  /** Every barber the shop has had, inactive ones included: their past appointments are rows. */
  readonly roster = computed<readonly CalendarStaffMemberViewDto[]>(
    () => this.options()?.staffMembers ?? [],
  );

  /**
   * The book, filtered, sorted and paged by the endpoint.
   *
   * The three field lists describe the row to the binding: which members hold GUIDs, which is a
   * list, and which text members have a folded twin for `contains`.
   */
  readonly appointments: DataSource<AppointmentODataResponse> =
    odataSource<AppointmentODataResponse>({
      fetch: (query) => this.api.grid(query, this.language()),
      key: { selector: 'id', type: 'uuid' },
      capabilities: { maxTop: APPOINTMENTS_MAX_TOP },
      guidFields: ['id', 'customerId', 'staffMemberId', 'services.serviceId'],
      collections: ['services'],
      normalizedFields: {
        cancelledByDisplayName: 'cancelledByNameNormalized',
        cancellationReason: 'cancellationReasonNormalized',
      },
    });

  /** The shop's customers, searched by name, phone and email on the server. */
  readonly customers: DataSource<CustomerOptionODataResponse> = customersSource(this.api);

  /**
   * The shop's services, inactive ones included, searched on the server. The term is folded and
   * quoted as the customers source does it: an unquoted word with a digit is a 400, and Postgres
   * never lowercases `Σ` to the final `ς`.
   */
  readonly services: DataSource<ServiceOptionODataResponse> =
    odataSource<ServiceOptionODataResponse>({
      fetch: (query) =>
        this.api.services(
          {
            ...query,
            search: query.search === undefined ? undefined : quotedSearch(query.search),
            orderBy: query.orderBy ?? 'name',
          },
          this.language(),
        ),
      key: { selector: 'id', type: 'uuid' },
      capabilities: { search: true },
    });

  /** The roster, searched locally: it is one short list, read once per visit. */
  readonly barbers: DataSource<CalendarStaffMemberViewDto> = createArraySource(
    () => this.roster(),
    { key: { selector: 'id', type: 'uuid' }, searchFields: ['displayName'] },
  );

  /**
   * Reads the shop's options. A failure leaves `null`: the page still renders, in the browser's
   * zone, and the Barber filter lists nobody.
   */
  async loadOptions(): Promise<void> {
    const result = await firstValueFrom(this.api.calendarOptions(this.language()));
    this.options.set(result.isSuccess ? (result.data ?? null) : null);
  }

  /** One customer's name, for the tab of the view that shows their appointments. */
  async customerName(customerId: string): Promise<string | null> {
    if (this.customers.byKeys === undefined) {
      return null;
    }
    try {
      const found = await this.customers.byKeys([customerId]);
      return found.at(0)?.displayName ?? null;
    } catch {
      return null;
    }
  }

  reload(): void {
    this.revision.update((value) => value + 1);
  }

  private language(): string {
    return this.transloco.getActiveLang();
  }
}

/** One folded, quoted `$search` phrase, or `undefined` when nothing is left to search. */
function quotedSearch(raw: string): string | undefined {
  const term = foldText(raw.trim());
  return term === '' ? undefined : `"${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

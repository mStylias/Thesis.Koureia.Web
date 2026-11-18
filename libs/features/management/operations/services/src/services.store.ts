import { Service, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  ServicesApi,
  type ServiceCategoryResponse,
  type ServiceODataResponse,
  type ServiceOptionStaffMemberViewDto,
  type ServiceOptionsResponse,
} from '@api/services';
import { odataSource } from '@data/odata-source';
import { createArraySource, type DataSource } from '@ui/data-source';

/** The endpoint's own cap on `$top`. Every page size the grid offers fits under it. */
const SERVICES_MAX_TOP = 100;

/**
 * What the grid, its header filters and the drawer over it share.
 *
 * `autoProvided: false` and provided by `ServicesList`, so each visit starts a new store. The
 * drawer, a child route in the page's outlet, reads the same one.
 */
@Service({ autoProvided: false })
export class ServicesStore {
  private readonly api = inject(ServicesApi);
  private readonly transloco = inject(TranslocoService);

  /** `services/options`. `null` until read, or on a failure. */
  readonly options = signal<ServiceOptionsResponse | null>(null);

  /** The last read of the options failed. The drawer offers a retry. */
  readonly optionsFailed = signal(false);

  /** Bumped by a write in the drawer or by the toolbar's refresh. The grid reloads on it. */
  readonly revision = signal(0);

  readonly currency = computed(() => this.options()?.currency ?? 'EUR');

  readonly categories = computed<readonly ServiceCategoryResponse[]>(
    () => this.options()?.categories ?? [],
  );

  readonly staffMembers = computed<readonly ServiceOptionStaffMemberViewDto[]>(
    () => this.options()?.staffMembers ?? [],
  );

  /** The catalog, filtered, sorted and paged by the endpoint. */
  readonly services: DataSource<ServiceODataResponse> = odataSource<ServiceODataResponse>({
    fetch: (query) => this.api.grid(query, this.language()),
    key: { selector: 'id', type: 'uuid' },
    capabilities: { maxTop: SERVICES_MAX_TOP },
    guidFields: ['id', 'categoryId', 'staff.staffMemberId'],
    collections: ['staff'],
    normalizedFields: { name: 'nameNormalized' },
  });

  /** Who can hold a service: the bookable staff, inactive ones included. Searched locally. */
  readonly barbers: DataSource<ServiceOptionStaffMemberViewDto> = createArraySource(
    () => this.staffMembers().filter((member) => member.isBookable),
    { key: { selector: 'id', type: 'uuid' }, searchFields: ['displayName'] },
  );

  /** Reads the options. A failure leaves `null`: the grid still renders, with empty lists. */
  async loadOptions(): Promise<void> {
    this.optionsFailed.set(false);
    const result = await firstValueFrom(this.api.options(this.language()));
    this.options.set(result.isSuccess ? (result.data ?? null) : null);
    this.optionsFailed.set(!result.isSuccess);
  }

  reload(): void {
    this.revision.update((value) => value + 1);
  }

  private language(): string {
    return this.transloco.getActiveLang();
  }
}

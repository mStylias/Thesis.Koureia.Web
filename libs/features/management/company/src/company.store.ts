import { computed, inject, linkedSignal, Service } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import type { BusinessHourViewDto } from '@api/appointments';
import {
  CompanyApi,
  type CompanyBookingRulesResponse,
  type CompanySettingsResponse,
} from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { Result } from '@synax/client/core';

/**
 * The shop's settings for the Shop, Opening hours and Booking rules cards. Closures and photos
 * have their own resources in their cards.
 *
 * Provided by `ManagementCompany`. A language change reads the settings again. A shop change
 * re-creates the page, and the store with it.
 */
@Service({ autoProvided: false })
export class CompanyStore {
  private readonly api = inject(CompanyApi);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);

  readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly resource = rxResource({
    params: () => ({ language: this.language() }),
    stream: ({ params }) => this.api.settings(params.language),
  });

  private readonly result = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  /** `null` until the settings land. */
  readonly settings = linkedSignal<
    Result<CompanySettingsResponse> | undefined,
    CompanySettingsResponse | null
  >({
    source: this.result,
    computation: (result) => (result !== undefined && Result.hasData(result) ? result.data : null),
  });

  /** The read failed. A retry can help. */
  readonly failed = computed(
    () => this.resource.status() === 'error' || this.result()?.isFailure === true,
  );

  /** The caller can change the settings. A platform admin always can. */
  readonly canEdit = computed(() => this.access.has('company:update'));

  /** The shop's zone. The browser's until the settings land. */
  readonly timezone = computed(
    () => this.settings()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  reload(): void {
    this.resource.reload();
  }

  /** After a save: the saved week, with no new read. */
  setHours(businessHours: readonly BusinessHourViewDto[]): void {
    this.settings.update((settings) => (settings === null ? null : { ...settings, businessHours }));
  }

  /** After a save: the saved rules, with no new read. */
  setBookingRules(bookingRules: CompanyBookingRulesResponse): void {
    this.settings.update((settings) => (settings === null ? null : { ...settings, bookingRules }));
  }

  /** After an upload or a removal. */
  setLogo(logoUrl: string | null): void {
    this.settings.update((settings) => (settings === null ? null : { ...settings, logoUrl }));
  }
}

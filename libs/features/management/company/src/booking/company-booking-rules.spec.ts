import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import {
  CompanyApi,
  type CompanyBookingRulesResponse,
  type CompanySettingsResponse,
} from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { providePageSections } from '@features/management-shared-page-sections';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { Result, type HttpError } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { companyErrorMessages } from '../company.errors';
import { companyInlineLoader } from '../company.i18n';
import { CompanyStore } from '../company.store';
import { CompanyBookingRules } from './company-booking-rules';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const RULES: CompanyBookingRulesResponse = {
  slotIntervalMinutes: 15,
  // Seed data: not one of the presets.
  minLeadTimeMinutes: 45,
  maxAdvanceDays: 60,
  cancellationCutoffMinutes: 1440,
};

function settings(bookingRules: CompanyBookingRulesResponse): CompanySettingsResponse {
  return {
    id: 'c1',
    slug: 'shop',
    name: 'Shop',
    street: 'Street 1',
    neighborhood: null,
    city: 'Athens',
    region: null,
    postalCode: '10563',
    countryCode: 'GR',
    phone: '+302101234567',
    email: 'shop@example.com',
    website: null,
    timezone: 'Europe/Athens',
    currency: 'EUR',
    logoUrl: null,
    businessHours: [],
    bookingRules,
    supportEmail: null,
  };
}

describe('CompanyBookingRules', () => {
  let fixture: ComponentFixture<CompanyBookingRules>;
  let codes: Set<string>;
  const api = {
    settings: vi.fn<() => Observable<Result<CompanySettingsResponse>>>(),
    updateBookingRules:
      vi.fn<
        (request: CompanyBookingRulesResponse) => Observable<Result<CompanyBookingRulesResponse>>
      >(),
  };
  const toaster = { success: vi.fn(), error: vi.fn() };

  async function render(
    rules: CompanyBookingRulesResponse = RULES,
    held: readonly string[] = ['company:update'],
  ): Promise<void> {
    api.settings.mockReturnValue(of(Result.Ok(settings(rules))));
    codes = new Set(held);
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        providePageSections({ discardMessage: 'managementCompany.discard.message' }),
        CompanyStore,
        { provide: CompanyApi, useValue: api },
        {
          provide: StaffAccessStore,
          useValue: {
            has: (code: string) => codes.has(code),
            company: () => ({ id: 'c1', name: 'Shop', timezone: null }),
          },
        },
        { provide: ToasterService, useValue: toaster },
        { provide: ConfirmationService, useValue: { open: vi.fn() } },
        { provide: SYNAX_ERROR_MESSAGES, useFactory: companyErrorMessages },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementCompany/en', { inlineLoader: companyInlineLoader }),
    );
    fixture = TestBed.createComponent(CompanyBookingRules);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    );
  }

  async function edit(): Promise<void> {
    button('Edit')?.click();
    await settle();
  }

  async function submit(): Promise<void> {
    host()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    await settle();
  }

  function lines(): string[] {
    return Array.from(host().querySelectorAll('.booking-grid lib-field')).map(
      (field) =>
        `${field.querySelector('.field-view-label')?.textContent.trim() ?? ''}: ${field.querySelector('.booking-value')?.textContent.trim() ?? ''}`,
    );
  }

  /** The options of one select, as the component offers them. */
  function choices(rule: keyof CompanyBookingRulesResponse): { value: number; label: string }[] {
    const card = fixture.componentInstance as unknown as {
      options(): Record<string, { value: number; label: string }[]>;
    };
    return card.options()[rule] ?? [];
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads each rule as a sentence', async () => {
    await render();

    expect(lines()).toEqual([
      'Appointment interval: Every 15 minutes',
      'Minimum notice: At least 45 minutes before',
      'Bookings up to: 60 days ahead',
      'Free cancellation: Up to 1 day before',
    ]);
  });

  it('reads a zero as no limit and as any time', async () => {
    await render({ ...RULES, minLeadTimeMinutes: 0, cancellationCutoffMinutes: 0 });

    expect(lines()).toContain('Minimum notice: No limit');
    expect(lines()).toContain('Free cancellation: Any time');
  });

  it('offers no Edit without company:update', async () => {
    await render(RULES, []);

    expect(button('Edit')).toBeUndefined();
  });

  it('offers a stored value that is not a preset as its own option, in its place', async () => {
    await render();
    await edit();

    expect(choices('minLeadTimeMinutes').map((choice) => choice.value)).toEqual([
      0, 15, 30, 45, 60, 120, 180, 360, 720, 1440, 2880,
    ]);
    expect(
      choices('minLeadTimeMinutes')
        .map((choice) => choice.label)
        .slice(0, 5),
    ).toEqual(['No limit', '15 minutes', '30 minutes', '45 minutes', '1 hour']);
    expect(choices('slotIntervalMinutes').map((choice) => choice.value)).toEqual([
      5, 10, 15, 20, 30, 60,
    ]);
  });

  it('sends all four, the untouched seed value unchanged', async () => {
    api.updateBookingRules.mockReturnValue(of(Result.Ok(RULES)));
    await render();
    await edit();

    await submit();

    expect(api.updateBookingRules).toHaveBeenCalledWith(RULES);
    expect(toaster.success).toHaveBeenCalledWith('Booking rules saved.');
    expect(host().querySelector('lib-select')).toBeNull();
  });

  it('puts COMPANY_INVALID_BOOKING_RULES on the field it names', async () => {
    const error: HttpError = {
      errorCode: 'VALIDATION_FAILED',
      httpCode: 400,
      validationErrors: [
        {
          code: 'COMPANY_INVALID_BOOKING_RULES',
          description: 'Bad',
          propertyName: 'maxAdvanceDays',
        },
      ],
    };
    api.updateBookingRules.mockReturnValue(of(Result.Fail(error)));
    await render();
    await edit();

    await submit();

    const fields = Array.from(host().querySelectorAll('lib-field'));
    expect(fields[2]?.textContent).toContain('The value is not valid.');
    expect(fields[0]?.textContent).not.toContain('The value is not valid.');
  });
});

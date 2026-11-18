import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { BusinessHourViewDto } from '@api/appointments';
import {
  CompanyApi,
  type CompanyScheduleChangeResponse,
  type CompanySettingsResponse,
  type UpdateCompanyBusinessHoursRequest,
} from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { PageEditors, providePageSections } from '@features/management-shared-page-sections';
import { staffScheduleInlineLoader } from '@features/management-shared-staff-schedule';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { Result, type HttpError } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { companyErrorMessages } from '../company.errors';
import { companyInlineLoader } from '../company.i18n';
import { CompanyStore } from '../company.store';
import { CompanyHours } from './company-hours';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const SPLIT_TUESDAY: readonly BusinessHourViewDto[] = [
  { dayOfWeek: 1, openTime: '09:00', closeTime: '21:00' },
  { dayOfWeek: 2, openTime: '09:00', closeTime: '14:30' },
  { dayOfWeek: 2, openTime: '17:00', closeTime: '21:00' },
];

function settings(businessHours: readonly BusinessHourViewDto[]): CompanySettingsResponse {
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
    businessHours,
    bookingRules: {
      slotIntervalMinutes: 15,
      minLeadTimeMinutes: 0,
      maxAdvanceDays: 60,
      cancellationCutoffMinutes: 60,
    },
    supportEmail: null,
  };
}

const CONFLICT = {
  appointmentId: 'a1',
  localDate: '2026-10-17',
  localStartTime: '18:00',
  localEndTime: '18:30',
  customerDisplayName: 'Νίκος Π.',
  staffMemberDisplayName: 'Μαρία Κ.',
};

describe('CompanyHours', () => {
  let fixture: ComponentFixture<CompanyHours>;
  let codes: Set<string>;
  const api = {
    settings: vi.fn<() => Observable<Result<CompanySettingsResponse>>>(),
    updateHours:
      vi.fn<
        (
          request: UpdateCompanyBusinessHoursRequest,
        ) => Observable<Result<CompanyScheduleChangeResponse>>
      >(),
  };
  const confirmation = { open: vi.fn(() => Promise.resolve('confirmed')) };
  const toaster = { success: vi.fn(), error: vi.fn() };
  let scrolled: ReturnType<typeof vi.fn<Element['scrollIntoView']>>;

  async function render(
    hours: readonly BusinessHourViewDto[] = SPLIT_TUESDAY,
    held: readonly string[] = ['company:update'],
  ): Promise<void> {
    api.settings.mockReturnValue(of(Result.Ok(settings(hours))));
    codes = new Set(held);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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
        { provide: ConfirmationService, useValue: confirmation },
        // As the route provides it.
        { provide: SYNAX_ERROR_MESSAGES, useFactory: companyErrorMessages },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementCompany/en', { inlineLoader: companyInlineLoader }),
    );
    await firstValueFrom(
      transloco.load('managementStaffSchedule/en', { inlineLoader: staffScheduleInlineLoader }),
    );
    fixture = TestBed.createComponent(CompanyHours);
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

  function text(): string {
    return host().textContent.replace(/\s+/g, ' ');
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    );
  }

  async function press(label: string): Promise<void> {
    const found = button(label);
    if (found === undefined) throw new Error(`${label} not rendered`);
    found.click();
    await settle();
  }

  async function toggle(dayIndex: number): Promise<void> {
    const found = host().querySelector<HTMLInputElement>(`#company-hours-day-${dayIndex}`);
    if (found === null) throw new Error(`switch ${dayIndex} not rendered`);
    found.click();
    await settle();
  }

  async function submit(): Promise<void> {
    host()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    await settle();
  }

  /** The view's rows as `<day> <value>`. */
  function viewRows(): string[] {
    return Array.from(host().querySelectorAll('.hours-row')).map(
      (row) =>
        `${row.querySelector('dt')?.textContent.trim() ?? ''} ${row.querySelector('dd')?.textContent.trim() ?? ''}`,
    );
  }

  function sent(): UpdateCompanyBusinessHoursRequest | undefined {
    return api.updateHours.mock.calls.at(-1)?.[0];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    scrolled = vi.fn<Element['scrollIntoView']>();
    Element.prototype.scrollIntoView = scrolled;
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('shows the week Monday first, each day with its ranges or Closed', async () => {
    await render();

    const rows = viewRows();
    expect(rows).toEqual([
      'Monday 09:00–21:00',
      'Tuesday 09:00–14:30, 17:00–21:00',
      'Wednesday Closed',
      'Thursday Closed',
      'Friday Closed',
      'Saturday Closed',
      'Sunday Closed',
    ]);
  });

  it('says that an empty week takes no bookings', async () => {
    await render([]);

    expect(text()).toContain('No opening hours are set. The shop takes no bookings.');
  });

  it('offers no Edit without company:update', async () => {
    await render(SPLIT_TUESDAY, []);

    expect(button('Edit')).toBeUndefined();
  });

  it('sends the whole week, a closed day with no range', async () => {
    api.updateHours.mockReturnValue(
      of(Result.Ok({ businessHours: SPLIT_TUESDAY.slice(1), holiday: null, conflicts: [] })),
    );
    await render();

    await press('Edit');
    await toggle(0);
    await submit();

    expect(sent()).toEqual({
      businessHours: [
        { dayOfWeek: 2, openTime: '09:00', closeTime: '14:30' },
        { dayOfWeek: 2, openTime: '17:00', closeTime: '21:00' },
      ],
    });
    expect(toaster.success).toHaveBeenCalledWith('Opening hours saved.');
    expect(button('Save')).toBeUndefined();
    expect(viewRows()[0]).toBe('Monday Closed');
  });

  it('refuses an overlap before it sends anything', async () => {
    await render([
      { dayOfWeek: 1, openTime: '09:00', closeTime: '14:00' },
      { dayOfWeek: 1, openTime: '13:00', closeTime: '18:00' },
    ]);

    await press('Edit');
    await submit();

    expect(api.updateHours).not.toHaveBeenCalled();
    expect(text()).toContain('The range overlaps another one on the same day.');
  });

  it('refuses a fifth range on one day before it sends anything', async () => {
    await render(
      ['08:00', '10:00', '12:00', '14:00', '16:00'].map((openTime, index) => ({
        dayOfWeek: 1,
        openTime,
        closeTime: `${String(9 + index * 2).padStart(2, '0')}:00`,
      })),
    );

    await press('Edit');
    expect(button('Add range')).toBeUndefined();
    await submit();

    expect(api.updateHours).not.toHaveBeenCalled();
    expect(text()).toContain('At most 4 ranges a day.');
  });

  it('asks before it saves a week with every day closed, and sends nothing on Cancel', async () => {
    confirmation.open.mockResolvedValueOnce('cancelled');
    await render([{ dayOfWeek: 1, openTime: '09:00', closeTime: '21:00' }]);

    await press('Edit');
    await toggle(0);
    await submit();

    expect(confirmation.open).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Closed every day?' }),
    );
    expect(api.updateHours).not.toHaveBeenCalled();
    expect(button('Save')).toBeDefined();
  });

  it('sends an empty week once the closure of every day is confirmed', async () => {
    api.updateHours.mockReturnValue(
      of(Result.Ok({ businessHours: [], holiday: null, conflicts: [] })),
    );
    await render([{ dayOfWeek: 1, openTime: '09:00', closeTime: '21:00' }]);

    await press('Edit');
    await toggle(0);
    await submit();

    expect(sent()).toEqual({ businessHours: [] });
  });

  it('puts an error on businessHours[2] on the range it came from', async () => {
    const error: HttpError = {
      errorCode: 'VALIDATION_FAILED',
      httpCode: 400,
      validationErrors: [
        {
          code: 'COMPANY_INVALID_BUSINESS_HOURS',
          description: 'Bad range',
          propertyName: 'businessHours[2]',
        },
      ],
    };
    api.updateHours.mockReturnValue(of(Result.Fail(error)));
    await render();

    await press('Edit');
    await submit();

    // Monday has one range, so the third range sent is Tuesday's second.
    const errors = Array.from(host().querySelectorAll('.hours-error'));
    expect(errors.map((node) => node.textContent.trim())).toEqual(['The range is not valid.']);
    // The message sits right under the range it is about.
    const range = errors[0]?.previousElementSibling;
    const tuesday = Array.from(host().querySelectorAll('.hours-day')).at(1);
    expect(range).toBe(Array.from(tuesday?.querySelectorAll('.hours-range') ?? []).at(1));
  });

  it('lists the conflicts of a save, moves focus to them, and hides them on Hide', async () => {
    api.updateHours.mockReturnValue(
      of(Result.Ok({ businessHours: SPLIT_TUESDAY, holiday: null, conflicts: [CONFLICT] })),
    );
    await render(SPLIT_TUESDAY, ['company:update', 'appointments:read_all']);

    await press('Edit');
    await submit();

    const banner = host().querySelector('lib-staff-conflicts lib-banner');
    expect(banner?.textContent).toContain('1 appointment outside the opening hours');
    expect(banner?.textContent).toContain('Μαρία Κ.');
    expect(banner?.textContent).toContain('Νίκος Π.');
    expect(banner?.querySelector('a')?.getAttribute('href')).toBe('/management/appointments/a1');
    expect(document.activeElement).toBe(banner);
    expect(scrolled.mock.contexts).toContain(banner);

    await press('Hide');
    expect(host().querySelector('lib-staff-conflicts')).toBeNull();
  });

  it("says after a save that the barbers' hours stay, linking the staff page only with members:read", async () => {
    api.updateHours.mockReturnValue(
      of(Result.Ok({ businessHours: SPLIT_TUESDAY, holiday: null, conflicts: [] })),
    );
    await render();
    expect(text()).not.toContain("The barbers' hours do not change.");

    await press('Edit');
    await submit();
    expect(text()).toContain("The barbers' hours do not change.");
    expect(host().querySelector('a[href="/management/staff"]')).toBeNull();

    TestBed.resetTestingModule();
    await render(SPLIT_TUESDAY, ['company:update', 'members:read']);
    await press('Edit');
    await submit();
    expect(host().querySelector('a[href="/management/staff"]')).not.toBeNull();
  });

  it('tells the page about unsaved changes and drops them on discard', async () => {
    await render();
    const editors = TestBed.inject(PageEditors);

    await press('Edit');
    expect(editors.hasChanges()).toBe(false);
    await toggle(2);
    expect(editors.hasChanges()).toBe(true);

    fixture.componentInstance.discard();
    await settle();
    expect(editors.hasChanges()).toBe(false);
    expect(button('Edit')).toBeDefined();
  });

  it('gives focus back to Edit after Cancel', async () => {
    await render();

    await press('Edit');
    await press('Cancel');

    expect(document.activeElement).toBe(button('Edit'));
  });
});

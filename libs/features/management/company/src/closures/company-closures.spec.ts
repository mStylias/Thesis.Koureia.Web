import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import {
  CompanyApi,
  type CompanyHolidayResponse,
  type CompanyScheduleChangeResponse,
  type CompanySettingsResponse,
  type CreateCompanyHolidayRequest,
} from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { providePageSections } from '@features/management-shared-page-sections';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { Result, type HttpError } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { DatePicker } from '@ui/date-picker';
import { DIALOG_CLOSE_DELAY } from '@ui/dialog';
import { ToasterService } from '@ui/toaster';
import type { FormEditor } from '@util/forms';
import { firstValueFrom, of, Subject, type Observable } from 'rxjs';

import { companyErrorMessages } from '../company.errors';
import { addDays, shopToday } from '../company.format';
import { companyInlineLoader } from '../company.i18n';
import { CompanyStore } from '../company.store';
import type { ClosureFormValue } from '../form/closure.form.types';
import { ClosureDialog } from './closure-dialog';
import { CompanyClosures } from './company-closures';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const TODAY = shopToday('Europe/Athens');

const UPCOMING: CompanyHolidayResponse = {
  id: 'h1',
  startsOn: addDays(TODAY, 10),
  endsOn: addDays(TODAY, 10),
  isClosed: true,
  openTime: null,
  closeTime: null,
  name: 'Αργία',
};

const SPECIAL: CompanyHolidayResponse = {
  id: 'h2',
  startsOn: addDays(TODAY, 20),
  endsOn: addDays(TODAY, 20),
  isClosed: false,
  openTime: '09:00',
  closeTime: '15:00',
  name: null,
};

const STARTED: CompanyHolidayResponse = {
  id: 'h3',
  startsOn: addDays(TODAY, -2),
  endsOn: addDays(TODAY, 3),
  isClosed: true,
  openTime: null,
  closeTime: null,
  name: 'Ανακαίνιση',
};

const ENDED: CompanyHolidayResponse = {
  id: 'h0',
  startsOn: addDays(TODAY, -40),
  endsOn: addDays(TODAY, -38),
  isClosed: true,
  openTime: null,
  closeTime: null,
  name: null,
};

const SETTINGS = {
  id: 'c1',
  timezone: 'Europe/Athens',
  businessHours: [],
} as unknown as CompanySettingsResponse;

function failure(code: string, httpCode: number, propertyName?: string): HttpError {
  return {
    errorCode: propertyName === undefined ? code : 'VALIDATION_FAILED',
    httpCode,
    validationErrors:
      propertyName === undefined ? [] : [{ code, description: 'Server text', propertyName }],
  };
}

describe('CompanyClosures', () => {
  let fixture: ComponentFixture<CompanyClosures>;
  let codes: Set<string>;
  const api = {
    settings: vi.fn<() => Observable<Result<CompanySettingsResponse>>>(),
    holidays: vi.fn<(past: boolean) => Observable<Result<CompanyHolidayResponse[]>>>(),
    createHoliday:
      vi.fn<
        (request: CreateCompanyHolidayRequest) => Observable<Result<CompanyScheduleChangeResponse>>
      >(),
    updateHoliday:
      vi.fn<
        (
          id: string,
          request: CreateCompanyHolidayRequest,
        ) => Observable<Result<CompanyScheduleChangeResponse>>
      >(),
    deleteHoliday: vi.fn<(id: string) => Observable<Result<null>>>(),
  };
  const confirmation = { open: vi.fn(() => Promise.resolve('confirmed')) };
  const toaster = { success: vi.fn(), error: vi.fn() };

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  });

  async function render(
    current: readonly CompanyHolidayResponse[] = [UPCOMING, SPECIAL],
    held: readonly string[] = ['company:update'],
  ): Promise<void> {
    api.settings.mockReturnValue(of(Result.Ok(SETTINGS)));
    api.holidays.mockImplementation((past) => of(Result.Ok(past ? [ENDED] : [...current])));
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
        { provide: SYNAX_ERROR_MESSAGES, useFactory: companyErrorMessages },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementCompany/en', { inlineLoader: companyInlineLoader }),
    );
    fixture = TestBed.createComponent(CompanyClosures);
    await settle();
  }

  // A tick between the passes: the dialog's own scope arrives through a dynamic import.
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): string[] {
    return Array.from(
      host().querySelectorAll('.closures-list:not(#closures-past-list *) > li'),
    ).map((row) => row.textContent.replace(/\s+/g, ' ').trim());
  }

  /** The dates of the current list's row, as its buttons name them. */
  function dates(index: number): string {
    return (
      Array.from(host().querySelectorAll('.closures-dates')).at(index)?.textContent.trim() ?? ''
    );
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (candidate) =>
        candidate.textContent.trim() === label || candidate.getAttribute('aria-label') === label,
    );
  }

  async function press(label: string): Promise<void> {
    const found = button(label);
    if (found === undefined) throw new Error(`${label} not rendered`);
    found.click();
    await settle();
  }

  function dialog(): {
    editor: FormEditor<ClosureFormValue>;
    visible(): boolean;
    save(): void;
  } {
    return fixture.debugElement.query(By.directive(ClosureDialog)).componentInstance as never;
  }

  async function fill(value: Partial<ClosureFormValue>): Promise<void> {
    const form = dialog().editor.form;
    for (const [key, entry] of Object.entries(value) as [keyof ClosureFormValue, never][]) {
      form[key]().value.set(entry);
    }
    await settle();
  }

  /** Picks Από in its date picker, as a person does. */
  async function pickStartsOn(day: string): Promise<void> {
    const picker = fixture.debugElement.query(By.directive(DatePicker))
      .componentInstance as DatePicker;
    picker.value.set(day);
    await settle();
  }

  async function save(): Promise<void> {
    dialog().save();
    await settle();
    await settle();
  }

  function dialogText(): string {
    return host().querySelector('lib-closure-dialog')?.textContent.replace(/\s+/g, ' ') ?? '';
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the dates, the kind and the name of each range, soonest first', async () => {
    await render();

    expect(host().querySelector('lib-page-section')?.id).toBe('closures');
    expect(rows()[0]).toContain('Closed');
    expect(rows()[0]).toContain('Αργία');
    expect(rows()[1]).toContain('Special hours 09:00–15:00');
    expect(host().querySelector('.closures-tag[data-tone="info"]')?.textContent).toContain(
      'Special hours',
    );
  });

  it('tags a range that runs today as in progress', async () => {
    await render([STARTED]);

    expect(host().querySelector('.closures-tag[data-tone="warning"]')?.textContent.trim()).toBe(
      'In progress',
    );
  });

  it('says when nothing is planned', async () => {
    await render([]);

    expect(host().textContent).toContain('No closures are planned.');
  });

  it('offers no Add, Edit or Delete without company:update', async () => {
    await render([UPCOMING], []);

    expect(button('Add')).toBeUndefined();
    expect(host().querySelector('.closures-actions')).toBeNull();
  });

  it('loads the ended ones only on demand, with no actions', async () => {
    await render();
    expect(api.holidays).not.toHaveBeenCalledWith(true);

    await press('Past');

    expect(api.holidays).toHaveBeenCalledWith(true);
    const past = host().querySelector('#closures-past-list');
    expect(past?.querySelectorAll('li')).toHaveLength(1);
    expect(past?.querySelector('button')).toBeNull();
  });

  it('sends a closure with both times null, then reads the list again', async () => {
    api.createHoliday.mockReturnValue(
      of(Result.Ok({ businessHours: null, holiday: UPCOMING, conflicts: [] })),
    );
    await render();

    await press('Add');
    await fill({ startsOn: addDays(TODAY, 5), endsOn: addDays(TODAY, 6), name: '  Πάσχα ' });
    await save();

    expect(api.createHoliday).toHaveBeenCalledWith({
      startsOn: addDays(TODAY, 5),
      endsOn: addDays(TODAY, 6),
      isClosed: true,
      openTime: null,
      closeTime: null,
      name: 'Πάσχα',
    });
    expect(toaster.success).toHaveBeenCalledWith('Closure added.');
    expect(api.holidays).toHaveBeenCalledTimes(2);
  });

  it('refuses special hours without times before it sends anything', async () => {
    await render();

    await press('Add');
    await fill({ closedAllDay: false });
    await save();

    expect(api.createHoliday).not.toHaveBeenCalled();
    expect(dialogText()).toContain('Fill in the time.');
  });

  it('refuses a close before the open, and a day before today', async () => {
    await render();

    await press('Add');
    await fill({
      startsOn: addDays(TODAY, -1),
      closedAllDay: false,
      openTime: '15:00',
      closeTime: '09:00',
    });
    await save();

    expect(api.createHoliday).not.toHaveBeenCalled();
    expect(dialogText()).toContain('The closing time must be after the opening time.');
    // The picker refuses the day itself, with its own words.
    expect(dialogText()).toContain('Choose one of the available dates.');
  });

  it('keeps Έως on Από until it is set on its own', async () => {
    await render();

    await press('Add');
    await pickStartsOn(addDays(TODAY, 3));
    expect(dialog().editor.form.endsOn().value()).toBe(addDays(TODAY, 3));

    await fill({ endsOn: addDays(TODAY, 8) });
    await pickStartsOn(addDays(TODAY, 4));
    expect(dialog().editor.form.endsOn().value()).toBe(addDays(TODAY, 8));

    await pickStartsOn(addDays(TODAY, 9));
    expect(dialog().editor.form.endsOn().value()).toBe(addDays(TODAY, 9));
  });

  it('opens a started closure with Από read-only and keeps its first day', async () => {
    api.updateHoliday.mockReturnValue(
      of(Result.Ok({ businessHours: null, holiday: STARTED, conflicts: [] })),
    );
    await render([STARTED]);

    await press(`Edit closure ${dates(0)}`);

    expect(dialog().editor.form.startsOn().readonly()).toBe(true);
    expect(dialogText()).toContain('The closure has already started.');
    await fill({ endsOn: addDays(TODAY, 1) });
    await save();
    expect(api.updateHoliday).toHaveBeenCalledWith(
      'h3',
      expect.objectContaining({ startsOn: STARTED.startsOn, endsOn: addDays(TODAY, 1) }),
    );
  });

  it('puts COMPANY_HOLIDAY_OVERLAP under Από', async () => {
    api.createHoliday.mockReturnValue(
      of(Result.Fail(failure('COMPANY_HOLIDAY_OVERLAP', 409, 'startsOn'))),
    );
    await render();

    await press('Add');
    await save();

    const fields = Array.from(host().querySelectorAll('lib-closure-dialog lib-field'));
    expect(fields[0]?.textContent).toContain('There is already a closure on these days.');
    expect(fields[1]?.textContent).not.toContain('There is already a closure on these days.');
  });

  it('closes the dialog, toasts and reads the list again on COMPANY_HOLIDAY_ENDED', async () => {
    api.updateHoliday.mockReturnValue(of(Result.Fail(failure('COMPANY_HOLIDAY_ENDED', 409))));
    await render([UPCOMING]);

    await press(`Edit closure ${dates(0)}`);
    await save();

    expect(toaster.error).toHaveBeenCalledWith('The closure has ended and cannot change.');
    expect(api.holidays).toHaveBeenCalledTimes(2);
    expect(dialog().visible()).toBe(false);
  });

  it('lists the conflicts of a save above the list', async () => {
    const conflict = {
      appointmentId: 'a1',
      localDate: UPCOMING.startsOn,
      localStartTime: '10:00',
      localEndTime: '10:30',
      customerDisplayName: 'Νίκος Π.',
      staffMemberDisplayName: 'Μαρία Κ.',
    };
    api.createHoliday.mockReturnValue(
      of(Result.Ok({ businessHours: null, holiday: UPCOMING, conflicts: [conflict] })),
    );
    Element.prototype.scrollIntoView = vi.fn();
    await render();
    const reload = new Subject<Result<CompanyHolidayResponse[]>>();
    api.holidays.mockReturnValue(reload);

    await press('Add');
    dialog().save();
    // The reload after the save is still on its way: the list stays, and the banner takes focus.
    await new Promise((resolve) => setTimeout(resolve, DIALOG_CLOSE_DELAY + 20));
    for (let tick = 0; tick < 3; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();
    }

    const banner = host().querySelector('lib-staff-conflicts lib-banner');
    expect(banner?.textContent).toContain('1 appointment inside the closure');
    expect(banner?.textContent).toContain('Μαρία Κ.');
    expect(document.activeElement).toBe(banner);
    expect(rows()).toHaveLength(2);

    reload.next(Result.Ok([UPCOMING, SPECIAL]));
    reload.complete();
    await settle();
    expect(host().querySelector('lib-staff-conflicts')).not.toBeNull();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('explains that deleting a started closure ends it yesterday', async () => {
    api.deleteHoliday.mockReturnValue(of(Result.Ok(null)));
    await render([STARTED]);

    await press(`Delete closure ${dates(0)}`);

    expect(confirmation.open).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'The closure will end yesterday. The days that have passed stay in the history.',
      }),
    );
    expect(api.deleteHoliday).toHaveBeenCalledWith('h3');
    expect(toaster.success).toHaveBeenCalledWith('Closure deleted.');
  });

  it('asks with the dates before it deletes any other one, and keeps it on Cancel', async () => {
    confirmation.open.mockResolvedValueOnce('cancelled');
    await render([UPCOMING]);

    await press(`Delete closure ${dates(0)}`);

    expect(confirmation.open).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete the closure?' }),
    );
    expect(api.deleteHoliday).not.toHaveBeenCalled();
  });
});

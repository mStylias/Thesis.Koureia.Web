import { Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  Router,
  type ParamMap,
  type UrlTree,
} from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type {
  AppointmentCatalogResponse,
  AppointmentDetailsResponse,
  CustomerOptionODataResponse,
} from '@api/appointments';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import type { FormEditor } from '@util/forms';
import { BehaviorSubject, firstValueFrom, of, type Observable } from 'rxjs';
import type { Mock } from 'vitest';

import { appointmentsInlineLoader } from '../appointments.i18n';
import type { AppointmentFormValue } from '../form/appointment.form.types';
import { APPOINTMENT_PANEL_HOST } from '../host/appointment-panel-host';
import type {
  AppointmentPanelHost,
  AppointmentPrefill,
} from '../host/appointment-panel-host.types';
import { AppointmentDetails } from './appointment-details';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

// jsdom has no <dialog> methods; the drawer drives the dialog with them.
beforeAll(() => {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const BOOK = 'http://api.test/api/v1/appointments';
const CUSTOMER = '0192a0c1-7d44-7a1b-9e2f-3c1d2b4a5e6f';

const APPOINTMENT: AppointmentDetailsResponse = {
  id: 'a1',
  staffMemberId: 'nikos',
  staffDisplayName: 'Nikos P.',
  customerId: CUSTOMER,
  customerDisplayName: 'Giorgos Papas',
  customerEmail: 'giorgos@example.com',
  customerPhoneNumber: '+30 690 000 0000',
  localDate: '2020-01-10',
  localStartTime: '10:00',
  localEndTime: '10:30',
  status: 'confirmed',
  notes: null,
  internalNotes: null,
  totalPrice: 15,
  currency: 'EUR',
  createdAt: '2020-01-01T08:00:00+00:00',
  cancellationReason: null,
  cancelledAt: null,
  cancelledByDisplayName: null,
  services: [{ serviceId: 'cut', name: 'Cut', categoryId: null, durationMinutes: 30, price: 15 }],
  durationOverridden: false,
  source: 'staff',
  createdByDisplayName: 'Maria K.',
  updatedAt: null,
  modifiedByDisplayName: null,
  customerHasAccount: true,
  customerNote: null,
  customerPreferredStaffMemberId: null,
  customerPreferredStaffDisplayName: null,
  customerPreferredStaffIsActive: null,
  customerNoShowCount: 0,
  customerBlock: null,
};

/** One row of the booking form's customer search. */
function customerRow(
  overrides: Partial<CustomerOptionODataResponse> = {},
): CustomerOptionODataResponse {
  return {
    id: CUSTOMER,
    displayName: 'Giorgos Papas',
    lastAppointmentDate: '2026-09-01',
    email: 'giorgos@example.com',
    phoneNumber: null,
    hasAccount: false,
    preferredStaffMemberId: 'maria',
    preferredStaffIsActive: true,
    isBlocked: false,
    hasNote: false,
    ...overrides,
  };
}

/** Two barbers who both perform the cut. */
const TWO_BARBERS: AppointmentCatalogResponse = {
  currency: 'EUR',
  slotIntervalMinutes: 15,
  serviceCategories: [],
  uncategorizedServices: [{ id: 'cut', name: 'Cut' }],
  staffMembers: [
    { id: 'nikos', offerings: [{ serviceId: 'cut', price: 15, durationMinutes: 30 }] },
    { id: 'maria', offerings: [{ serviceId: 'cut', price: 15, durationMinutes: 30 }] },
  ],
};

const CATALOG: AppointmentCatalogResponse = {
  currency: 'EUR',
  slotIntervalMinutes: 15,
  serviceCategories: [],
  uncategorizedServices: [{ id: 'cut', name: 'Cut' }],
  staffMembers: [
    {
      id: 'nikos',
      offerings: [{ serviceId: 'cut', price: 15, durationMinutes: 30 }],
    },
  ],
};

/** The panel's own state, which the specs drive where a real user would type. */
interface PanelInternals {
  readonly editor: FormEditor<AppointmentFormValue>;
  canLeave(): Promise<boolean>;
  prepareLeave(overPage: boolean): void;
  onLeave(event: { target: Element; animationComplete: () => void }): void;
}

describe('AppointmentDetails', () => {
  let fixture: ComponentFixture<AppointmentDetails>;

  beforeEach(() => {
    viewAll = null;
  });

  let http: HttpTestingController;
  let params: BehaviorSubject<ParamMap>;
  let granted: ReturnType<typeof signal<readonly string[]>>;
  let host: AppointmentPanelHost;
  /** The host's calls, kept apart so a spec reads them as plain mocks. */
  let calls: {
    open: Mock<AppointmentPanelHost['open']>;
    create: Mock<AppointmentPanelHost['create']>;
    close: Mock<AppointmentPanelHost['close']>;
    written: Mock<AppointmentPanelHost['written']>;
  };
  /** What the host answers for "View all". */
  let viewAll: UrlTree | null;
  let confirm: ReturnType<typeof vi.fn>;
  let toaster: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function internals(): PanelInternals {
    return fixture.componentInstance as unknown as PanelInternals;
  }

  function title(): string {
    return element().querySelector('.appointment-details-title')?.textContent.trim() ?? '';
  }

  function description(): string {
    return element().querySelector('.appointment-details-description')?.textContent.trim() ?? '';
  }

  function text(): string {
    return element().textContent.replace(/\s+/g, ' ');
  }

  function captions(): string[] {
    return [...element().querySelectorAll('.view-caption')].map((caption) =>
      caption.textContent.trim(),
    );
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element().querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent.trim() === label,
    );
  }

  /** An icon button, by its accessible name. */
  function iconButton(label: string): HTMLButtonElement | undefined {
    return [...element().querySelectorAll<HTMLButtonElement>('button[aria-label]')].find(
      (candidate) => candidate.getAttribute('aria-label') === label,
    );
  }

  function moreTrigger(): HTMLButtonElement | null {
    return element().querySelector<HTMLButtonElement>('button[aria-label="More actions"]');
  }

  /**
   * Not `whenStable`: a resource waiting on a request the spec has not flushed yet keeps the
   * fixture unstable, so a render and one task is the wait.
   */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** Answers the lookups the controls make on their own, which these specs do not assert. */
  function flushLookups(): void {
    for (const request of http.match((candidate) => candidate.url.includes('/customers/odata'))) {
      request.flush({ value: [] });
    }
    for (const request of http.match((candidate) => candidate.url.endsWith('/check'))) {
      request.flush({ warnings: [] });
    }
  }

  async function open(
    appointmentId: string,
    prefill: AppointmentPrefill = {},
    codes: readonly string[] = [
      'appointments:create',
      'appointments:update',
      'appointments:cancel',
    ],
  ): Promise<void> {
    params = new BehaviorSubject(convertToParamMap({ appointmentId }));
    granted = signal(codes);
    calls = {
      open: vi.fn<AppointmentPanelHost['open']>(),
      create: vi.fn<AppointmentPanelHost['create']>(),
      close: vi.fn<AppointmentPanelHost['close']>(),
      written: vi.fn<AppointmentPanelHost['written']>(),
    };
    host = {
      prefill: signal(prefill),
      staff: signal([
        { id: 'nikos', displayName: 'Nikos P.', isActive: true, swatch: 'var(--swatch-1)' },
      ]),
      timezone: signal('UTC'),
      selected: signal<string | null>(null),
      customerAppointments: () => viewAll,
      ...calls,
    };
    confirm = vi.fn(() => Promise.resolve('confirmed'));
    toaster = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'http://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: APPOINTMENT_PANEL_HOST, useValue: host },
        {
          provide: StaffAccessStore,
          useValue: { has: (code: string) => granted().includes(code) },
        },
        { provide: ConfirmationService, useValue: { open: confirm } },
        { provide: ToasterService, useValue: toaster },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementAppointments/en', { inlineLoader: appointmentsInlineLoader }),
    );
    // The copy button's own scope, so its first render does not wait for a load.
    transloco.setTranslation(
      { copy: 'Copy', copied: 'Copied', failed: 'The copy failed.' },
      'copyButton/en',
    );
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppointmentDetails);
    await settle();
  }

  async function flushAppointment(
    appointment: AppointmentDetailsResponse = APPOINTMENT,
  ): Promise<void> {
    http
      .expectOne((request) => request.url.startsWith(`${BOOK}/${appointment.id}?`))
      .flush(appointment);
    await settle();
  }

  async function flushHistory(rows: readonly object[]): Promise<void> {
    http
      .expectOne((request) => request.url.includes(`customerId%20eq%20${CUSTOMER}`))
      .flush({ value: rows });
    await settle();
  }

  function historyRow(id: string, localDate: string, status = 'completed'): object {
    return {
      id,
      localDate,
      localStartTime: '12:00',
      staffDisplayName: 'Nikos P.',
      status,
      services: [{ serviceId: 'cut', name: 'Cut', categoryId: null, durationMinutes: 30 }],
    };
  }

  async function flushCatalog(): Promise<void> {
    http.expectOne((request) => request.url.startsWith(`${BOOK}/booking-catalog`)).flush(CATALOG);
    await settle();
  }

  describe('a tile', () => {
    it('opens in view mode and marks the tile as selected', async () => {
      await open('a1');
      await flushAppointment();

      // The panel's own copy loads with a dynamic import, which a busy machine can delay.
      await vi.waitFor(
        () => {
          fixture.detectChanges();
          expect(title()).toBe('Appointment');
        },
        { timeout: 5000 },
      );
      expect(description()).toBe('Giorgos Papas • Fri, Jan 10, 2020');
      expect(text()).toContain('Nikos P.');
      expect(text()).toContain('Confirmed');
      expect(text()).toContain('Booked by Maria K.');
      expect(element().querySelector('form')).toBeNull();
      expect(host.selected?.()).toBe('a1');
      flushLookups();
    });

    it('draws the shape of the view while the appointment loads', async () => {
      await open('a1');

      expect(element().querySelector('lib-appointment-view-skeleton')).not.toBeNull();
      expect(element().querySelector('[role="status"]')?.textContent).toContain(
        'Loading the appointment',
      );

      await flushAppointment();

      expect(element().querySelector('lib-appointment-view-skeleton')).toBeNull();
      expect(description()).toBe('Giorgos Papas • Fri, Jan 10, 2020');
    });

    it('leaves out what is empty rather than showing it blank', async () => {
      await open('a1');
      await flushAppointment();
      http
        .expectOne((request) => request.url.includes(`customerId%20eq%20${CUSTOMER}`))
        .flush({ value: [] });
      await settle();

      expect(text()).not.toContain('Customer note');
      expect(text()).not.toContain('Internal note');
      expect(text()).not.toContain('Other appointments');
    });

    it('shows a note once there is one', async () => {
      await open('a1');
      await flushAppointment({ ...APPOINTMENT, internalNotes: 'VIP' });

      expect(text()).toContain('Internal note');
      expect(text()).toContain('VIP');
      expect(text()).not.toContain('Customer note');
    });

    it('keeps the open appointment on screen while the next one loads', async () => {
      await open('a1');
      await flushAppointment();

      params.next(convertToParamMap({ appointmentId: 'a2' }));
      await settle();

      // The toolbar pauses rather than disables, so no button flashes for the length of the load.
      const toolbar = (fixture.nativeElement as HTMLElement).querySelector('lib-drawer-actions');
      expect(description()).toContain('Giorgos Papas');
      expect(text()).not.toContain('Loading the appointment');
      expect(button('Edit')?.disabled).toBe(false);
      expect(toolbar?.hasAttribute('inert')).toBe(true);

      await flushAppointment({ ...APPOINTMENT, id: 'a2', customerDisplayName: 'Maria Ioannou' });

      expect(description()).toContain('Maria Ioannou');
      expect(toolbar?.hasAttribute('inert')).toBe(false);
    });

    it('lets go of the selection when the drawer closes', async () => {
      await open('a1');
      await flushAppointment();

      fixture.destroy();

      expect(host.selected?.()).toBeNull();
    });

    it('leaves the route at once from the ×, while the exit plays', async () => {
      await open('a1');
      await flushAppointment();
      const dialog = element().querySelector('dialog');

      element().querySelector<HTMLButtonElement>('.drawer-close')?.click();
      await settle();

      expect(calls.close).toHaveBeenCalledTimes(1);
      expect(dialog?.hasAttribute('data-closing')).toBe(true);
      flushLookups();
    });

    it('holds its element through the exit when its page stays', async () => {
      await open('a1');
      await flushAppointment();
      const dialog = element().querySelector('dialog');
      const complete = vi.fn();

      internals().prepareLeave(true);
      internals().onLeave({ target: element(), animationComplete: complete });
      expect(dialog?.hasAttribute('data-closing')).toBe(true);
      expect(complete).not.toHaveBeenCalled();

      await vi.waitFor(() => {
        expect(complete).toHaveBeenCalledTimes(1);
      });
      expect(dialog?.open).toBe(false);
      flushLookups();
    });

    // The page goes too, and an exit would only hold the next page back.
    it('lets its element go at once when its page goes too', async () => {
      await open('a1');
      await flushAppointment();
      const complete = vi.fn();

      internals().prepareLeave(false);
      internals().onLeave({ target: element(), animationComplete: complete });

      expect(complete).toHaveBeenCalledTimes(1);
      flushLookups();
    });

    it('links the phone and the email', async () => {
      await open('a1');
      await flushAppointment();

      const links = [...element().querySelectorAll('a')].map((link) => link.getAttribute('href'));
      expect(links).toContain('tel:+306900000000');
      expect(links).toContain('mailto:giorgos@example.com');
    });

    it('names one service without a total', async () => {
      await open('a1');
      await flushAppointment();

      expect(captions()).toContain('Service');
      expect(text()).not.toContain('Total');
      flushLookups();
    });

    it('totals several services', async () => {
      await open('a1');
      await flushAppointment({
        ...APPOINTMENT,
        services: [
          ...APPOINTMENT.services,
          { serviceId: 'beard', name: 'Beard', categoryId: null, durationMinutes: 15, price: 8 },
        ],
        totalPrice: 23,
      });
      expect(captions()).toContain('Services');
      expect(text()).toContain('Total');
      expect(text()).toContain('45 min');
      flushLookups();
    });

    it('copies the email and says so on the button', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await open('a1');
      await flushAppointment();

      const copy = element().querySelector<HTMLButtonElement>('[aria-label="Copy email"]');
      copy?.click();
      await settle();

      expect(writeText).toHaveBeenCalledWith('giorgos@example.com');
      expect(copy?.textContent.trim()).toBe('Copied');
      expect(element().querySelector('[aria-label="Copy phone number"]')).not.toBeNull();
      flushLookups();
    });

    it('splits the other appointments at now, the upcoming soonest first', async () => {
      await open('a1');
      await flushAppointment();
      await flushHistory([
        historyRow('far', '2999-03-01'),
        historyRow('near', '2999-02-01'),
        historyRow('old', '2020-01-01', 'cancelled'),
      ]);

      const groups = [...element().querySelectorAll('.history-group')].map((group) => ({
        title: group.querySelector('.history-group-title')?.textContent.trim(),
        rows: group.querySelectorAll('.history-row').length,
      }));
      expect(groups).toEqual([
        { title: 'Upcoming', rows: 2 },
        { title: 'Past', rows: 1 },
      ]);
      const first = element().querySelector('.history-when')?.textContent ?? '';
      expect(first).toContain('2999');
      expect(first).toContain('Feb');
    });

    it('leaves "View all" out when the page gives no address', async () => {
      await open('a1');
      await flushAppointment();
      await flushHistory([historyRow('old', '2020-01-01')]);

      expect(text()).not.toContain('View all');
    });

    it('links "View all" to the address the page gives', async () => {
      await open('a1');
      viewAll = TestBed.inject(Router).parseUrl('/management/customers');
      await flushAppointment();
      await flushHistory([historyRow('old', '2020-01-01')]);

      const link = [...element().querySelectorAll('a')].find((candidate) =>
        candidate.textContent.includes('View all'),
      );
      expect(link?.getAttribute('href')).toBe('/management/customers');
    });

    it('says so when the appointment does not exist', async () => {
      await open('a9');
      http
        .expectOne((request) => request.url.startsWith(`${BOOK}/a9?`))
        .flush(
          { title: 'APPOINTMENT_NOT_FOUND', status: 404 },
          { status: 404, statusText: 'Not Found' },
        );
      await settle();

      expect(text()).toContain('The appointment was not found.');
    });
  });

  describe('the actions', () => {
    it('offers what the status allows once the start has passed', async () => {
      await open('a1');
      await flushAppointment();

      expect(button('Edit')).toBeDefined();
      expect(button('Book again')).toBeDefined();
      expect(iconButton('Complete')).toBeDefined();
      expect(iconButton('No-show')).toBeDefined();
      expect(iconButton('Cancel appointment')).toBeDefined();
      expect(moreTrigger()).toBeNull();
    });

    // The toolbar's line holds Edit, Book again and one icon button beside the ⋮ trigger.
    it('puts Edit apart at the end, outlined, and leads the group with a filled Book again', async () => {
      await open('a1');
      await flushAppointment();

      const start = [...element().querySelectorAll<HTMLElement>('.drawer-actions-start button')];
      expect(
        start.map((item) => item.getAttribute('aria-label') ?? item.textContent.trim()),
      ).toEqual(['Book again', 'Complete', 'No-show', 'Cancel appointment']);
      expect(start[0]?.getAttribute('data-variant')).toBe('filled');
      expect(start.slice(1).every((item) => item.hasAttribute('data-icon-only'))).toBe(true);

      const edit = element().querySelector<HTMLElement>('.drawer-actions-end button');
      expect(edit?.textContent.trim()).toBe('Edit');
      expect(edit?.getAttribute('data-variant')).toBe('outlined');
    });

    it('puts Cancel and Save in place of Edit, and nothing else, while editing', async () => {
      await open('a1');
      await flushAppointment();
      button('Edit')?.click();
      await settle();
      flushLookups();
      await settle();

      expect(element().querySelectorAll('.drawer-actions-start button')).toHaveLength(0);
      const end = [...element().querySelectorAll<HTMLElement>('.drawer-actions-end button')];
      expect(end.map((item) => item.textContent.trim())).toEqual(['Cancel', 'Save']);
    });

    it('holds Complete and No-show back before the start', async () => {
      await open('a1');
      await flushAppointment({ ...APPOINTMENT, localDate: '2999-01-10' });

      expect(iconButton('Complete')).toBeUndefined();
      expect(iconButton('No-show')).toBeUndefined();
      expect(iconButton('Cancel appointment')).toBeDefined();
    });

    it('offers only Restore and Book again on a no-show', async () => {
      await open('a1');
      await flushAppointment({ ...APPOINTMENT, status: 'no_show' });

      expect(iconButton('Complete')).toBeUndefined();
      expect(button('Book again')).toBeDefined();
      expect(iconButton('Restore to confirmed')).toBeDefined();
      expect(moreTrigger()).toBeNull();
    });

    it('restores from its icon button', async () => {
      await open('a1');
      await flushAppointment({ ...APPOINTMENT, status: 'no_show' });

      iconButton('Restore to confirmed')?.click();
      const request = http.expectOne(`${BOOK}/a1/status?languageCode=en`);
      expect(request.request.body).toEqual({ status: 'confirmed' });
      request.flush({ ...APPOINTMENT, status: 'confirmed' });
      await settle();

      expect(toaster.success).toHaveBeenCalledWith('The appointment is confirmed again.');
    });

    it('hides what the user has no code for', async () => {
      await open('a1', {}, []);
      await flushAppointment();

      expect(button('Edit')).toBeUndefined();
      expect(iconButton('Complete')).toBeUndefined();
      expect(iconButton('Cancel appointment')).toBeUndefined();
      expect(moreTrigger()).toBeNull();
      expect(button('Book again')).toBeUndefined();
    });

    it('completes, shows the answer and tells the page', async () => {
      await open('a1');
      await flushAppointment();

      iconButton('Complete')?.click();
      const request = http.expectOne(`${BOOK}/a1/status?languageCode=en`);
      expect(request.request.body).toEqual({ status: 'completed' });
      request.flush({ ...APPOINTMENT, status: 'completed' });
      await settle();

      expect(text()).toContain('Completed');
      expect(calls.written).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
        false,
      );
      expect(toaster.success).toHaveBeenCalledWith('The appointment was completed.');
    });

    it('starts "Book again" from the open appointment', async () => {
      await open('a1');
      await flushAppointment();

      button('Book again')?.click();

      expect(calls.create).toHaveBeenCalledWith({ rebookId: 'a1' });
    });
  });

  describe('an edit', () => {
    it('opens the form from Edit and goes back to view on Cancel without asking', async () => {
      await open('a1');
      await flushAppointment();

      button('Edit')?.click();
      await settle();
      await flushCatalog();
      flushLookups();

      expect(element().querySelector('form')).not.toBeNull();
      expect(text()).toContain('Edit appointment');
      expect(button('Save')).toBeDefined();

      button('Cancel')?.click();
      await settle();

      expect(confirm).not.toHaveBeenCalled();
      expect(element().querySelector('form')).toBeNull();
    });

    it('asks before changes are dropped, and keeps them when the user says so', async () => {
      await open('a1');
      await flushAppointment();
      button('Edit')?.click();
      await settle();
      await flushCatalog();
      flushLookups();

      internals().editor.form.internalNotes().value.set('VIP');
      internals().editor.form.internalNotes().markAsDirty();
      confirm.mockResolvedValueOnce('cancelled');

      expect(await internals().canLeave()).toBe(false);
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard changes?' }));
      expect(internals().editor.form.internalNotes().value()).toBe('VIP');

      expect(await internals().canLeave()).toBe(true);
      expect(internals().editor.form().dirty()).toBe(false);
    });

    it('patches only what changed and lands back in view', async () => {
      await open('a1');
      await flushAppointment();
      button('Edit')?.click();
      await settle();
      await flushCatalog();
      flushLookups();

      internals().editor.form.internalNotes().value.set('Paid cash');
      button('Save')?.click();
      await settle();
      const request = http.expectOne(`${BOOK}/a1?languageCode=en`);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ internalNotes: 'Paid cash', notifyCustomer: false });
      request.flush({ ...APPOINTMENT, internalNotes: 'Paid cash' });
      await settle();
      flushLookups();

      expect(element().querySelector('form')).toBeNull();
      expect(text()).toContain('Paid cash');
      expect(calls.written).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), false);
    });
  });

  describe("the shop's facts about the customer", () => {
    it('shows the block, the no-shows, the preferred barber and the shop note to any reader', async () => {
      await open('a1', {}, []);
      await flushAppointment({
        ...APPOINTMENT,
        customerBlock: {
          reason: 'Repeated no-shows',
          blockedAt: '2026-09-01T10:00:00Z',
          blockedByDisplayName: 'Maria K.',
        },
        customerNoShowCount: 2,
        customerPreferredStaffMemberId: 'maria',
        customerPreferredStaffDisplayName: 'Maria K.',
        customerPreferredStaffIsActive: false,
        customerNote: 'Short on the sides',
      });

      expect(text()).toContain('Blocked from online booking. Reason: Repeated no-shows');
      expect(text()).toContain('No-shows: 2 times');
      expect(element().querySelector('.view-no-shows')?.getAttribute('data-tone')).toBe('warning');
      expect(text()).toContain('Preferred barber: Maria K. · Inactive');
      expect(text()).toContain('Shop note');
      expect(text()).toContain('Short on the sides');
    });

    it("leaves out a preferred barber who is this appointment's barber", async () => {
      await open('a1');
      await flushAppointment({
        ...APPOINTMENT,
        customerPreferredStaffMemberId: 'nikos',
        customerPreferredStaffDisplayName: 'Nikos P.',
        customerPreferredStaffIsActive: true,
      });

      expect(text()).not.toContain('Preferred barber');
    });
  });

  describe('a create for a known customer', () => {
    /** Answers the read of the prefilled customer's row, then the other lookups. */
    async function flushCustomer(row: CustomerOptionODataResponse): Promise<void> {
      for (const request of http.match((candidate) =>
        candidate.urlWithParams.includes('$filter=id eq'),
      )) {
        request.flush({ value: [row] });
      }
      await settle();
      flushLookups();
      await settle();
    }

    async function flushTwoBarbers(): Promise<void> {
      http
        .expectOne((request) => request.url.startsWith(`${BOOK}/booking-catalog`))
        .flush(TWO_BARBERS);
      await settle();
    }

    it('preselects the preferred barber into an empty barber field', async () => {
      await open('new', { localDate: '2026-09-24', customerId: CUSTOMER });
      await flushTwoBarbers();
      await flushCustomer(customerRow());

      expect(internals().editor.form.customerId().value()).toBe(CUSTOMER);
      expect(internals().editor.form.staffMemberId().value()).toBe('maria');
    });

    it('keeps a barber the calendar slot chose', async () => {
      await open('new', { localDate: '2026-09-24', staffMemberId: 'nikos', customerId: CUSTOMER });
      await flushTwoBarbers();
      await flushCustomer(customerRow());

      expect(internals().editor.form.staffMemberId().value()).toBe('nikos');
    });

    it('never preselects a preferred barber who has left', async () => {
      await open('new', { localDate: '2026-09-24', customerId: CUSTOMER });
      await flushTwoBarbers();
      await flushCustomer(customerRow({ preferredStaffIsActive: false }));

      expect(internals().editor.form.staffMemberId().value()).toBe('');
    });

    it('never preselects a barber who does not offer a service already chosen', async () => {
      await open('new', { localDate: '2026-09-24', customerId: CUSTOMER });
      http
        .expectOne((request) => request.url.startsWith(`${BOOK}/booking-catalog`))
        .flush({
          ...TWO_BARBERS,
          uncategorizedServices: [
            { id: 'cut', name: 'Cut' },
            { id: 'beard', name: 'Beard' },
          ],
          staffMembers: [
            ...TWO_BARBERS.staffMembers.slice(0, 1).map((member) => ({
              ...member,
              offerings: [
                ...member.offerings,
                { serviceId: 'beard', price: 10, durationMinutes: 15 },
              ],
            })),
            TWO_BARBERS.staffMembers[1],
          ],
        });
      await settle();
      internals().editor.form.serviceIds().value.set(['beard']);
      await settle();
      await flushCustomer(customerRow());

      expect(internals().editor.form.staffMemberId().value()).toBe('');
    });

    it('warns about a block and points to the shop note, and still saves', async () => {
      await open('new', { localDate: '2026-09-24', customerId: CUSTOMER });
      await flushTwoBarbers();
      await flushCustomer(customerRow({ isBlocked: true, hasNote: true }));

      expect(text()).toContain('This customer is blocked from online booking.');
      expect(text()).toContain('The shop keeps a note on this customer.');
    });
  });

  describe('a new walk-in by email', () => {
    async function typeEmail(email: string): Promise<void> {
      internals().editor.form.customerMode().value.set('new');
      internals().editor.form.newCustomer.email().value.set(email);
      await settle();
      // The lookups wait for typing to stop.
      await new Promise((resolve) => setTimeout(resolve, 550));
      await settle();
    }

    it('says the email belongs to an account, and never whose', async () => {
      await open('new', { localDate: '2026-09-24' });
      await flushCatalog();
      await typeEmail('person@example.com');
      flushLookups();
      const lookup = http.expectOne(`${BOOK}/customers/account-lookup`);
      expect(lookup.request.body).toEqual({ email: 'person@example.com' });
      lookup.flush({ hasAccount: true });
      await settle();

      expect(text()).toContain('This email belongs to a registered account.');
    });

    it('hides the hint on the rate limit, and the save stays possible', async () => {
      await open('new', { localDate: '2026-09-24' });
      await flushCatalog();
      await typeEmail('person@example.com');
      flushLookups();
      http
        .expectOne(`${BOOK}/customers/account-lookup`)
        .flush(
          { status: 429, title: 'CUSTOMER_LOOKUP_RATE_LIMITED', errors: [] },
          { status: 429, statusText: 'Too Many Requests' },
        );
      await settle();

      expect(text()).not.toContain('registered account');
    });

    it('yields to the hint about a customer of the shop', async () => {
      await open('new', { localDate: '2026-09-24' });
      await flushCatalog();
      await typeEmail('giorgos@example.com');
      for (const request of http.match((candidate) => candidate.url.includes('/customers/odata'))) {
        request.flush({ value: [customerRow()] });
      }
      http.expectOne(`${BOOK}/customers/account-lookup`).flush({ hasAccount: true });
      await settle();

      expect(text()).toContain('This email already belongs to a customer: Giorgos Papas.');
      expect(text()).not.toContain('registered account');
    });
  });

  describe('a create', () => {
    it('starts from the prefill', async () => {
      await open('new', {
        localDate: '2026-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
      await flushCatalog();
      flushLookups();

      expect(text()).toContain('New appointment');
      // The catalog carries no names: the barber is named from the page's roster.
      expect(text()).toContain('Nikos P.');
      expect(host.selected?.()).toBeNull();
      expect(internals().editor.form().value()).toMatchObject({
        localDate: '2026-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
    });

    it('drops a prefilled barber the catalog does not hold', async () => {
      await open('new', { localDate: '2026-09-24', staffMemberId: 'gone' });
      await flushCatalog();
      flushLookups();

      expect(internals().editor.form.staffMemberId().value()).toBe('');
    });

    it('refuses a save with nothing chosen, without asking the server', async () => {
      await open('new', { localDate: '2026-09-24' });
      await flushCatalog();
      flushLookups();

      button('Save')?.click();
      await settle();

      http.expectNone((request) => request.method === 'POST' && request.url.startsWith(`${BOOK}?`));
      expect(text()).toContain('Pick a customer.');
      expect(text()).toContain('Pick at least one service.');
      flushLookups();
    });

    it('books, then hands the page what it made', async () => {
      await open('new', {
        localDate: '2026-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
      await flushCatalog();
      flushLookups();

      internals().editor.form.customerId().value.set('c1');
      internals().editor.form.serviceIds().value.set(['cut']);
      await settle();
      flushLookups();
      expect(internals().editor.form.localEndTime().value()).toBe('10:30');

      button('Save')?.click();
      await settle();
      const request = http.expectOne(`${BOOK}?languageCode=en`);
      expect(request.request.body).toMatchObject({
        customerId: 'c1',
        newCustomer: null,
        staffMemberId: 'nikos',
        serviceIds: ['cut'],
        localDate: '2026-09-24',
        localStartTime: '10:00',
        localEndTime: null,
      });
      request.flush({ ...APPOINTMENT, localDate: '2026-09-24' });
      await settle();
      flushLookups();

      expect(calls.written).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), true);
      expect(toaster.success).toHaveBeenCalledWith('The appointment was created.');
      expect(internals().editor.form().dirty()).toBe(false);
    });

    it('shows the drawer’s copy for a field the API refuses by validation', async () => {
      await open('new', {
        localDate: '2026-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
      await flushCatalog();
      flushLookups();
      internals().editor.form.customerId().value.set('c1');
      internals().editor.form.serviceIds().value.set(['cut']);
      await settle();
      flushLookups();

      button('Save')?.click();
      await settle();
      http.expectOne(`${BOOK}?languageCode=en`).flush(
        {
          title: 'VALIDATION_FAILED',
          status: 400,
          errors: [
            {
              code: 'APPOINTMENT_INVALID_START',
              description: 'LocalStartTime is not a valid time.',
              propertyName: 'localStartTime',
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();
      flushLookups();

      expect(text()).toContain('This time does not exist on that day.');
      expect(text()).not.toContain('LocalStartTime is not a valid time.');
    });

    it('puts a refusal on the field it names', async () => {
      await open('new', {
        localDate: '2026-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
      await flushCatalog();
      flushLookups();
      internals().editor.form.customerId().value.set('c1');
      internals().editor.form.serviceIds().value.set(['cut']);
      await settle();
      flushLookups();

      button('Save')?.click();
      await settle();
      http
        .expectOne(`${BOOK}?languageCode=en`)
        .flush(
          { title: 'APPOINTMENT_SLOT_TAKEN', status: 409 },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();
      flushLookups();

      expect(text()).toContain('The barber already has an appointment at this time.');
      expect(calls.written).not.toHaveBeenCalled();
    });
  });

  describe('the free-time grid', () => {
    /** Past the grid's and the check's debounce, then a render. */
    async function waitDebounce(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await settle();
    }

    function flushSlots(times: readonly (readonly [string, readonly string[]])[]): void {
      http
        .expectOne((request) => request.url.startsWith(`${BOOK}/slots?`))
        .flush({
          date: '2099-09-24',
          timezone: 'UTC',
          slots: times.map(([time, staffMemberIds]) => ({
            time,
            startsAtUtc: `2099-09-24T${time}:00Z`,
            staffMemberIds,
          })),
        });
    }

    function tiles(): string[] {
      return [...element().querySelectorAll('.time-tile')].map((tile) => tile.textContent.trim());
    }

    it('says a past day has no free times because it has passed', async () => {
      await open('new', { localDate: '2020-01-10' });
      await flushCatalog();
      flushLookups();
      await waitDebounce();
      http
        .expectOne((request) => request.url.startsWith(`${BOOK}/slots?`))
        .flush({
          date: '2020-01-10',
          timezone: 'UTC',
          slots: [],
        });
      await settle();

      expect(text()).toContain(
        'This day belongs in the past. To book anyway, set the time manually.',
      );
      expect(text()).not.toContain('No free time on this day.');
    });

    it('unchecks and locks the email to the customer on a past day, and sends none', async () => {
      await open('new', {
        localDate: '2099-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
      await flushCatalog();
      flushLookups();
      const form = internals().editor.form;
      form.customerMode().value.set('new');
      form.newCustomer.firstName().value.set('Eleni');
      form.newCustomer.email().value.set('eleni@example.com');
      form.serviceIds().value.set(['cut']);
      await settle();
      const notify = (): HTMLInputElement | null =>
        element().querySelector<HTMLInputElement>('.appointment-form-notify input');
      expect(notify()?.checked).toBe(true);

      form.localDate().value.set('2020-01-10');
      await settle();
      expect(notify()?.checked).toBe(false);
      expect(notify()?.disabled).toBe(true);
      expect(text()).toContain(
        'The customer will not be notified, because the selected date belongs in the past',
      );

      form.manualTime().value.set(true);
      await settle();
      flushLookups();
      button('Save')?.click();
      await settle();
      const request = http.expectOne(`${BOOK}?languageCode=en`);
      expect(request.request.body).toMatchObject({ notifyCustomer: false });
      request.flush({ ...APPOINTMENT, localDate: '2020-01-10' });
      await settle();
      for (const pending of http.match(() => true)) pending.flush({});
    });

    it('gives the email choice back on a later day', async () => {
      await open('new', { localDate: '2099-09-24' });
      await flushCatalog();
      flushLookups();
      const form = internals().editor.form;
      form.customerMode().value.set('new');
      form.newCustomer.email().value.set('eleni@example.com');
      form.localDate().value.set('2020-01-10');
      await settle();
      expect(form.notifyCustomer().value()).toBe(false);

      form.localDate().value.set('2099-09-25');
      await settle();

      expect(form.notifyCustomer().value()).toBe(true);
      expect(form.notifyCustomer().disabled()).toBe(false);
    });

    it('offers the chosen barber’s free times, without the end picker', async () => {
      await open('new', { localDate: '2099-09-24', staffMemberId: 'nikos' });
      await flushCatalog();
      flushLookups();
      await waitDebounce();

      const request = http.expectOne((candidate) => candidate.url.startsWith(`${BOOK}/slots?`));
      // Every barber is asked for: the form narrows to the chosen one.
      expect(request.request.url).toBe(`${BOOK}/slots?localDate=2099-09-24&serviceIds=`);
      request.flush({
        date: '2099-09-24',
        timezone: 'UTC',
        slots: [
          { time: '09:00', startsAtUtc: '2099-09-24T09:00:00Z', staffMemberIds: ['nikos'] },
          { time: '09:15', startsAtUtc: '2099-09-24T09:15:00Z', staffMemberIds: ['maria'] },
        ],
      });
      await settle();

      expect(tiles()).toEqual(['09:00']);
      expect(text()).toContain('Set the time manually');
      expect(text()).not.toContain('End');
    });

    it('asks again for the services and the customer picked', async () => {
      await open('new', { localDate: '2099-09-24' });
      await flushCatalog();
      flushLookups();
      await waitDebounce();
      flushSlots([]);
      await settle();
      expect(text()).toContain('No free time on this day.');

      internals().editor.form.customerId().value.set('c1');
      internals().editor.form.serviceIds().value.set(['cut']);
      await waitDebounce();

      http
        .expectOne(`${BOOK}/slots?localDate=2099-09-24&serviceIds=cut&customerId=c1`)
        .flush({ date: '2099-09-24', timezone: 'UTC', slots: [] });
    });

    it('keeps a calendar time that is free, in the grid', async () => {
      await open('new', { localDate: '2099-09-24', localStartTime: '10:00' });
      await flushCatalog();
      flushLookups();
      await waitDebounce();
      flushSlots([['10:00', ['nikos']]]);
      await settle();

      expect(internals().editor.form.manualTime().value()).toBe(false);
      expect(element().querySelector('.time-tile[aria-selected="true"]')?.textContent.trim()).toBe(
        '10:00',
      );
    });

    it('opens the pickers for a calendar time that is not free', async () => {
      await open('new', { localDate: '2099-09-24', localStartTime: '10:00' });
      await flushCatalog();
      flushLookups();
      await waitDebounce();
      flushSlots([['09:00', ['nikos']]]);
      await settle();

      expect(internals().editor.form.manualTime().value()).toBe(true);
      expect(internals().editor.form.localStartTime().value()).toBe('10:00');
      expect(text()).toContain('End');
    });

    it('keeps a picked time that a later change made busy', async () => {
      await open('new', { localDate: '2099-09-24', staffMemberId: 'nikos' });
      await flushCatalog();
      flushLookups();
      await waitDebounce();
      flushSlots([
        ['09:00', ['nikos']],
        ['09:15', ['nikos']],
      ]);
      await settle();
      internals().editor.form.localStartTime().value.set('09:15');
      internals().editor.form.serviceIds().value.set(['cut']);
      await waitDebounce();
      flushSlots([['09:00', ['nikos']]]);
      await settle();

      expect(internals().editor.form.localStartTime().value()).toBe('09:15');
      expect(tiles()).toEqual(['09:00', '09:15']);
      flushLookups();
    });

    it('names the appointment a warning collides with', async () => {
      await open('new', {
        localDate: '2099-09-24',
        localStartTime: '10:00',
        staffMemberId: 'nikos',
      });
      await flushCatalog();
      flushLookups();
      internals().editor.form.serviceIds().value.set(['cut']);
      await waitDebounce();
      flushSlots([['10:00', ['nikos']]]);
      http.expectOne(`${BOOK}/check`).flush({
        warnings: [
          {
            code: 'SLOT_TAKEN',
            appointment: {
              id: 'a9',
              customerDisplayName: 'Eleni K',
              staffDisplayName: 'Nikos P.',
              localStartTime: '10:15',
              localEndTime: '10:45',
            },
          },
        ],
      });
      await settle();

      expect(text()).toContain('The barber already has an appointment at this time.');
      expect(text()).toContain('Eleni K, 10:15–10:45');
    });

    it('checks a typed start and end without services', async () => {
      await open('new', { localDate: '2099-09-24', staffMemberId: 'nikos' });
      await flushCatalog();
      flushLookups();
      const form = internals().editor.form;
      form.manualTime().value.set(true);
      form.localStartTime().value.set('10:00');
      form.localEndTime().value.set('10:20');
      form.endOverridden().value.set(true);
      await waitDebounce();

      const request = http.expectOne(`${BOOK}/check`);
      expect(request.request.body).toMatchObject({
        serviceIds: [],
        localStartTime: '10:00',
        localEndTime: '10:20',
      });
      request.flush({ warnings: [] });
      // Sent before the switch to the pickers. The pickers ask for no free times.
      for (const slots of http.match((candidate) => candidate.url.startsWith(`${BOOK}/slots?`))) {
        slots.flush({ date: '2099-09-24', timezone: 'UTC', slots: [] });
      }
      await waitDebounce();
      http.expectNone((candidate) => candidate.url.startsWith(`${BOOK}/slots?`));
    });
  });
});

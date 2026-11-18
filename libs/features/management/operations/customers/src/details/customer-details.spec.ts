import { Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, type ParamMap } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { CustomerResponse } from '@api/customers';
import { StaffAccessStore } from '@auth/data-access';
import { appointmentsInlineLoader } from '@features/management-shared-appointments';
import { provideSynaxApi } from '@synax/client';
import { ConfirmationService } from '@ui/confirmation-dialog';
import type { DrawerAction } from '@ui/drawer';
import type { SelectOption } from '@ui/select';
import { ToasterService } from '@ui/toaster';
import type { FormEditor } from '@util/forms';
import { BehaviorSubject, firstValueFrom, of, type Observable } from 'rxjs';
import type { Mock } from 'vitest';

import { customersInlineLoader } from '../customers.i18n';
import { CustomersStore } from '../customers.store';
import { CustomerDetails } from './customer-details';
import type { CustomerFormValue } from './customer-details.form.types';

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

const API = 'http://api.test/api/v1/customers';

const STAFF = [
  { id: 'maria', displayName: 'Maria K.', isActive: true },
  { id: 'nikos', displayName: 'Nikos P.', isActive: true },
  { id: 'kostas', displayName: 'Kostas L.', isActive: false },
];

const WALK_IN: CustomerResponse = {
  id: 'c1',
  displayName: 'Giorgos P.',
  firstName: 'Giorgos',
  lastName: 'Papas',
  phoneNumber: '+306912345678',
  email: 'g@example.com',
  isWalkIn: true,
  visitCount: 3,
  firstVisitDate: '2026-01-10',
  lastVisitDate: '2026-09-01',
  daysSinceLastVisit: 36,
  nextAppointmentAt: null,
  upcomingCount: 0,
  noShowCount: 2,
  lastNoShowDate: '2026-05-02',
  cancellationCount: 0,
  preferredStaffMemberId: 'kostas',
  preferredStaffDisplayName: 'Kostas L.',
  preferredStaffIsActive: false,
  customerSince: '2026-01-10',
  totalSpend: null,
  averageSpend: null,
  note: { text: 'Short on the sides', updatedAt: null, updatedByDisplayName: null },
  block: null,
  canEditContactDetails: true,
  canMerge: true,
};

const ACCOUNT_HOLDER: CustomerResponse = {
  ...WALK_IN,
  id: 'c2',
  isWalkIn: false,
  canEditContactDetails: false,
  canMerge: false,
};

const ALL_RIGHTS = ['customers:read', 'customers:update', 'appointments:create'];

const BLOCK_RIGHTS = [...ALL_RIGHTS, 'customers:block'];

/** The panel's own state, which the specs drive where a real user would type. */
interface PanelInternals {
  readonly editor: FormEditor<CustomerFormValue>;
  canLeave(): Promise<boolean>;
  toolbarActions(): readonly DrawerAction[];
  barberOptions(): readonly SelectOption<string>[];
}

describe('CustomerDetails', () => {
  let fixture: ComponentFixture<CustomerDetails>;
  let http: HttpTestingController;
  let navigate: Mock<Router['navigate']>;
  let confirm: ReturnType<typeof vi.fn>;
  let toaster: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  /** What the confirmation dialog answers. */
  let confirmAnswer: 'confirmed' | 'cancelled';

  beforeEach(() => {
    confirmAnswer = 'confirmed';
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function internals(): PanelInternals {
    return fixture.componentInstance as unknown as PanelInternals;
  }

  function editor(): FormEditor<CustomerFormValue> {
    return internals().editor;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element().querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent.trim() === label,
    );
  }

  /** A render and a task: a resource waiting on an unflushed request keeps the fixture unstable. */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function open(
    customer: CustomerResponse | null,
    codes: readonly string[] = ALL_RIGHTS,
  ): Promise<void> {
    const customerId = customer?.id ?? 'gone';
    const params = new BehaviorSubject<ParamMap>(convertToParamMap({ customerId }));
    const granted = signal(codes);
    confirm = vi.fn(() => Promise.resolve(confirmAnswer));
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
        CustomersStore,
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        {
          provide: StaffAccessStore,
          useValue: {
            has: (code: string) => granted().includes(code),
            company: signal({ id: 'shop', name: 'Shop', timezone: 'Europe/Athens' }),
            staff: signal(STAFF),
          },
        },
        { provide: ConfirmationService, useValue: { open: confirm } },
        { provide: ToasterService, useValue: toaster },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementCustomers/en', { inlineLoader: customersInlineLoader }),
    );
    // The drawer provides the appointment list's scope too, and the pipes wait for both.
    await firstValueFrom(
      transloco.load('managementAppointments/en', { inlineLoader: appointmentsInlineLoader }),
    );
    navigate = vi.fn<Router['navigate']>(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CustomerDetails);
    await settle();

    const request = http.expectOne(`${API}/${customerId}`);
    if (customer === null) {
      request.flush(
        { status: 404, title: 'CUSTOMER_NOT_FOUND', errors: [] },
        { status: 404, statusText: 'Not Found' },
      );
    } else {
      request.flush(customer);
    }
    await settle();
  }

  async function startEdit(): Promise<void> {
    button('Edit')?.click();
    await settle();
  }

  describe('the view', () => {
    it('shows the shop note and the preferred barber marked inactive', async () => {
      await open(WALK_IN);

      // The badge copy loads with a dynamic import, which a busy machine can delay.
      await vi.waitFor(
        () => {
          fixture.detectChanges();
          expect(element().textContent).toContain('Inactive');
        },
        { timeout: 5000 },
      );
      const text = element().textContent;
      expect(text).toContain('Short on the sides');
      expect(text).toContain('Kostas L.');
    });

    it('leaves out the note and the barber when the customer has neither', async () => {
      await open({
        ...WALK_IN,
        note: null,
        preferredStaffMemberId: null,
        preferredStaffDisplayName: null,
        preferredStaffIsActive: null,
      });

      expect(element().textContent).not.toContain('Shop note');
      expect(element().textContent).not.toContain('Preferred barber');
    });

    it('offers each action only with its right', async () => {
      // The API answers `canMerge: false` to a caller without `customers:merge`.
      await open({ ...WALK_IN, canMerge: false }, ['customers:read']);

      expect(button('Edit')).toBeUndefined();
      expect(internals().toolbarActions()).toEqual([]);
    });

    it('offers a new appointment for the customer', async () => {
      await open(WALK_IN);

      const action = internals()
        .toolbarActions()
        .find((entry) => entry.id === 'newAppointment');
      action?.run?.();

      expect(navigate).toHaveBeenCalledWith(
        ['appointments', 'new'],
        expect.objectContaining({ queryParams: { customerId: 'c1' } }),
      );
    });

    it('links every appointment of the customer, so it can open in a new tab', async () => {
      await open(WALK_IN, [...ALL_RIGHTS, 'appointments:read_all']);

      const action = internals()
        .toolbarActions()
        .find((entry) => entry.id === 'allAppointments');
      expect(action?.run).toBeUndefined();
      expect(action?.link?.toString()).toContain('customer=c1');
    });
  });

  describe('an edit', () => {
    it('sends only the members that changed', async () => {
      await open(WALK_IN);
      await startEdit();
      editor().form.note().value.set('');

      void editor().commit();
      await settle();

      const request = http.expectOne(`${API}/c1`);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ note: '' });
      request.flush({ ...WALK_IN, note: null });
      await settle();

      expect(editor().mode()).toBe('view');
      expect(toaster.success).toHaveBeenCalled();
    });

    it("shows an account holder's contact details read-only and keeps the note editable", async () => {
      await open(ACCOUNT_HOLDER);
      await startEdit();

      expect(element().querySelector('input[type="text"]')).toBeNull();
      expect(element().querySelector('input[type="email"]')).toBeNull();
      expect(element().querySelector('textarea')).not.toBeNull();
      expect(element().textContent).toContain('Giorgos');
    });

    it('offers active barbers and keeps an inactive current one, not to choose again', async () => {
      await open(WALK_IN);
      await startEdit();

      const options = internals().barberOptions();
      expect(options.map((option) => option.value)).toEqual(['', 'maria', 'nikos', 'kostas']);
      expect(options.find((option) => option.value === 'kostas')?.disabled).toBe(true);
    });

    it('puts an email that belongs to an account on the email', async () => {
      await open(WALK_IN);
      await startEdit();
      editor().form.email().value.set('taken@example.com');

      void editor().commit();
      await settle();
      http
        .expectOne(`${API}/c1`)
        .flush(
          { status: 409, title: 'CUSTOMER_EMAIL_USED_BY_ACCOUNT', errors: [] },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      expect(editor().form.email().errors().length).toBe(1);
      expect(editor().mode()).toBe('edit');
    });

    it('asks before a navigation drops a change', async () => {
      await open(WALK_IN);
      await startEdit();
      // Typing marks the field dirty. A programmatic write does not, so the spec does it.
      editor().form.note().value.set('Changed');
      editor().form.note().markAsDirty();

      await internals().canLeave();

      expect(confirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('block', () => {
    function blockButton(): HTMLButtonElement | undefined {
      return [...element().querySelectorAll<HTMLButtonElement>('lib-block-customer-dialog button')]
        .filter((candidate) => candidate.textContent.trim() === 'Block')
        .at(-1);
    }

    it('requires a reason, and says how many upcoming appointments stay, before and after', async () => {
      await open({ ...WALK_IN, upcomingCount: 2 }, BLOCK_RIGHTS);
      internals()
        .toolbarActions()
        .find((action) => action.id === 'block')
        ?.run?.();
      await settle();

      expect(element().textContent).toContain('The customer has 2 upcoming appointments.');
      blockButton()?.click();
      await settle();
      http.expectNone(`${API}/c1/block`);

      const reason = element().querySelector<HTMLTextAreaElement>(
        'lib-block-customer-dialog textarea',
      );
      if (reason === null) throw new Error('reason not rendered');
      reason.value = 'No-shows';
      reason.dispatchEvent(new Event('input'));
      blockButton()?.click();
      await settle();

      const request = http.expectOne(`${API}/c1/block`);
      expect(request.request.body).toEqual({ reason: 'No-shows' });
      request.flush({
        ...WALK_IN,
        upcomingCount: 3,
        block: { reason: 'No-shows', blockedAt: '2026-10-07T10:00:00Z', blockedByDisplayName: 'M' },
      });
      await settle();

      expect(toaster.success).toHaveBeenCalledWith(expect.stringContaining('3 upcoming'));
      expect(element().textContent).toContain('Reason: No-shows');
    });

    it('asks before an unblock', async () => {
      confirmAnswer = 'cancelled';
      await open(
        {
          ...WALK_IN,
          block: { reason: 'R', blockedAt: '2026-10-07T10:00:00Z', blockedByDisplayName: 'M' },
        },
        BLOCK_RIGHTS,
      );

      const action = internals()
        .toolbarActions()
        .find((entry) => entry.id === 'block');
      expect(action?.severity).toBe('secondary');
      action?.run?.();
      await settle();

      expect(confirm).toHaveBeenCalledTimes(1);
      http.expectNone(`${API}/c1/unblock`);
    });
  });

  describe('merge', () => {
    it('is offered only when the API says the customer can merge', async () => {
      await open(ACCOUNT_HOLDER);

      expect(
        internals()
          .toolbarActions()
          .some((action) => action.id === 'merge'),
      ).toBe(false);
    });

    it('opens on the walk-in that already holds the email, and keeps the open one', async () => {
      await open({ ...WALK_IN, preferredStaffMemberId: null, preferredStaffDisplayName: null });
      await startEdit();
      editor().form.email().value.set('taken@example.com');

      void editor().commit();
      await settle();
      http
        .expectOne(`${API}/c1`)
        .flush(
          { status: 409, title: 'CUSTOMER_EMAIL_USED_BY_WALK_IN', customerId: 'w2', errors: [] },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      button('Merge')?.click();
      await settle();
      http.expectOne(`${API}/w2`).flush({
        ...WALK_IN,
        id: 'w2',
        displayName: 'Other G.',
        email: 'taken@example.com',
        lastVisitDate: '2026-10-01',
        note: null,
      });
      await settle();

      const confirmMerge = [
        ...element().querySelectorAll<HTMLButtonElement>('lib-merge-customers-dialog button'),
      ].find((candidate) => candidate.textContent.trim() === 'Merge');
      confirmMerge?.click();
      await settle();

      const request = http.expectOne(`${API}/merge`);
      expect(request.request.body).toEqual({
        keptCustomerId: 'c1',
        removedCustomerId: 'w2',
        nameFrom: 'Removed',
        phoneFrom: 'Removed',
        emailFrom: 'Removed',
        // The other record is newer, and the open one has no preferred barber to keep.
        preferredStaffFrom: 'Removed',
      });
      request.flush({ ...WALK_IN, email: 'taken@example.com' });
      await settle();

      expect(toaster.success).toHaveBeenCalledWith('The customers were merged.');
      expect(element().textContent).toContain('taken@example.com');
    });
  });

  it('closes with a toast when the customer is not found', async () => {
    await open(null);

    expect(toaster.error).toHaveBeenCalledWith('The customer was not found.');
    expect(navigate).toHaveBeenCalledWith(['..'], expect.anything());
  });
});

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
import type {
  CreateServiceRequest,
  ServiceCategoryResponse,
  ServiceOptionsResponse,
  ServiceResponse,
} from '@api/services';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import type { FormEditor } from '@util/forms';
import { BehaviorSubject, firstValueFrom, of, type Observable } from 'rxjs';

import type { CategoryChange } from '../category/category-dialog.types';
import type { ServiceFormValue } from '../form/service.form.types';
import { servicesInlineLoader } from '../services.i18n';
import { ServicesStore } from '../services.store';
import { ServiceDetails } from './service-details';

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

const API = 'http://api.test/api/v1/services';

const OPTIONS: ServiceOptionsResponse = {
  currency: 'EUR',
  languages: ['el', 'en'],
  categories: [{ id: 'cuts', name: 'Haircuts', isOwned: false, serviceCount: 2, translations: [] }],
  staffMembers: [
    { id: 'nikos', displayName: 'Nikos P.', isActive: true, isBookable: true },
    { id: 'maria', displayName: 'Maria K.', isActive: true, isBookable: true },
    { id: 'eleni', displayName: 'Eleni R.', isActive: true, isBookable: false },
    { id: 'kostas', displayName: 'Kostas L.', isActive: false, isBookable: true },
  ],
};

const SERVICE: ServiceResponse = {
  id: 's1',
  categoryId: 'cuts',
  price: 16,
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 5,
  isActive: true,
  translations: [
    { languageCode: 'el', name: 'Κούρεμα', description: null },
    { languageCode: 'en', name: 'Haircut', description: null },
  ],
  staff: [
    { staffMemberId: 'nikos', customPrice: 20, customDurationMinutes: null },
    { staffMemberId: 'kostas', customPrice: null, customDurationMinutes: null },
  ],
  timesBooked: 0,
  canDelete: true,
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: null,
};

/** The panel's own state, which the specs drive where a real user would type. */
interface PanelInternals {
  readonly editor: FormEditor<ServiceFormValue>;
  canLeave(): Promise<boolean>;
  onCategoryChange(change: CategoryChange): void;
  categoryOptions(): readonly { value: string; label: string }[];
}

describe('ServiceDetails', () => {
  let fixture: ComponentFixture<ServiceDetails>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn<Router['navigate']>>;
  let confirm: ReturnType<typeof vi.fn>;
  let toaster: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function internals(): PanelInternals {
    return fixture.componentInstance as unknown as PanelInternals;
  }

  function editor(): FormEditor<ServiceFormValue> {
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
    serviceId: string,
    codes: readonly string[] = ['services:create', 'services:update', 'services:delete'],
  ): Promise<void> {
    const params = new BehaviorSubject<ParamMap>(convertToParamMap({ serviceId }));
    const granted = signal(codes);
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
        ServicesStore,
        { provide: ActivatedRoute, useValue: { paramMap: params } },
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
      transloco.load('managementServices/en', { inlineLoader: servicesInlineLoader }),
    );
    navigate = vi.fn<Router['navigate']>(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
    TestBed.inject(ServicesStore).options.set(OPTIONS);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServiceDetails);
    await settle();
  }

  async function flushService(service: ServiceResponse = SERVICE): Promise<void> {
    http.expectOne(`${API}/${service.id}`).flush(service);
    await settle();
  }

  /** The writes' follow-ups: the options the store reads again. */
  function flushOptions(): void {
    for (const request of http.match((candidate) => candidate.url.startsWith(`${API}/options`))) {
      request.flush(OPTIONS);
    }
  }

  describe('a new service', () => {
    it('selects every active, bookable barber and nobody else', async () => {
      await open('new');

      const staff = editor().form.staff().value();
      expect(staff.map((row) => [row.staffMemberId, row.selected])).toEqual([
        ['nikos', true],
        ['maria', true],
      ]);
    });

    it('sends a name in every language and the selected barbers without own values', async () => {
      await open('new');
      const form = editor().form;
      form.translations[0].name().value.set('Κούρεμα');
      form.translations[1].name().value.set('Haircut');
      form.price().value.set(16);
      form.staff[1].selected().value.set(false);

      void editor().commit();
      await settle();

      const request = http.expectOne(API);
      expect(request.request.method).toBe('POST');
      const body = request.request.body as CreateServiceRequest;
      expect(body.translations).toEqual([
        { languageCode: 'el', name: 'Κούρεμα', description: null },
        { languageCode: 'en', name: 'Haircut', description: null },
      ]);
      expect(body.staff).toEqual([
        { staffMemberId: 'nikos', customPrice: null, customDurationMinutes: null },
      ]);
      expect(body.categoryId).toBeNull();
      request.flush({ ...SERVICE, id: 's9' }, { status: 201, statusText: 'Created' });
      await settle();
      flushOptions();

      expect(navigate).toHaveBeenCalledWith(
        ['..', 's9'],
        expect.objectContaining({ replaceUrl: true }),
      );
    });

    it('holds a save until every language has a name', async () => {
      await open('new');
      editor().form.translations[0].name().value.set('Κούρεμα');
      editor().form.price().value.set(16);

      await editor().commit();
      await settle();

      http.expectNone(API);
      expect(editor().form.translations[1].name().invalid()).toBe(true);
    });
  });

  describe('an edit', () => {
    it('keeps an inactive barber who already performs the service', async () => {
      await open('s1');
      await flushService();

      button('Edit')?.click();
      await settle();
      const staff = editor().form.staff().value();
      expect(staff.map((row) => row.staffMemberId)).toEqual(['nikos', 'maria', 'kostas']);

      void editor().commit();
      await settle();

      const request = http.expectOne(`${API}/s1`);
      expect(request.request.method).toBe('PUT');
      expect((request.request.body as CreateServiceRequest).staff).toEqual([
        { staffMemberId: 'nikos', customPrice: 20, customDurationMinutes: null },
        { staffMemberId: 'kostas', customPrice: null, customDurationMinutes: null },
      ]);
    });

    it('puts a taken name on the language the server names', async () => {
      await open('s1');
      await flushService();
      button('Edit')?.click();
      await settle();

      void editor().commit();
      await settle();
      http.expectOne(`${API}/s1`).flush(
        {
          status: 409,
          title: 'SERVICE_NAME_TAKEN',
          errors: [
            {
              code: 'SERVICE_NAME_TAKEN',
              description: 'Taken.',
              propertyName: 'translations[1].name',
            },
          ],
        },
        { status: 409, statusText: 'Conflict' },
      );
      await settle();

      expect(editor().form.translations[1].name().errors().length).toBe(1);
      expect(editor().form.translations[0].name().errors()).toEqual([]);
    });

    it('moves a barber refusal to the row that barber is on', async () => {
      await open('s1');
      await flushService();
      button('Edit')?.click();
      await settle();

      void editor().commit();
      await settle();
      // The request sends nikos and kostas. `staff[1]` is kostas, the form's third row.
      http.expectOne(`${API}/s1`).flush(
        {
          status: 400,
          title: 'VALIDATION_FAILED',
          errors: [
            {
              code: 'SERVICE_INVALID_PRICE',
              description: 'Bad price.',
              propertyName: 'staff[1].customPrice',
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();

      expect(editor().form.staff[2].customPrice().errors().length).toBe(1);
      expect(editor().form.staff[1].customPrice().errors()).toEqual([]);
    });

    it('asks before a navigation drops a change', async () => {
      await open('s1');
      await flushService();
      button('Edit')?.click();
      await settle();
      // Typing marks the field dirty. A programmatic write does not, so the spec does it.
      editor().form.price().value.set(18);
      editor().form.price().markAsDirty();

      await internals().canLeave();

      expect(confirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('is offered for a service on no appointment', async () => {
      await open('s1');
      await flushService();

      expect(button('Delete')).toBeDefined();
    });

    // A service booked once and cancelled counts no booking, and still cannot be deleted.
    it('is withheld once the service is on an appointment, even a cancelled one', async () => {
      await open('s1');
      await flushService({ ...SERVICE, timesBooked: 0, canDelete: false });

      expect(button('Delete')).toBeUndefined();
      expect(button('Deactivate')).toBeDefined();
    });

    it('offers Deactivate when a booking lands before the delete', async () => {
      await open('s1');
      await flushService();

      button('Delete')?.click();
      await settle();
      http
        .expectOne((request) => request.method === 'DELETE')
        .flush({ status: 409, title: 'SERVICE_IN_USE' }, { status: 409, statusText: 'Conflict' });
      await settle();
      // The drawer reads the service again: a booking has just changed it.
      http
        .expectOne((request) => request.method === 'GET' && request.url === `${API}/s1`)
        .flush(SERVICE);
      await settle();

      expect(confirm).toHaveBeenCalledTimes(2);
      const put = http.expectOne((request) => request.method === 'PUT');
      expect((put.request.body as CreateServiceRequest).isActive).toBe(false);
    });
  });

  describe('categories', () => {
    it('selects a category the dialog created before the options list it', async () => {
      await open('new');
      const created: ServiceCategoryResponse = {
        id: 'beard',
        name: 'Beard',
        isOwned: true,
        serviceCount: 0,
        translations: [],
      };

      internals().onCategoryChange({ kind: 'saved', category: created });
      await settle();

      expect(editor().form.categoryId().value()).toBe('beard');
      expect(
        internals()
          .categoryOptions()
          .map((option) => option.value),
      ).toContain('beard');
    });

    it('leaves the form uncategorized when its category is deleted', async () => {
      await open('new');
      editor().form.categoryId().value.set('cuts');

      internals().onCategoryChange({ kind: 'deleted', id: 'cuts' });

      expect(editor().form.categoryId().value()).toBe('');
    });
  });
});

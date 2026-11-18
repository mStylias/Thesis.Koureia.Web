import { Component, Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { ServiceCategoryResponse } from '@api/services';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { servicesInlineLoader } from '../services.i18n';
import { ServicesStore } from '../services.store';
import { CategoryDialog } from './category-dialog';
import type { CategoryChange } from './category-dialog.types';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const API = 'http://api.test/api/v1/services/categories';

const OWNED: ServiceCategoryResponse = {
  id: 'beard',
  name: 'Beard',
  isOwned: true,
  serviceCount: 3,
  translations: [
    { languageCode: 'el', name: 'Γένια' },
    { languageCode: 'en', name: 'Beard' },
  ],
};

@Component({
  imports: [CategoryDialog],
  template: `
    <lib-service-category-dialog
      [(visible)]="visible"
      [category]="category()"
      [languages]="['el', 'en']"
      (changed)="changes.push($event)"
    />
  `,
})
class Host {
  readonly visible = signal(true);
  readonly category = signal<ServiceCategoryResponse | null>(null);
  readonly changes: CategoryChange[] = [];
}

/** The dialog's own state, which the specs drive where a real user would type or press. */
interface DialogInternals {
  readonly editor: {
    form: { translations: { name: () => { value: { set(v: string): void } } }[] };
  };
  save(): void;
  remove(): Promise<void>;
}

describe('CategoryDialog', () => {
  let fixture: ComponentFixture<Host>;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function dialog(): DialogInternals {
    const debug = fixture.debugElement.children[0];
    return debug.componentInstance as DialogInternals;
  }

  async function open(category: ServiceCategoryResponse | null): Promise<void> {
    confirm = vi.fn(() => Promise.resolve('confirmed'));
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
        { provide: StaffAccessStore, useValue: { has: () => true } },
        { provide: ConfirmationService, useValue: { open: confirm } },
        { provide: ToasterService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementServices/en', { inlineLoader: servicesInlineLoader }),
    );
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.category.set(category);
    await settle();
  }

  it('creates a category with a name in every language and hands it back', async () => {
    await open(null);
    const names = dialog().editor.form.translations;
    names[0].name().value.set('Γένια');
    names[1].name().value.set('Beard');

    dialog().save();
    await settle();

    const request = http.expectOne(`${API}?languageCode=en`);
    expect(request.request.body).toEqual({
      translations: [
        { languageCode: 'el', name: 'Γένια' },
        { languageCode: 'en', name: 'Beard' },
      ],
    });
    request.flush(OWNED, { status: 201, statusText: 'Created' });
    await settle();

    expect(fixture.componentInstance.changes).toEqual([{ kind: 'saved', category: OWNED }]);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('names how many services a delete leaves uncategorized', async () => {
    await open(OWNED);

    const removed = dialog().remove();
    await settle();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '“Beard” will be deleted. 3 services will become uncategorized.',
      }),
    );
    http.expectOne(`${API}/beard`).flush(null, { status: 204, statusText: 'No Content' });
    await removed;
    await settle();

    expect(fixture.componentInstance.changes).toEqual([{ kind: 'deleted', id: 'beard' }]);
  });
});

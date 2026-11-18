import { Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi, SYNAX_ERROR_MESSAGES } from '@synax/client';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { staffErrorMessages } from '../staff.errors';
import { staffInlineLoader } from '../staff.i18n';
import { StaffStore } from '../staff.store';
import { AddMemberDialog } from './add-member-dialog';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

// jsdom has no <dialog> methods; the dialog drives the element with them.
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

const API = 'http://api.test/api/v1/staff';

describe('AddMemberDialog', () => {
  let fixture: ComponentFixture<AddMemberDialog>;
  let http: HttpTestingController;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function input(): HTMLInputElement {
    const element = document.querySelector('input[inputmode="email"]');
    // The dialog portals its content to the body, outside the component's element.
    if (!(element instanceof HTMLInputElement)) throw new Error('address not rendered');
    return element;
  }

  function button(label: string): HTMLButtonElement {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent.trim() === label,
    );
    if (found === undefined) throw new Error(`${label} not rendered`);
    return found;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'http://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en' },
          loader: EmptyLoader,
        }),
        StaffStore,
        // As `staffRoute` provides it: the page's copy for its own codes.
        { provide: SYNAX_ERROR_MESSAGES, useFactory: staffErrorMessages },
        { provide: ActivatedRoute, useValue: {} },
        { provide: StaffAccessStore, useValue: { has: signal(true) } },
        { provide: ToasterService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(transloco.load('managementStaff/en', { inlineLoader: staffInlineLoader }));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddMemberDialog);
    fixture.componentRef.setInput('visible', true);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('suggests nothing: a text field with autocomplete off, no list and no name holding "email"', () => {
    const field = input();
    expect(field.type).toBe('text');
    expect(field.getAttribute('inputmode')).toBe('email');
    expect(field.getAttribute('autocomplete')).toBe('off');
    expect(field.getAttribute('list')).toBeNull();
    expect(field.name).not.toMatch(/email/i);
  });

  it('sends nothing while typing, and the trimmed address on Search', async () => {
    input().value = ' maria@example.com ';
    input().dispatchEvent(new Event('input'));
    await settle();
    http.expectNone(`${API}/candidates`);

    // The button label loads with a dynamic import, which a busy machine can delay.
    const search = await vi.waitFor(
      () => {
        fixture.detectChanges();
        return button('Search');
      },
      { timeout: 5000 },
    );
    search.click();
    await settle();

    const request = http.expectOne(`${API}/candidates`);
    expect(request.request.body).toEqual({ email: 'maria@example.com' });
    request.flush(
      {
        title: 'STAFF_CANDIDATE_NOT_FOUND',
        status: 404,
        errors: [{ code: 'STAFF_CANDIDATE_NOT_FOUND', propertyName: 'email', description: '' }],
      },
      { status: 404, statusText: 'Not Found' },
    );
    await settle();

    // The API names the address `email`; the field holds it as `lookup`, and the error lands there.
    const field = input().closest('lib-field');
    expect(field?.textContent).toContain('No account uses this email');
  });

  it('forgets the address when it closes', async () => {
    input().value = 'maria@example.com';
    input().dispatchEvent(new Event('input'));
    await settle();

    fixture.componentRef.setInput('visible', false);
    await settle();
    fixture.componentRef.setInput('visible', true);
    await settle();

    expect(input().value).toBe('');
  });
});

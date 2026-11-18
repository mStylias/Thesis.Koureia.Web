import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  RouterOutlet,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import {
  CompanyApi,
  type CompanyHolidayResponse,
  type CompanyPhotoResponse,
  type CompanySettingsResponse,
} from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { Result } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { Observable, of } from 'rxjs';

import { companyRoute } from '../company.routes';
import type { ManagementCompany } from './management-company';
import { leaveManagementCompany } from './management-company.guard';

const SETTINGS: CompanySettingsResponse = {
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
  logoUrl: 'https://cdn.test/logo.webp',
  businessHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '21:00' }],
  bookingRules: {
    slotIntervalMinutes: 15,
    minLeadTimeMinutes: 0,
    maxAdvanceDays: 60,
    cancellationCutoffMinutes: 60,
  },
  supportEmail: null,
};

const HOLIDAY: CompanyHolidayResponse = {
  id: 'h1',
  startsOn: '2099-12-24',
  endsOn: '2099-12-24',
  isClosed: true,
  openTime: null,
  closeTime: null,
  name: null,
};

const PHOTO: CompanyPhotoResponse = {
  id: 'p1',
  url: 'https://cdn.test/p1.webp',
  width: 1600,
  height: 1200,
  altTexts: [],
};

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Shell {}

@Component({ template: '' })
class Elsewhere {}

describe('ManagementCompany', () => {
  let scrolled: string[];
  let codes: Set<string>;
  const company = signal({ id: 'c1', name: 'Shop', timezone: null });
  const api = {
    settings: vi.fn(() => of(Result.Ok(SETTINGS))),
    holidays: vi.fn(() => of(Result.Ok([HOLIDAY]))),
    photos: vi.fn(() => of(Result.Ok([PHOTO]))),
  };

  // jsdom has no layout, so it has no `scrollIntoView` to spy on.
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = function (): void {
      // Replaced per test.
    };
  });

  async function open(url: string, held: readonly string[] = []): Promise<HTMLElement> {
    scrolled = [];
    codes = new Set(held);
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (
      this: HTMLElement,
    ) {
      scrolled.push(this.id);
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'management/company', ...companyRoute },
          { path: 'elsewhere', component: Elsewhere },
        ]),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        { provide: CompanyApi, useValue: api },
        {
          provide: StaffAccessStore,
          useValue: { has: (code: string) => codes.has(code), company },
        },
        { provide: ToasterService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmationService, useValue: { open: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    company.set({ id: 'c1', name: 'Shop', timezone: null });
  });

  it('shows the cards in order, each under its own fragment', async () => {
    const page = await open('/management/company');

    expect(page.querySelector('lib-management-company')).not.toBeNull();
    expect(
      Array.from(page.querySelectorAll('lib-page-section')).map((section) => section.id),
    ).toEqual(['shop', 'hours', 'closures', 'booking', 'photos']);
  });

  it('gives each card a heading that names its section', async () => {
    const page = await open('/management/company');

    for (const section of Array.from(page.querySelectorAll('lib-page-section > section'))) {
      const heading = page.querySelector(`[id="${section.getAttribute('aria-labelledby') ?? ''}"]`);
      expect(heading?.tagName).toBe('H2');
    }
  });

  it('shows every card to a reader without company:update, with no change control', async () => {
    const page = await open('/management/company', ['members:read']);

    expect(page.querySelectorAll('lib-page-section [role="alert"]')).toHaveLength(0);
    expect(page.querySelector('[libpagesectionactions] button')).toBeNull();
    expect(page.querySelector('input[type="file"]')).toBeNull();
    expect(page.querySelector('.closures-actions')).toBeNull();
    expect(page.querySelector('.photo-menu')).toBeNull();
    expect(page.textContent).toContain('«Επεξεργασία ρυθμίσεων καταστήματος»');
  });

  it('offers the change controls to a holder of company:update', async () => {
    const page = await open('/management/company', ['company:update']);

    expect(page.querySelectorAll('[libpagesectionactions] button').length).toBeGreaterThanOrEqual(
      4,
    );
    expect(page.querySelector('.closures-actions')).not.toBeNull();
    expect(page.querySelector('.photo-menu')).not.toBeNull();
    expect(page.textContent).not.toContain('«Επεξεργασία ρυθμίσεων καταστήματος»');
  });

  it('brings the fragment into view once every card has loaded', async () => {
    await open('/management/company#closures');

    expect(scrolled).toEqual(['closures']);
  });

  it('lets a navigation go when no card has changes', async () => {
    await open('/management/company');

    expect(await TestBed.inject(Router).navigateByUrl('/elsewhere')).toBe(true);
  });

  it('asks the page whether it can close', () => {
    const page = { canLeave: vi.fn(() => Promise.resolve(false)) };

    expect(companyRoute.canDeactivate).toEqual([leaveManagementCompany]);
    // The guard reads none of the snapshots.
    const none = {} as ActivatedRouteSnapshot & RouterStateSnapshot;
    void leaveManagementCompany(page as unknown as ManagementCompany, none, none, none);
    expect(page.canLeave).toHaveBeenCalledOnce();
  });

  it('carries no permission guard, so every member can open it', () => {
    expect(companyRoute.canActivate ?? []).toEqual([]);
  });
});

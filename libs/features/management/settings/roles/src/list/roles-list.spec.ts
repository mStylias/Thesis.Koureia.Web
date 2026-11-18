/**
 * The seam: a real grid, one HTTP boundary, and the translation between them.
 *
 * The names a reader filters and sorts by are the **client's**, not the column's, so this grid
 * fetches the collection whole and runs every operation locally. What follows asserts both
 * halves of that: the URL that actually left the app, and the names the rows end up carrying.
 */
import { Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTransloco,
  Translation,
  TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom, of, Observable } from 'rxjs';

import { rolesInlineLoader } from '../roles.i18n';
import { RolesStore } from '../roles.store';
import { RolesList } from './roles-list';

const COMPANY = 'aaaa0000-0000-4000-8000-00000000cafe';
const SHOP = { id: COMPANY, name: 'Δοκιμή' };
const BASE = 'http://api.test';
const ODATA_PREFIX = `${BASE}/api/v1/roles/odata`;

const ROLES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: null,
    name: 'company_admin',
    description: 'Shop owner',
    isSystem: true,
    isEditable: false,
    numberOfUsers: 3,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    ownerId: null,
    name: 'staff',
    description: 'Staff member',
    isSystem: true,
    isEditable: false,
    numberOfUsers: 0,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    ownerId: COMPANY,
    name: 'Ταμείο',
    description: null,
    isSystem: false,
    isEditable: true,
    numberOfUsers: 1,
  },
];

/** The root dictionary is nothing this page reads. The scope carries every string it does. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

describe('the roles page', () => {
  let fixture: ComponentFixture<RolesList>;
  let http: HttpTestingController;
  /** The caller's codes. `Add role` needs `roles:create`. */
  const granted = signal<readonly string[]>(['roles:read', 'roles:create']);

  beforeEach(async () => {
    granted.set(['roles:read', 'roles:create']);
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The page holds the outlet the details panel renders into, and its
        // toolbar navigates to that route.
        provideRouter([]),
        provideSynaxApi({ baseUrl: BASE, defaultVersion: 1 }),
        {
          provide: StaffAccessStore,
          useValue: { company: signal(SHOP), has: (code: string) => granted().includes(code) },
        },
        // Route-scoped in the app, so the test module is what stands in for the route here.
        RolesStore,
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    // What `rolesRoute`'s resolver does before the page renders. The seeded role names are read
    // imperatively, so a dictionary that arrives later would leave them in English.
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('managementRoles/el', {
        inlineLoader: rolesInlineLoader,
      }),
    );

    fixture = TestBed.createComponent(RolesList);
    http = TestBed.inject(HttpTestingController);
    // No `whenStable()` here: the grid's first load is a pending task, and it cannot settle
    // until the request below is answered. Awaiting stability before flushing deadlocks.
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => {
    http.verify();
  });

  /** Lets effects, microtasks and the rxjs chain run, then redraws. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  /** Answers the roles query, and reports the URL that went out. */
  async function firstQuery(): Promise<string> {
    await settle();

    const request = http.expectOne((candidate) => candidate.url.startsWith(ODATA_PREFIX));
    request.flush({ value: ROLES, '@odata.count': ROLES.length });
    // The rows land once the skeleton has served its floor.
    await fixture.whenStable();
    await settle();

    return request.request.urlWithParams;
  }

  it('reads the roles without naming a company, which the API resolves from the account', async () => {
    const url = await firstQuery();

    expect(url.startsWith(ODATA_PREFIX)).toBe(true);
  });

  it('asks for the whole collection rather than the page the grid shows', async () => {
    const url = await firstQuery();

    // `$top` is the endpoint's own cap, not the grid's page size: the page is picked locally.
    expect(url).toContain('$count=true');
    expect(url).toContain('$top=100');
    expect(url).toContain('$skip=0');
  });

  it('sends only the base surface, because this endpoint enables nothing else', async () => {
    const url = await firstQuery();

    // Measured against the running endpoint: each of these comes back as a 400 here.
    for (const advanced of ['$apply', '$search', '$compute', '$skiptoken']) {
      expect(url).not.toContain(advanced);
    }
  });

  it('projects every member, because `isSystem` decides whether a name is translated', async () => {
    const url = await firstQuery();

    // A `$select` built from the three columns would drop it, and every seeded name would then
    // render in English.
    expect(url).not.toContain('$select');
  });

  it('shows a seeded role under its translated name and a company role under its own', async () => {
    await firstQuery();
    await settle();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ιδιοκτήτης');
    expect(text).toContain('Μέλος προσωπικού');
    // Tenant free text, already in the company's own language. Never looked up.
    expect(text).toContain('Ταμείο');
    expect(text).not.toContain('company_admin');
  });

  it('drops a seeded role description, which its translated name already says', async () => {
    await firstQuery();
    await settle();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    // Dropped from the row rather than hidden in the cell, so the filter, the sort and the
    // export all agree with what is on screen.
    expect(text).not.toContain('Shop owner');
    expect(text).not.toContain('Staff member');
  });

  it('offers Add role to a user with roles:create', async () => {
    await firstQuery();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Προσθήκη ρόλου');
  });

  it('withholds Add role from a user without roles:create', async () => {
    granted.set(['roles:read']);
    await firstQuery();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Προσθήκη ρόλου');
  });

  it('resolves the company once, not once per query', async () => {
    await firstQuery();

    // `afterEach`'s verify() is the assertion: a counted share would have opened a second
    // company request by now, and an unexpected open request fails the test.
    http.verify();
  });
});

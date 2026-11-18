/**
 * The panel is a route, so what matters here is the shape it renders in — over the list rather
 * than instead of it, named by the same icon the navigation gives this section — and the two
 * things the create form has to get right: the actions stay out of the scroller, and the codes
 * that leave the app are the ones the tree may grant.
 */
import { Component, Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import {
  provideTransloco,
  Translation,
  TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { ToasterService } from '@ui/toaster';
import { of, Observable } from 'rxjs';

import { RolesStore } from '../roles.store';
import type { GrantablePermissionResponse, RoleResponse } from '../roles.types';
import { RoleDetails } from './role-details';

const COMPANY = 'aaaa0000-0000-4000-8000-00000000cafe';
const SHOP = { id: COMPANY, name: 'Δοκιμή' };
const BASE = 'http://api.test';
const CATALOG_URL = `${BASE}/api/v1/roles/grantable-permissions`;
const CREATE_URL = `${BASE}/api/v1/roles`;
const ROLE_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_URL = `${CREATE_URL}/${ROLE_ID}`;

/** Two categories, and one code the caller may not grant, which is the interesting case. */
const CATALOG: readonly GrantablePermissionResponse[] = [
  {
    code: 'appointments:create',
    name: 'Book appointments',
    description: 'Book appointments',
    category: 'appointments',
    isTenantGrantable: true,
    canGrant: true,
  },
  {
    code: 'appointments:cancel',
    name: 'Cancel appointments',
    description: 'Cancel appointments',
    category: 'appointments',
    isTenantGrantable: true,
    canGrant: true,
  },
  {
    code: 'platform:manage',
    name: 'Manage platform',
    description: 'Full platform administration',
    category: 'platform',
    isTenantGrantable: false,
    canGrant: false,
  },
];

/**
 * Somewhere for the post-create navigation to land. The panel is not under an outlet here, so
 * nothing renders it — but an unmatched URL rejects the navigation and the save reads as failed.
 */
@Component({ template: '' })
class Landing {}

/**
 * A real outlet, because the panel reads `roleId` off its own `ActivatedRoute`.
 * `TestBed.createComponent(RoleDetails)` hands it the *root* route instead, where the parameter
 * does not exist — which is exactly how a role's address silently behaved like `new`.
 */
@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Shell {}

/** The panel reads its copy through the scope, so an empty dictionary is enough. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

// jsdom implements none of the `<dialog>` methods the drawer drives it with.
beforeAll(() => {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

describe('the role details panel', () => {
  let fixture: ComponentFixture<RoleDetails>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Landing }]),
        provideSynaxApi({ baseUrl: BASE, defaultVersion: 1 }),
        {
          provide: StaffAccessStore,
          useValue: { company: signal(SHOP), has: () => true },
        },
        // Route-scoped in the app, so the test module is what stands in for the route here.
        RolesStore,
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleDetails);
    http = TestBed.inject(HttpTestingController);
    // No `whenStable()` anywhere here: the catalog request is a pending task, and it cannot
    // settle until `loadCatalog` answers it. Awaiting stability first deadlocks.
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  /** Lets effects, microtasks and the rxjs chain run, then redraws. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  /** Answers the catalog request. */
  async function loadCatalog(): Promise<void> {
    await settle();
    http.expectOne(CATALOG_URL).flush(CATALOG);
    await settle();
  }

  function dialog(): HTMLDialogElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('dialog');
    if (element == null) {
      throw new Error('drawer not rendered');
    }
    return element;
  }

  function query(selector: string): HTMLElement {
    const element = dialog().querySelector<HTMLElement>(selector);
    if (element == null) {
      throw new Error(`${selector} not rendered`);
    }
    return element;
  }

  /** The role a create comes back with. */
  function created(permissions: readonly string[] = []): RoleResponse {
    return {
      id: ROLE_ID,
      ownerId: COMPANY,
      name: 'Receptionist',
      description: null,
      isSystem: false,
      isEditable: true,
      permissions,
    };
  }

  /** The last button in the toolbar, which is Edit in view mode and Save in the editor. */
  function primaryAction(): HTMLElement {
    return query('.drawer-actions-end button:last-of-type');
  }

  function maybeQuery(selector: string): HTMLElement | null {
    return dialog().querySelector<HTMLElement>(selector);
  }

  it('opens on the right as soon as the route renders', async () => {
    await loadCatalog();
    expect(dialog().getAttribute('data-position')).toBe('right');
    expect(dialog().open).toBe(true);
  });

  it('stays non-modal, so the list behind it keeps working', async () => {
    await loadCatalog();
    expect(dialog().hasAttribute('data-modal')).toBe(false);
  });

  it('draws the section icon before the title, which the built-in header cannot', async () => {
    await loadCatalog();
    const heading = query('.role-details-heading');
    expect(heading.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(heading.querySelector('h2')).not.toBeNull();
  });

  it('keeps cancel and save out of the scrolling content', async () => {
    await loadCatalog();
    const actions = query('.drawer-actions-end');

    // The drawer's toolbar slot, which is the one region between the header and the scroller.
    expect(actions.closest('.drawer-toolbar')).not.toBeNull();
    expect(actions.closest('.drawer-content')).toBeNull();
    expect(actions.querySelectorAll('button')).toHaveLength(2);
  });

  it('names save with an icon before its caption, and puts it last', async () => {
    await loadCatalog();
    const save = query('.drawer-actions-end button:last-of-type');

    expect(save.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    // Decoration: the caption is what names the button.
    expect(save.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lays the compact fields out as one column of name and two of description', async () => {
    await loadCatalog();

    // The grid is two columns; only the name is half of it.
    expect(query('#role-name').closest('.role-form-cell-half')).not.toBeNull();
    expect(query('#role-description').closest('.role-form-cell-half')).toBeNull();
    expect(query('#role-description').closest('.role-form-cell')).not.toBeNull();

    expect(query('#role-name').getAttribute('data-size')).toBe('sm');
    expect(query('#role-description').getAttribute('data-size')).toBe('sm');
  });

  it('groups the catalog by category and disables what the caller cannot grant', async () => {
    await loadCatalog();

    const categories = dialog().querySelectorAll('.tree-root > .tree-item');
    expect(categories).toHaveLength(2);

    // `platform:manage` is the only code in its category and is refused, so the row grouping
    // it has nothing left to toggle.
    const refused = categories[1];
    expect(refused.getAttribute('aria-disabled')).toBe('true');
  });

  it('refuses an empty name without asking the server', async () => {
    await loadCatalog();
    query('.drawer-actions-end button:last-of-type').click();
    await settle();

    expect(query('.field-error').textContent.trim().length).toBeGreaterThan(0);
    http.expectNone(CREATE_URL);
  });

  it('spins the save icon while the write is in flight', async () => {
    await loadCatalog();

    const save = query('.drawer-actions-end button:last-of-type');
    expect(save.querySelector('.btn-spinner')).toBeNull();
    expect(save.hasAttribute('aria-busy')).toBe(false);

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Receptionist';
    name.dispatchEvent(new Event('input'));
    await settle();

    save.click();
    await settle();

    // The request is still open, so the button reports the wait three ways — all three from
    // `loading`: the spinner for the eye, `aria-busy` for a screen reader, and disabled so it
    // cannot be pressed twice.
    expect(save.querySelector('.btn-spinner')).not.toBeNull();
    expect(save.querySelector('.btn-spinner')?.getAttribute('aria-hidden')).toBe('true');
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect((save as HTMLButtonElement).disabled).toBe(true);

    // When it stops is `@ui/button`'s own `minDuration` floor, which its spec covers under a
    // fake clock. All this panel owes is the binding — but the request still has to be answered,
    // or the verify in `afterEach` reports it as left open.
    http.expectOne(CREATE_URL).flush(created());
    await settle();
  });

  it('keeps the save caption stable, so focus does not re-announce a changed name', async () => {
    await loadCatalog();
    const save = query('.drawer-actions-end button:last-of-type');
    const caption = save.textContent.trim();

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Receptionist';
    name.dispatchEvent(new Event('input'));
    await settle();

    save.click();
    await settle();

    expect(save.textContent.trim()).toBe(caption);

    http.expectOne(CREATE_URL).flush(created());
    await settle();
  });

  it('announces the created role in a toast, which nothing else on screen would', async () => {
    await loadCatalog();
    const toaster = TestBed.inject(ToasterService);
    expect(toaster.toasts()).toHaveLength(0);

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Receptionist';
    name.dispatchEvent(new Event('input'));
    await settle();

    query('.drawer-actions-end button:last-of-type').click();
    await settle();

    // Nothing yet: the write is still open and may still be refused.
    expect(toaster.toasts()).toHaveLength(0);

    http.expectOne(CREATE_URL).flush(created());
    await settle();

    expect(toaster.toasts()).toHaveLength(1);
    expect(toaster.toasts()[0].severity).toBe('success');
  });

  it('says nothing when the write is refused', async () => {
    await loadCatalog();
    const toaster = TestBed.inject(ToasterService);

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'company_admin';
    name.dispatchEvent(new Event('input'));
    await settle();

    query('.drawer-actions-end button:last-of-type').click();
    await settle();

    http
      .expectOne(CREATE_URL)
      .flush(
        { title: 'ROLE_NAME_TAKEN', status: 409, detail: 'That name is taken.' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(toaster.toasts()).toHaveLength(0);
    // The name is what has to change, so the message lands on the name field.
    expect(query('.field-error').textContent.trim().length).toBeGreaterThan(0);
  });

  it('says the name is required from the first render, and nothing more', async () => {
    await loadCatalog();

    const name = query('#role-name');
    // The required marker sits outside the validation gate, so what a screen reader is told
    // about the field is right before anything has been reported about its value. `novalidate`
    // on the form is what keeps the native attribute from bubbling over the message later.
    expect(name.hasAttribute('required')).toBe(true);
    expect(query('form').hasAttribute('novalidate')).toBe(true);
    expect(name.hasAttribute('data-invalid')).toBe(false);
    expect(name.getAttribute('aria-invalid')).toBeNull();
    expect(maybeQuery('.field-error')).toBeNull();
  });

  it('says nothing about an empty name until save has been pressed', async () => {
    await loadCatalog();

    const name = query('#role-name') as HTMLInputElement;
    // Typed into and left again, which is when the library's usual rule would accuse them.
    name.value = 'x';
    name.dispatchEvent(new Event('input'));
    await settle();
    name.value = '';
    name.dispatchEvent(new Event('input'));
    name.dispatchEvent(new FocusEvent('focusout'));
    await settle();

    expect(maybeQuery('.field-error')).toBeNull();
  });

  it('validates live once save has been pressed', async () => {
    await loadCatalog();

    primaryAction().click();
    await settle();
    expect(query('.field-error').textContent.trim().length).toBeGreaterThan(0);
    http.expectNone(CREATE_URL);

    // Fixed as it is typed, with no second press needed to clear the message.
    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Receptionist';
    name.dispatchEvent(new Event('input'));
    await settle();

    expect(maybeQuery('.field-error')).toBeNull();

    // And back again, still live.
    name.value = '';
    name.dispatchEvent(new Event('input'));
    await settle();

    expect(maybeQuery('.field-error')).not.toBeNull();
  });

  it('sends the ticked codes and no category key of its own', async () => {
    await loadCatalog();

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Receptionist';
    name.dispatchEvent(new Event('input'));
    await settle();

    // The category row, which cascades to the two codes under it.
    query('.tree-root > .tree-item .tree-indicator').click();
    await settle();

    query('.drawer-actions-end button:last-of-type').click();
    await settle();

    const request = http.expectOne(CREATE_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Receptionist',
      description: '',
      permissions: ['appointments:create', 'appointments:cancel'],
    });

    request.flush(created(['appointments:create', 'appointments:cancel']));
    await settle();

    // Still open, now on the role's own address: the create is done, the panel is not.
    expect(dialog().open).toBe(true);
  });

  it('tells the grid a role was written, which it has not queried', async () => {
    await loadCatalog();
    const store = TestBed.inject(RolesStore);
    expect(store.revision()).toBe(0);

    store.roleWritten();
    expect(store.revision()).toBe(1);
  });
});

/**
 * The same panel on a role's own address. Everything here turns on one thing: view and edit are
 * a signal rather than two routes, so the drawer has to survive every switch between them.
 */
describe('the role details panel on an existing role', () => {
  // The host, not the panel: the panel is reached through the route.
  let fixture: ComponentFixture<Shell>;
  let http: HttpTestingController;

  const ROLE: RoleResponse = {
    id: ROLE_ID,
    ownerId: COMPANY,
    name: 'Receptionist',
    description: 'Front desk',
    isSystem: false,
    isEditable: true,
    permissions: ['appointments:cancel'],
  };

  /** The caller's codes. Edit needs `roles:update` as well as `isEditable`. */
  let granted: readonly string[] = ['roles:update'];

  beforeEach(() => {
    granted = ['roles:update'];
  });

  /** Puts the panel on `roles/<id>` and answers the company lookup it opens with. */
  async function open(): Promise<void> {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The panel is reached through the route, so it is the route that names the role.
        provideRouter([{ path: 'roles/:roleId', component: RoleDetails }]),
        provideSynaxApi({ baseUrl: BASE, defaultVersion: 1 }),
        {
          provide: StaffAccessStore,
          useValue: { company: signal(SHOP), has: (code: string) => granted.includes(code) },
        },
        RolesStore,
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    http = TestBed.inject(HttpTestingController);
    await TestBed.inject(Router).navigate(['roles', ROLE_ID]);
    fixture.detectChanges();
    await settle();
  }

  /**
   * Opens the panel and answers both of its requests.
   *
   * The role and the catalog go out together, so they are matched by URL rather than in a fixed
   * order.
   */
  async function build(role: RoleResponse = ROLE): Promise<void> {
    await open();

    http.expectOne(ROLE_URL).flush(role);
    http.expectOne(CATALOG_URL).flush(CATALOG);
    await settle();
  }

  afterEach(() => {
    http.verify();
  });

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function dialog(): HTMLDialogElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('dialog');
    if (element == null) {
      throw new Error('drawer not rendered');
    }
    return element;
  }

  function query(selector: string): HTMLElement {
    const element = dialog().querySelector<HTMLElement>(selector);
    if (element == null) {
      throw new Error(`${selector} not rendered`);
    }
    return element;
  }

  function maybe(selector: string): HTMLElement | null {
    return dialog().querySelector<HTMLElement>(selector);
  }

  /** Save in the editor, Edit in view mode: the toolbar's last button either way. */
  function primaryAction(): HTMLElement {
    return query('.drawer-actions-end button:last-of-type');
  }

  function cancelAction(): HTMLElement {
    return query('.drawer-actions-end button:first-of-type');
  }

  it('opens in view mode: the role read back, and no control to edit it with', async () => {
    await build();

    const values = [...dialog().querySelectorAll('.role-view-value')].map((dd) =>
      dd.textContent.trim(),
    );
    expect(values).toEqual(['Receptionist', 'Front desk']);

    // Nothing here is a control, so there is no form and no input to be refused by.
    expect(maybe('#role-name')).toBeNull();
    expect(maybe('form')).toBeNull();
  });

  it('shows only the codes the role holds, not the whole catalog', async () => {
    await build();

    // The catalog has three codes across two categories; this role holds one of them.
    expect(dialog().querySelectorAll('.tree-item')).toHaveLength(2);
    expect(dialog().textContent).toContain('Cancel appointments');
    expect(dialog().textContent).not.toContain('Book appointments');
  });

  it('keeps the view tree readable rather than disabled', async () => {
    await build();

    // Readonly, so arrow navigation, typeahead and expansion all still work. Angular Aria
    // always writes `aria-disabled`, so what matters is that it is not `true`.
    expect(query('[role="tree"]').getAttribute('aria-readonly')).toBe('true');
    expect(query('[role="tree"]').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('offers one action in view mode, and it is the way into the editor', async () => {
    await build();
    expect(dialog().querySelectorAll('.drawer-actions-end button')).toHaveLength(1);
  });

  it('withholds edit on a role the server says is not editable', async () => {
    // A platform or system role: usable, never editable, and `isEditable` is the whole answer.
    await build({ ...ROLE, ownerId: null, isSystem: true, isEditable: false });

    expect(dialog().querySelectorAll('.drawer-actions-end button')).toHaveLength(0);
  });

  it('withholds edit from a user without roles:update', async () => {
    granted = ['roles:read'];
    await build();

    expect(dialog().querySelectorAll('.drawer-actions-end button')).toHaveLength(0);
  });

  it('reads a seeded role under its translated name, with no description beside it', async () => {
    await open();
    // Before the role arrives: the name is translated imperatively, so a dictionary that lands
    // later would leave it in English.
    TestBed.inject(TranslocoService).setTranslation(
      { managementRoles: { roleNames: { staff: 'Μέλος προσωπικού' } } },
      'el',
    );
    http
      .expectOne(ROLE_URL)
      .flush({ ...ROLE, name: 'staff', ownerId: null, isSystem: true, isEditable: false });
    http.expectOne(CATALOG_URL).flush(CATALOG);
    await settle();

    const values = [...dialog().querySelectorAll('.role-view-value')].map((dd) =>
      dd.textContent.trim(),
    );
    // One field and not two: the role's description is the English of this very label, so
    // showing it would print the same thing twice.
    expect(values).toEqual(['Μέλος προσωπικού']);
  });

  it('turns into the editor, prefilled from the role, without closing', async () => {
    await build();
    primaryAction().click();
    await settle();

    expect(dialog().open).toBe(true);
    expect((query('#role-name') as HTMLInputElement).value).toBe('Receptionist');
    expect((query('#role-description') as HTMLTextAreaElement).value).toBe('Front desk');
    // The editor offers the whole catalog, which is what a full replace is authored against.
    expect(dialog().textContent).toContain('Book appointments');
    expect(dialog().querySelectorAll('.drawer-actions-end button')).toHaveLength(2);
  });

  it('takes cancel back to view mode instead of closing the drawer', async () => {
    await build();
    primaryAction().click();
    await settle();

    cancelAction().click();
    await settle();

    // Back to reading it, and the panel never went away.
    expect(dialog().open).toBe(true);
    expect(maybe('#role-name')).toBeNull();
    expect(query('.role-view-value').textContent.trim()).toBe('Receptionist');
  });

  it('throws away what cancel abandoned, so reopening shows the role again', async () => {
    await build();
    primaryAction().click();
    await settle();

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Abandoned';
    name.dispatchEvent(new Event('input'));
    await settle();

    cancelAction().click();
    await settle();
    primaryAction().click();
    await settle();

    expect((query('#role-name') as HTMLInputElement).value).toBe('Receptionist');
  });

  it('starts a fresh editor silent, whatever the last one reported', async () => {
    await build();
    primaryAction().click();
    await settle();

    // Empty the name and get it refused, so the editor is reporting.
    const name = query('#role-name') as HTMLInputElement;
    name.value = '';
    name.dispatchEvent(new Event('input'));
    await settle();
    primaryAction().click();
    await settle();
    expect(maybe('.field-error')).not.toBeNull();
    http.expectNone(ROLE_URL);

    // Leaving and re-entering the editor is a new attempt, so it accuses nothing yet.
    cancelAction().click();
    await settle();
    primaryAction().click();
    await settle();

    expect(maybe('.field-error')).toBeNull();
  });

  it('saves the complete set as a full replace, then returns to view', async () => {
    await build();
    primaryAction().click();
    await settle();

    // Tick the other code in the same category. The role keeps the one it already had.
    const rows = [...dialog().querySelectorAll('.tree-item')];
    const grantable = rows.find((row) => row.textContent.includes('Book appointments'));
    if (grantable == null) {
      throw new Error('the grantable code is not rendered');
    }
    grantable.querySelector<HTMLElement>('.tree-indicator')?.click();
    await settle();

    primaryAction().click();
    await settle();

    const request = http.expectOne(ROLE_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: 'Receptionist',
      description: 'Front desk',
      // Both codes, not the one that changed: the endpoint replaces rather than patches.
      permissions: ['appointments:create', 'appointments:cancel'],
    });

    request.flush({ ...ROLE, permissions: ['appointments:create', 'appointments:cancel'] });
    await settle();

    expect(dialog().open).toBe(true);
    expect(maybe('#role-name')).toBeNull();
    expect(TestBed.inject(ToasterService).toasts()).toHaveLength(1);
  });

  it('reads the saved role out of the response rather than asking for it again', async () => {
    await build();
    primaryAction().click();
    await settle();

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'Front of house';
    name.dispatchEvent(new Event('input'));
    await settle();

    primaryAction().click();
    await settle();
    http.expectOne(ROLE_URL).flush({ ...ROLE, name: 'Front of house' });
    await settle();

    // No second GET: the write answered with the role, so view mode already has it.
    http.expectNone(ROLE_URL);
    expect(query('.role-view-value').textContent.trim()).toBe('Front of house');
  });

  it('stays in the editor when the save is refused, keeping what was typed', async () => {
    await build();
    primaryAction().click();
    await settle();

    const name = query('#role-name') as HTMLInputElement;
    name.value = 'company_admin';
    name.dispatchEvent(new Event('input'));
    await settle();

    primaryAction().click();
    await settle();

    http
      .expectOne(ROLE_URL)
      .flush(
        { title: 'ROLE_NAME_TAKEN', status: 409, detail: 'That name is taken.' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    // Dropping back to view here would throw away the edit over a fixable mistake.
    expect((query('#role-name') as HTMLInputElement).value).toBe('company_admin');
    expect(query('.field-error').textContent.trim().length).toBeGreaterThan(0);
    expect(TestBed.inject(ToasterService).toasts()).toHaveLength(0);
  });

  it('reports a role it could not load, and offers nothing to act on it with', async () => {
    await open();

    // Another company's role is a 404 and not a 403: the row is filtered before the handler.
    http.expectOne(ROLE_URL).flush(null, { status: 404, statusText: 'Not Found' });
    http.expectOne(CATALOG_URL).flush(CATALOG);
    await settle();

    const notice = query('.role-load-error');
    expect(notice.textContent.trim().length).toBeGreaterThan(0);
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.getAttribute('data-tone')).toBe('error');
    expect(maybe('.role-view-row')).toBeNull();
    expect(dialog().querySelectorAll('.drawer-actions-end button')).toHaveLength(0);
  });
});

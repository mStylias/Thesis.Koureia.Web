import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom } from 'rxjs';

import { companyScopeInterceptor } from './company-scope.interceptor';
import { StaffAccessStore } from './staff-access.store';
import { WorkspaceCompanyChoice } from './workspace-company-choice';

const API = 'https://api.test/api/v1';
const WORKSPACE_URL = `${API}/users/me/workspace`;
const ROLES_URL = `${API}/roles/odata`;

const NOT_FOUND = { status: 404, statusText: 'Not Found' };
const COMPANY_NOT_FOUND_BODY = { title: 'COMPANY_NOT_FOUND', status: 404 };

describe('companyScopeInterceptor', () => {
  let picked: WritableSignal<string | null>;
  let reload: ReturnType<typeof vi.fn>;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    picked = signal<string | null>('c1');
    reload = vi.fn(() => Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([companyScopeInterceptor])),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        {
          provide: WorkspaceCompanyChoice,
          useValue: {
            companyId: picked.asReadonly(),
            clear: () => {
              picked.set(null);
            },
          },
        },
        { provide: StaffAccessStore, useValue: { reload } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('sends the picked shop to the API', () => {
    void firstValueFrom(http.get(ROLES_URL));

    expect(backend.expectOne(ROLES_URL).request.headers.get('X-Company-Id')).toBe('c1');
  });

  it('sends nothing when no shop is picked', () => {
    picked.set(null);
    void firstValueFrom(http.get(ROLES_URL));

    expect(backend.expectOne(ROLES_URL).request.headers.has('X-Company-Id')).toBe(false);
  });

  it('never sends the shop to another host', () => {
    void firstValueFrom(http.get('https://tiles.example.test/style.json'));

    const request = backend.expectOne('https://tiles.example.test/style.json').request;
    expect(request.headers.has('X-Company-Id')).toBe(false);
  });

  it('clears a deleted shop on the workspace read, and asks again without it', async () => {
    const response = firstValueFrom(http.get(WORKSPACE_URL));

    backend.expectOne(WORKSPACE_URL).flush(COMPANY_NOT_FOUND_BODY, NOT_FOUND);

    const retry = backend.expectOne(WORKSPACE_URL);
    expect(retry.request.headers.has('X-Company-Id')).toBe(false);
    retry.flush({ company: null, permissions: [], isPlatformAdmin: true });

    await expect(response).resolves.toEqual({
      company: null,
      permissions: [],
      isPlatformAdmin: true,
    });
    expect(picked()).toBeNull();
  });

  // A public slug route answers the same code for an unknown slug. Only the workspace read can
  // prove the pick is gone.
  it('asks the workspace on a company call, and keeps the pick', async () => {
    const response = firstValueFrom(http.get(ROLES_URL));

    backend.expectOne(ROLES_URL).flush(COMPANY_NOT_FOUND_BODY, NOT_FOUND);

    await expect(response).rejects.toBeTruthy();
    expect(reload).toHaveBeenCalledOnce();
    expect(picked()).toBe('c1');
  });

  it('passes any other failure through', async () => {
    const response = firstValueFrom(http.get(ROLES_URL));

    backend.expectOne(ROLES_URL).flush({ title: 'ROLE_NOT_FOUND', status: 404 }, NOT_FOUND);

    await expect(response).rejects.toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });
});

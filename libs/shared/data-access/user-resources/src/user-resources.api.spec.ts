import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';

import { UserResourcesApi } from './user-resources.api';
import type { UserResourceResponse } from './user-resources.types';

const BASE = 'https://api.test/api/v1/users/me/resources';

function resource(overrides: Partial<UserResourceResponse> = {}): UserResourceResponse {
  return {
    id: 'resource-1',
    userId: 'user-1',
    name: 'roles_main_grid_views',
    description: null,
    value: { views: [] },
    isShared: false,
    createdAt: '2026-08-19T09:14:22.113Z',
    updatedAt: null,
    ...overrides,
  };
}

describe('UserResourcesApi', () => {
  let api: UserResourcesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(UserResourcesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists from the versioned route', () => {
    api.list().subscribe();

    expect(http.expectOne(BASE).request.method).toBe('GET');
  });

  it('looks a name up through the OData route, oldest first', () => {
    api.findByName('roles_main_grid_views').subscribe();

    const request = http.expectOne(
      `${BASE}/odata?$filter=name eq 'roles_main_grid_views'&$orderby=createdAt&$top=1`,
    );
    expect(request.request.method).toBe('GET');
  });

  it('doubles a quote in the name, so it cannot end the OData literal', () => {
    api.findByName("bob's_grid_views").subscribe();

    http.expectOne(`${BASE}/odata?$filter=name eq 'bob''s_grid_views'&$orderby=createdAt&$top=1`);
  });

  it('unwraps the OData envelope to the first row', async () => {
    const found = firstEmission(api.findByName('roles_main_grid_views'));

    http
      .expectOne(`${BASE}/odata?$filter=name eq 'roles_main_grid_views'&$orderby=createdAt&$top=1`)
      .flush({ value: [resource()] });

    expect((await found)?.id).toBe('resource-1');
  });

  it('answers null rather than undefined when nothing is stored under the name', async () => {
    const found = firstEmission(api.findByName('absent_views'));

    http
      .expectOne(`${BASE}/odata?$filter=name eq 'absent_views'&$orderby=createdAt&$top=1`)
      .flush({ value: [] });

    expect(await found).toBeNull();
  });

  it('creates with the body it was given', () => {
    api.create({ name: 'roles_main_grid_views', value: { views: [] } }).subscribe();

    const request = http.expectOne(BASE);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'roles_main_grid_views',
      value: { views: [] },
    });
  });

  it('patches only what it was handed, so an omitted property is left alone', () => {
    api.patch('resource-1', { value: { views: [1] } }).subscribe();

    const request = http.expectOne(`${BASE}/resource-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ value: { views: [1] } });
  });

  it('deletes by id', () => {
    api.remove('resource-1').subscribe();

    expect(http.expectOne(`${BASE}/resource-1`).request.method).toBe('DELETE');
  });
});

/** Resolves with the first emission, subscribing before the request is flushed. */
function firstEmission<T>(source: { subscribe(next: (value: T) => void): unknown }): Promise<T> {
  return new Promise<T>((resolve) => {
    source.subscribe(resolve);
  });
}

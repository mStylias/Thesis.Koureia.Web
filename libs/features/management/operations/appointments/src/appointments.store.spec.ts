/**
 * The grid's source against the wire: each header and row filter as the endpoint receives it.
 * The backend plan's §8 lists the same forms.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { AppointmentsApi } from '@api/appointments';
import { odataQueryString, Result, type ODataQuery } from '@synax/client/core';
import { where, type FilterNode } from '@ui/data-source';
import { of } from 'rxjs';

import { AppointmentsStore } from './appointments.store';

const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

describe('the appointments source', () => {
  const sent = signal<ODataQuery | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppointmentsStore,
        provideTransloco({ config: { availableLangs: ['el'], defaultLang: 'el' } }),
        {
          provide: AppointmentsApi,
          useValue: {
            grid: (query: ODataQuery) => {
              sent.set(query);
              return of(Result.Ok({ items: [], totalCount: 0 }));
            },
            services: (query: ODataQuery) => {
              sent.set(query);
              return of(Result.Ok({ items: [], totalCount: 0 }));
            },
          },
        },
      ],
    });
  });

  async function filterFor(node: FilterNode): Promise<string> {
    await TestBed.inject(AppointmentsStore).appointments.load({ filter: node, skip: 0, take: 25 });
    const query = sent();
    if (query === null) {
      throw new Error('nothing was sent');
    }
    return decodeURIComponent(odataQueryString({ filter: query.filter }));
  }

  it('sends a customer as a bare GUID', async () => {
    expect(await filterFor(where('customerId', 'in', [ID]))).toBe(`?$filter=customerId in (${ID})`);
  });

  it('tests any service of the appointment', async () => {
    expect(await filterFor(where('services.serviceId', 'in', [ID]))).toBe(
      `?$filter=services/any(services:services/serviceId in (${ID}))`,
    );
  });

  it('searches the cancellation reason folded, on its twin', async () => {
    expect(await filterFor(where('cancellationReason', 'contains', 'Άρρωστος'))).toBe(
      "?$filter=contains(cancellationReasonNormalized,'αρρωστος')",
    );
  });

  it('reads "not rated" as a missing rating', async () => {
    expect(await filterFor(where('rating', 'isNull'))).toBe('?$filter=rating eq null');
  });

  it('folds and quotes a service search, which the server parses as one phrase', async () => {
    await TestBed.inject(AppointmentsStore).services.load({
      search: 'ΚΟΥΡΕΜΑ 2',
      skip: 0,
      take: 20,
    });
    expect(sent()?.search).toBe('"κουρεμα 2"');
  });
});

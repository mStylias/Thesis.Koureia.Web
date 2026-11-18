/**
 * The grid's source against the wire: each header and row filter as the endpoint receives it.
 * The backend plan's §8 lists the same forms.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { ServicesApi } from '@api/services';
import { odataQueryString, Result, type ODataQuery } from '@synax/client/core';
import { where, type FilterNode } from '@ui/data-source';
import { of } from 'rxjs';

import { ServicesStore } from './services.store';

const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

describe('the services source', () => {
  const sent = signal<ODataQuery | null>(null);
  const options = signal<Result<unknown>>(Result.Ok({}));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServicesStore,
        provideTransloco({ config: { availableLangs: ['el'], defaultLang: 'el' } }),
        {
          provide: ServicesApi,
          useValue: {
            grid: (query: ODataQuery) => {
              sent.set(query);
              return of(Result.Ok({ items: [], totalCount: 0 }));
            },
            options: () => of(options()),
          },
        },
      ],
    });
  });

  async function filterFor(node: FilterNode): Promise<string> {
    await TestBed.inject(ServicesStore).services.load({ filter: node, skip: 0, take: 25 });
    const query = sent();
    if (query === null) {
      throw new Error('nothing was sent');
    }
    return decodeURIComponent(odataQueryString({ filter: query.filter }));
  }

  it('sends a category as a bare GUID', async () => {
    expect(await filterFor(where('categoryId', 'in', [ID]))).toBe(`?$filter=categoryId in (${ID})`);
  });

  it('reads "Uncategorized" as a missing category', async () => {
    expect(await filterFor(where('categoryId', 'isNull'))).toBe('?$filter=categoryId eq null');
  });

  it('tests any barber of the service', async () => {
    expect(await filterFor(where('staff.staffMemberId', 'in', [ID]))).toBe(
      `?$filter=staff/any(staff:staff/staffMemberId in (${ID}))`,
    );
  });

  it('searches the name folded, on its twin', async () => {
    expect(await filterFor(where('name', 'contains', 'Κούρεμα'))).toBe(
      "?$filter=contains(nameNormalized,'κουρεμα')",
    );
  });

  it('sends a status as a boolean', async () => {
    expect(await filterFor(where('isBookableOnline', 'eq', false))).toBe(
      '?$filter=isBookableOnline eq false',
    );
  });

  it('keeps no options after a failed read, and says so', async () => {
    options.set(Result.Fail({ errorCode: 'HTTP_500', httpCode: 500, validationErrors: [] }));
    const store = TestBed.inject(ServicesStore);

    await store.loadOptions();

    expect(store.options()).toBeNull();
    expect(store.optionsFailed()).toBe(true);
    expect(store.currency()).toBe('EUR');
  });

  it('bumps the revision the grid reloads on', () => {
    const store = TestBed.inject(ServicesStore);
    store.reload();
    expect(store.revision()).toBe(1);
  });
});

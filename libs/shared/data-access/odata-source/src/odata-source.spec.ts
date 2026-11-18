/**
 * The source as a whole, asserted on the query strings it emitted and the result it produced.
 */
import { where, type DataSource, type LoadRequest } from '@ui/data-source';
import type { ODataRow } from '@synax/client/core';
import { ODataRequestError } from './fetch';
import { odataSource } from './odata-source';
import type { UnsupportedReport } from './options';
import { erroringFetch, fakeEndpoint, httpFailure, roleRow } from './test-fetch';

interface Role {
  id: string;
  name: string;
  numberOfUsers: number;
}

const ROLE_A = roleRow('11111111-1111-4111-8111-111111111111', 'company_admin', 3);
const ROLE_B = roleRow('22222222-2222-4222-8222-222222222222', 'staff', 0);

/** A request wide enough for a grid, which the source reads structurally. */
type GridRequest = LoadRequest & {
  group?: readonly { field: string; desc?: boolean }[];
  aggregates?: readonly { field: string; type: string; custom?: string }[];
};

function load(source: DataSource<Role>, request: GridRequest): Promise<unknown> {
  return source.load(request);
}

describe('the base query', () => {
  it('sends the window, the count and the ordering', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A], totalCount: 7 });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    await source.load({ skip: 10, take: 20, requireTotalCount: true, sort: [{ field: 'name' }] });

    expect(endpoint.url()).toBe('?$orderby=name&$count=true&$top=20&$skip=10');
  });

  it('orders by a nested path with a direction, which only the string form expresses', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    await source.load({ sort: [{ field: 'customer.name', desc: true }, { field: 'id' }] });

    expect(endpoint.url()).toBe('?$orderby=customer/name desc,id&$top=100&$skip=0');
  });

  it('folds a projection into a nested expand, because $select rejects a dot path', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    await source.load({ select: ['id', 'customer.name'], expand: ['tables'] });

    expect(endpoint.url()).toBe(
      '?$select=id&$expand=tables,customer($select=name)&$top=100&$skip=0',
    );
  });

  it('reports the rows and the count it was given', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A, ROLE_B], totalCount: 2 });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    const result = await source.load({ requireTotalCount: true });

    expect(result.rows).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('reports hasMore from a server-driven next link', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A], nextLink: 'https://api/next' });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    const result = await source.load({ take: 100 });

    expect(result.hasMore).toBe(true);
  });
});

describe('the $top cap', () => {
  // The regression for a silently truncated export: ask for 1000, receive the server's 100,
  // and a source that stopped there would report a complete result.
  it('pages a window past maxTop and concatenates it', async () => {
    const page = (index: number): readonly ODataRow[] =>
      Array.from({ length: 100 }, (_, offset) =>
        roleRow(`id-${(index * 100 + offset).toString()}`, 'role'),
      );
    const endpoint = fakeEndpoint<Role>({
      rows: (_url, call) => (call < 3 ? page(call) : []),
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { maxTop: 100 },
    });

    const result = await source.load({ skip: 0, take: 1000 });

    // Three full pages, then a short one that ends the result.
    expect(result.rows).toHaveLength(300);
    expect(endpoint.count()).toBe(4);
    expect(endpoint.calls[0].url).toContain('$top=100');
    expect(endpoint.calls[1].url).toContain('$skip=100');
    expect(endpoint.calls[2].url).toContain('$skip=200');
  });

  it('never asks for more than the cap allows', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { maxTop: 50 },
    });

    await source.load({ take: 1000 });

    expect(endpoint.url()).toContain('$top=50');
  });

  it('stops at the window the caller asked for, not at the page boundary', async () => {
    const endpoint = fakeEndpoint<Role>({
      rows: () => Array.from({ length: 10 }, (_, index) => roleRow(`id-${index.toString()}`, 'r')),
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { maxTop: 10 },
    });

    const result = await source.load({ take: 25 });

    // 10 + 10 + 5: the last request asks for the remainder and not a full page.
    expect(endpoint.count()).toBe(3);
    expect(endpoint.calls[2].url).toContain('$top=5');
    expect(result.rows).toHaveLength(25);
  });

  it('defaults the cap to the server default rather than assuming none', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    await source.load({ take: 1000 });

    expect(endpoint.url()).toContain('$top=100');
  });
});

describe('search', () => {
  it('folds the needle and targets the declared normalized fields', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      searchFields: ['nameNormalized'],
    });

    await source.load({ search: 'Αθήνα' });

    // Folded, because the server's `contains` is a bare LIKE against a folded column. The
    // literal reaches the wire percent-encoded, which is what `odataQueryString` documents and
    // why its result is appended to the URL rather than handed to a params encoder.
    expect(endpoint.url()).toContain('%CE%B1%CE%B8%CE%B7%CE%BD%CE%B1');
    expect(decodeURIComponent(endpoint.url())).toBe(
      "?$filter=contains(nameNormalized,'αθηνα')&$top=100&$skip=0",
    );
  });

  it('searches several fields with an or', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      searchFields: ['nameNormalized', 'descriptionNormalized'],
    });

    await source.load({ search: 'admin' });

    expect(endpoint.url()).toBe(
      "?$filter=((contains(nameNormalized,'admin')) or " +
        "(contains(descriptionNormalized,'admin')))&$top=100&$skip=0",
    );
  });

  it('combines the search with the user filter rather than replacing it', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      searchFields: ['nameNormalized'],
    });

    await source.load({ filter: where('isSystem', 'eq', true), search: 'admin' });

    expect(endpoint.url()).toBe(
      "?$filter=((isSystem eq true) and (contains(nameNormalized,'admin')))&$top=100&$skip=0",
    );
  });

  it('sends $search unfolded where the endpoint answers it', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { search: true },
    });

    // Not folded: `$search` has its own grammar and lowercasing would turn OR into a term.
    await source.load({ search: 'manager OR "booking admin"' });

    expect(endpoint.url()).toContain('$search=manager%20OR%20%22booking%20admin%22');
  });

  it('drops a search it cannot express, and says so once', async () => {
    const reports: UnsupportedReport[] = [];
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      onUnsupported: (report) => reports.push(report),
    });

    await source.load({ search: 'admin' });

    expect(endpoint.url()).toBe('?$top=100&$skip=0');
    expect(reports).toHaveLength(1);
    expect(reports[0].facet).toBe('search');
  });
});

describe('byKeys', () => {
  it('resolves a single-field key with in', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A, ROLE_B] });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    const found = await source.byKeys?.([ROLE_A['id'] as string, ROLE_B['id'] as string]);

    expect(endpoint.url()).toContain('$filter=id in (');
    expect(found).toHaveLength(2);
  });

  it('emits a uuid key unquoted, which is the form the server accepts', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: { selector: 'id', type: 'uuid' },
    });

    await source.byKeys?.([ROLE_A['id'] as string]);

    expect(endpoint.url()).toBe(
      '?$filter=id in (11111111-1111-4111-8111-111111111111)&$top=1&$skip=0',
    );
  });

  it('quotes a string key, which is equally the form the server accepts', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    await source.byKeys?.(['abc']);

    expect(endpoint.url()).toContain("$filter=id in ('abc')");
  });

  it('expands a composite key into an or of and groups, because in compares one member', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [] });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: ['code', 'region'] });

    await source.byKeys?.(['["X1","EU"]', '["X2","US"]']);

    expect(endpoint.url()).toContain(
      "$filter=((((code eq 'X1') and (region eq 'EU'))) or (((code eq 'X2') and (region eq 'US'))))",
    );
  });

  it('splits a lookup past the batch size rather than building a filter the server refuses', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      keyBatchSize: 2,
      capabilities: { maxTop: 100 },
    });

    await source.byKeys?.(['a', 'b', 'c', 'd', 'e']);

    expect(endpoint.count()).toBe(3);
  });

  it('asks nothing at all for no keys', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    const found = await source.byKeys?.([]);

    expect(found).toEqual([]);
    expect(endpoint.count()).toBe(0);
  });

  it('returns items in the order the keys were asked for', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A, ROLE_B] });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    const found = await source.byKeys?.([ROLE_B['id'] as string, ROLE_A['id'] as string]);

    expect(found?.map((role) => role.name)).toEqual(['staff', 'company_admin']);
  });

  it('refuses a function key rather than filtering on a field it cannot name', async () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: (role) => role.id });

    await expect(source.byKeys?.(['a'])).rejects.toThrow(/field-based key/);
  });
});

describe('aggregates', () => {
  it('asks in a second request, because $apply replaces the result set', async () => {
    const endpoint = fakeEndpoint<Role>({
      rows: (url) =>
        url.includes('$apply') ? [{ numberOfUsers_sum: 12, count_all: 4 }] : [ROLE_A],
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    const result = (await load(source, {
      aggregates: [
        { field: 'numberOfUsers', type: 'sum' },
        { field: 'id', type: 'count' },
      ],
    })) as { aggregates?: Record<string, unknown> };

    expect(endpoint.count()).toBe(2);
    const applyCall = endpoint.calls.find((call) => call.url.includes('$apply'));
    expect(applyCall?.url).toBe(
      '?$apply=aggregate(numberOfUsers with sum as numberOfUsers_sum,$count as count_all)',
    );
    // Mapped back onto the consumer's own key, which is not a legal OData alias.
    expect(result.aggregates?.['numberOfUsers:sum']).toBe(12);
    expect(result.aggregates?.['id:count']).toBe(4);
  });

  it('puts the filter inside the transform, never beside it', async () => {
    const endpoint = fakeEndpoint<Role>({
      rows: (url) => (url.includes('$apply') ? [{ numberOfUsers_sum: 3 }] : []),
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    await load(source, {
      filter: where('isSystem', 'eq', true),
      aggregates: [{ field: 'numberOfUsers', type: 'sum' }],
    });

    // A sibling $filter applies to the aggregated result and answers a different question.
    const applyCall = endpoint.calls.find((call) => call.url.includes('$apply'));
    expect(applyCall?.url).toBe(
      '?$apply=filter(isSystem eq true)/aggregate(numberOfUsers with sum as numberOfUsers_sum)',
    );
  });

  it('asks for nothing and reports it when the endpoint has no $apply', async () => {
    const reports: UnsupportedReport[] = [];
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      onUnsupported: (report) => reports.push(report),
    });

    const result = (await load(source, {
      aggregates: [{ field: 'numberOfUsers', type: 'sum' }],
    })) as { aggregates?: unknown };

    // One request, no aggregate, and nothing rather than a page-local total.
    expect(endpoint.count()).toBe(1);
    expect(result.aggregates).toBeUndefined();
    expect(reports.map((report) => report.facet)).toEqual(['aggregate']);
  });

  it('reports a custom aggregate as unsupported instead of dropping it quietly', async () => {
    const reports: UnsupportedReport[] = [];
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
      onUnsupported: (report) => reports.push(report),
    });

    await load(source, {
      aggregates: [{ field: 'numberOfUsers', type: 'custom', custom: 'median' }],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].facet).toBe('aggregate');
    expect(reports[0].reason).toContain('numberOfUsers');
    // Nothing expressible, so no second request went out.
    expect(endpoint.count()).toBe(1);
  });

  it('translates avg to OData average', async () => {
    const endpoint = fakeEndpoint<Role>({
      rows: (url) => (url.includes('$apply') ? [{ numberOfUsers_avg: 2 }] : []),
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    await load(source, { aggregates: [{ field: 'numberOfUsers', type: 'avg' }] });

    const applyCall = endpoint.calls.find((call) => call.url.includes('$apply'));
    expect(applyCall?.url).toContain('with average as numberOfUsers_avg');
  });
});

describe('grouping', () => {
  it('sends the group fields as an ordering prefix and says the rows need local grouping', async () => {
    const reports: UnsupportedReport[] = [];
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      onUnsupported: (report) => reports.push(report),
    });

    await load(source, { group: [{ field: 'isSystem' }], sort: [{ field: 'name' }] });

    expect(endpoint.url()).toBe('?$orderby=isSystem,name&$top=100&$skip=0');
    expect(reports.map((report) => report.facet)).toEqual(['grouping']);
  });
});

describe('loadDistinct', () => {
  it('is absent without $apply, so a consumer falls back rather than breaking', () => {
    const endpoint = fakeEndpoint<Role>();
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    // Presence is the capability. A method that threw would break a header-filter panel.
    expect(typeof source.loadDistinct).toBe('undefined');
  });

  it('groups the field and counts each value', async () => {
    const endpoint = fakeEndpoint<Role>({
      rows: [
        { name: 'company_admin', count: 3 },
        { name: 'staff', count: 1 },
      ],
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    const result = await source.loadDistinct?.({ field: 'name', take: 51 });

    expect(endpoint.url()).toBe(
      '?$apply=groupby((name),aggregate($count as count))&$orderby=name&$top=51&$skip=0',
    );
    expect(result?.values).toEqual([
      { value: 'company_admin', count: 3 },
      { value: 'staff', count: 1 },
    ]);
  });

  it('sends no $count, which is unreliable under $apply', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    await source.loadDistinct?.({ field: 'name', take: 11 });

    expect(endpoint.url()).not.toContain('$count=true');
  });

  it('applies the pre-group filter inside the transform', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    await source.loadDistinct?.({ field: 'name', filter: where('isSystem', 'eq', true) });

    expect(endpoint.url()).toBe(
      '?$apply=filter(isSystem eq true)/groupby((name),aggregate($count as count))&$orderby=name&$skip=0',
    );
  });

  it('infers another page from the extra entry it asked for', async () => {
    const endpoint = fakeEndpoint<Role>({
      rows: Array.from({ length: 3 }, (_, index) => ({ name: `n${index.toString()}`, count: 1 })),
    });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
    });

    const result = await source.loadDistinct?.({ field: 'name', take: 3 });

    expect(result?.hasMore).toBe(true);
  });

  it('reports that it cannot bucket without compute', async () => {
    const reports: UnsupportedReport[] = [];
    const endpoint = fakeEndpoint<Role>({ rows: [] });
    const source = odataSource<Role>({
      fetch: endpoint.fetch,
      key: 'id',
      capabilities: { apply: true },
      onUnsupported: (report) => reports.push(report),
    });

    await source.loadDistinct?.({ field: 'createdAt', interval: 'month' });

    expect(reports.map((report) => report.facet)).toEqual(['interval']);
  });
});

describe('failures and cancellation', () => {
  it('rejects with the HttpError rather than resolving an empty page', async () => {
    const endpoint = fakeEndpoint<Role>({
      fail: httpFailure(400, 'INVALID_ODATA_QUERY', 'Query option Apply is not allowed.'),
    });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });

    await expect(source.load({})).rejects.toThrow(ODataRequestError);
    await expect(source.load({})).rejects.toMatchObject({
      httpError: { errorCode: 'INVALID_ODATA_QUERY', httpCode: 400 },
    });
  });

  it('surfaces a hand-written fetch that errors instead of reporting a Result', async () => {
    const source = odataSource<Role>({
      fetch: erroringFetch(new Error('offline')),
      key: 'id',
    });

    await expect(source.load({})).rejects.toThrow('offline');
  });

  it('unsubscribes on abort, which is what actually cancels the request', async () => {
    const endpoint = fakeEndpoint<Role>({ hang: true });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });
    const controller = new AbortController();

    const pending = source.load({ signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow();
    // A promise that merely stopped listening would leave the request in flight.
    expect(endpoint.unsubscribed()).toBe(1);
  });

  it('asks nothing when the signal has already fired', async () => {
    const endpoint = fakeEndpoint<Role>({ rows: [ROLE_A] });
    const source = odataSource<Role>({ fetch: endpoint.fetch, key: 'id' });
    const controller = new AbortController();
    controller.abort();

    await expect(source.load({ signal: controller.signal })).rejects.toThrow();
    expect(endpoint.count()).toBe(0);
  });
});

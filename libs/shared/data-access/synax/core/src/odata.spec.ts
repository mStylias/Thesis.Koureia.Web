import {
  guid,
  ODataPage,
  type ODataQuery,
  ODataRow,
  odataQueryString,
  odataResult,
  odataTransform,
  raw,
  StandardAggregateMethods,
} from './odata';

describe('odataResult', () => {
  it('normalizes the OData envelope, keeping the count when $count was requested', () => {
    // The body the demo API returns for /api/v1/restaurants/search?$count=true.
    const page: ODataPage<{ name: string }> = { value: [{ name: 'La Tavola' }], '@odata.count': 1 };

    expect(odataResult(page)).toEqual({ items: [{ name: 'La Tavola' }], totalCount: 1 });
  });

  it('reports a null total when $count was not requested', () => {
    expect(odataResult({ value: [] })).toEqual({ items: [], totalCount: null });
  });

  it('handles $select rows as plain dictionaries', () => {
    const page: ODataPage<ODataRow> = { value: [{ name: 'La Tavola' }] };

    expect(odataResult(page).items[0]['name']).toBe('La Tavola');
  });

  it('keeps annotations and the server-driven next link', () => {
    const page: ODataPage<ODataRow> = {
      '@odata.context': '/odata/$metadata#restaurants(name)',
      value: [
        {
          name: 'La Tavola',
          '@odata.id': "/odata/restaurants('restaurant-1')",
          '@odata.type': '#Booking.Restaurant',
        },
      ],
      '@odata.nextLink': '/api/v1/restaurants/search?$skiptoken=id-restaurant-1',
    };

    expect(odataResult(page)).toEqual({
      items: page.value,
      totalCount: null,
      context: '/odata/$metadata#restaurants(name)',
      nextLink: '/api/v1/restaurants/search?$skiptoken=id-restaurant-1',
    });
  });
});

interface Restaurant {
  name: string;
  address: string;
  createdAt: string;
  ownerId: string;
  maxCapacity: number;
}

/**
 * Splits the query string into its options. The order of the parameters is not part of the
 * contract, but each option's value is, so compare them as a map.
 */
function options(query: string): Record<string, string> {
  const entries = query.replace(/^\?/, '').split('&');
  return Object.fromEntries(
    entries.map((entry) => {
      const separator = entry.indexOf('=');
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
}

describe('odataQueryString', () => {
  it('builds the $-prefixed query string', () => {
    const query = odataQueryString<Restaurant>({
      filter: "contains(name,'Tav')",
      orderBy: 'createdAt desc',
      top: 20,
      skip: 40,
      count: true,
      select: ['name', 'address'],
      expand: 'tables',
    });

    expect(query.startsWith('?')).toBe(true);
    expect(options(query)).toEqual({
      $filter: "contains(name,'Tav')",
      $orderby: 'createdAt desc',
      $select: 'name,address',
      $expand: 'tables',
      $count: 'true',
      $top: '20',
      $skip: '40',
    });
  });

  it('builds a typed filter/groupby/aggregate $apply chain', () => {
    const transform = odataTransform<Restaurant>([
      { filter: { name: { contains: "O'Brien" } } },
      {
        groupBy: {
          properties: ['address'],
          transform: {
            aggregate: {
              maxCapacity: { with: StandardAggregateMethods.sum, as: 'capacity' },
            },
          },
        },
      },
    ]);

    expect(odataQueryString<Restaurant>({ transform })).toBe(
      "?$apply=filter(contains(name,'O''Brien'))/groupby((address),aggregate(maxCapacity with sum as capacity))",
    );
  });

  it('passes through a raw $apply chain for transformations the dependency cannot model', () => {
    expect(
      odataQueryString<Restaurant>({
        transform:
          'compute(year(createdAt) as createdYear)/groupby((createdYear),aggregate($count as count))',
      }),
    ).toBe(
      '?$apply=compute(year(createdAt) as createdYear)/groupby((createdYear),aggregate($count as count))',
    );
  });

  it('serializes the top-level $compute option', () => {
    const query = odataQueryString<Restaurant>({
      compute: 'maxCapacity div 4 as tableCount',
      filter: 'tableCount ge 10',
      select: ['name', 'tableCount'],
    });

    expect(options(query)).toEqual({
      $filter: 'tableCount ge 10',
      $select: 'name,tableCount',
      $compute: 'maxCapacity div 4 as tableCount',
    });
  });

  it('serializes search, skiptoken, and json format', () => {
    const query = odataQueryString<Restaurant>({
      search: 'harbour OR "sea view"',
      skiptoken: "name-'Bistro',ownerId-00000000-0000-0000-0000-000000000001",
      format: 'json',
    });

    expect(options(query)).toEqual({
      $search: 'harbour%20OR%20%22sea%20view%22',
      $skiptoken: "name-'Bistro',ownerId-00000000-0000-0000-0000-000000000001",
      $format: 'json',
    });
  });

  it('escapes a quote in a structured filter value', () => {
    // Why structured filters exist: concatenated into a hand-written expression, this ends
    // the literal early and gives a 400.
    expect(odataQueryString<Restaurant>({ filter: { name: { contains: "O'Brien" } } })).toBe(
      "?$filter=contains(name,'O''Brien')",
    );
  });

  it('formats guid and raw values per the OData literal rules', () => {
    const id = '00000000-0000-0000-0000-000000000001';

    // A guid is bare, not quoted. raw passes an expression through unchanged.
    expect(odataQueryString<Restaurant>({ filter: { ownerId: guid(id) } })).toBe(
      `?$filter=ownerId eq ${id}`,
    );
    expect(odataQueryString<Restaurant>({ filter: { createdAt: raw('now()') } })).toBe(
      '?$filter=createdAt eq now()',
    );
  });

  it('accepts a hand-written filter string unchanged', () => {
    expect(odataQueryString<Restaurant>({ filter: "startswith(name,'A')" })).toBe(
      "?$filter=startswith(name,'A')",
    );
  });

  it('omits unset options and a false $count', () => {
    expect(odataQueryString<Restaurant>({ top: 0, count: false })).toBe('?$top=0');
  });

  it('returns an empty string for an empty query, so appending is always safe', () => {
    expect(odataQueryString<Restaurant>({})).toBe('');
    expect(`/restaurants/search${odataQueryString<Restaurant>({})}`).toBe('/restaurants/search');
  });

  it('passes an unknown member through, since the row type does not police names', () => {
    // This pins documented behavior. odata-query's Filter<T> unions an open PlainObject, so a
    // misspelled member type-checks and the server answers INVALID_ODATA_QUERY. If a later
    // version tightens the type, correct the doc comment on ODataQuery.
    const misspelled: ODataQuery<Restaurant> = { filter: { nmae: 'Tav' } };

    expect(odataQueryString(misspelled)).toBe("?$filter=nmae eq 'Tav'");
  });

  it('percent-encodes only inside string literals, leaving structure raw', () => {
    // Why the result goes on the URL and not into HttpParams: the literal is already
    // encoded, and a second encoding pass corrupts it.
    expect(odataQueryString<Restaurant>({ filter: { name: 'Tav Barbers' } })).toBe(
      "?$filter=name eq 'Tav%20Barbers'",
    );
    expect(odataQueryString<Restaurant>({ orderBy: 'createdAt desc' })).toBe(
      '?$orderby=createdAt desc',
    );
  });
});

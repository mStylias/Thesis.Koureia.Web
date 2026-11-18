/**
 * The filter translation, asserted on the **emitted query string**.
 *
 * The object `odata-query` is handed is an intermediate step; the string is what the server
 * parses. An assertion on the object would pass while the wire was wrong.
 */
import { and, not, or, where, type FilterNode } from '@ui/data-source';
import { odataQueryString } from '@synax/client/core';
import { odataPath } from './field';
import { toODataFilter, type FilterContext } from './filter';

const context: FilterContext = { path: odataPath };

/** The `$filter=` the node produces, or `''` when it constrains nothing. */
function emitted(node: FilterNode | null | undefined): string {
  const filter = toODataFilter(node, context);
  return filter === undefined ? '' : odataQueryString({ filter });
}

describe('comparison operators', () => {
  it('emits the six ordering operators under their own names', () => {
    expect(emitted(where('price', 'eq', 10))).toBe('?$filter=price eq 10');
    expect(emitted(where('price', 'ne', 10))).toBe('?$filter=price ne 10');
    expect(emitted(where('price', 'lt', 10))).toBe('?$filter=price lt 10');
    expect(emitted(where('price', 'le', 10))).toBe('?$filter=price le 10');
    expect(emitted(where('price', 'gt', 10))).toBe('?$filter=price gt 10');
    expect(emitted(where('price', 'ge', 10))).toBe('?$filter=price ge 10');
  });

  it('escapes a value rather than concatenating it', () => {
    // The whole reason the filter is structured. Concatenation would end the literal early
    // and produce an expression the server rejects, or worse, one it accepts.
    expect(emitted(where('name', 'contains', "O'Brien"))).toBe(
      "?$filter=contains(name,'O''Brien')",
    );
  });

  it('emits the string functions as calls', () => {
    expect(emitted(where('name', 'contains', 'a'))).toBe("?$filter=contains(name,'a')");
    expect(emitted(where('name', 'startsWith', 'a'))).toBe("?$filter=startswith(name,'a')");
    expect(emitted(where('name', 'endsWith', 'a'))).toBe("?$filter=endswith(name,'a')");
  });

  it('negates a contains rather than inventing an operator', () => {
    expect(emitted(where('name', 'notContains', 'a'))).toBe("?$filter=not (contains(name,'a'))");
  });

  it('puts both bounds of a range on one field', () => {
    expect(emitted(where('price', 'between', [10, 20]))).toBe(
      '?$filter=price ge 10 and price le 20',
    );
  });

  it('leaves an absent bound open', () => {
    expect(emitted(where('price', 'between', [10, null]))).toBe('?$filter=price ge 10');
    expect(emitted(where('price', 'between', [null, 20]))).toBe('?$filter=price le 20');
    // Neither bound constrains nothing, so no filter travels at all.
    expect(emitted(where('price', 'between', [null, null]))).toBe('');
  });

  it('emits membership as in, and negates it for notIn', () => {
    expect(emitted(where('id', 'in', [1, 2, 3]))).toBe('?$filter=id in (1,2,3)');
    expect(emitted(where('id', 'notIn', [1, 2]))).toBe('?$filter=not (id in (1,2))');
  });

  it('compares against null for the null tests', () => {
    expect(emitted(where('name', 'isNull'))).toBe('?$filter=name eq null');
    expect(emitted(where('name', 'isNotNull'))).toBe('?$filter=name ne null');
  });

  it('serializes a date as an unquoted instant, which is what DateTimeOffset expects', () => {
    const when = new Date('2026-08-19T09:30:00.000Z');
    expect(emitted(where('createdAt', 'ge', when))).toBe(
      '?$filter=createdAt ge 2026-08-19T09:30:00.000Z',
    );
  });

  it('serializes the bounds of a date range and the members of a date list', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-12-31T00:00:00.000Z');
    expect(emitted(where('createdAt', 'between', [from, to]))).toBe(
      '?$filter=createdAt ge 2026-01-01T00:00:00.000Z and createdAt le 2026-12-31T00:00:00.000Z',
    );
    expect(emitted(where('createdAt', 'in', [from]))).toBe(
      '?$filter=createdAt in (2026-01-01T00:00:00.000Z)',
    );
  });
});

describe('nested fields', () => {
  it('addresses a dot path with a slash', () => {
    expect(emitted(where('customer.name', 'contains', 'x'))).toBe(
      "?$filter=contains(customer/name,'x')",
    );
    expect(emitted(where('a.b.c', 'eq', 1))).toBe('?$filter=a/b/c eq 1');
  });
});

describe('composition', () => {
  it('emits and and or', () => {
    expect(emitted(and(where('a', 'eq', 1), where('b', 'eq', 2)))).toBe(
      '?$filter=((a eq 1) and (b eq 2))',
    );
    expect(emitted(or(where('a', 'eq', 1), where('b', 'eq', 2)))).toBe(
      '?$filter=((a eq 1) or (b eq 2))',
    );
  });

  it('unwraps a single survivor rather than wrapping one child', () => {
    expect(emitted(and(where('a', 'eq', 1)))).toBe('?$filter=a eq 1');
  });

  it('emits a negated sub-tree', () => {
    expect(emitted(not(where('a', 'eq', 1)))).toBe('?$filter=not (a eq 1)');
  });

  it('nests a group inside a group', () => {
    const node = and(or(where('a', 'eq', 1), where('b', 'eq', 2)), where('c', 'eq', 3));
    expect(emitted(node)).toBe('?$filter=((((a eq 1) or (b eq 2))) and (c eq 3))');
  });

  it('sends nothing for an absent or empty tree', () => {
    expect(emitted(null)).toBe('');
    expect(emitted(undefined)).toBe('');
    expect(emitted({ op: 'and', nodes: [] })).toBe('');
  });
});

describe('an impossible membership test', () => {
  // `in ()` is not valid OData, and dropping the condition would mean "match everything" —
  // for a byKeys([]) or a header filter with nothing ticked, a wrong answer rather than a
  // missing one.
  it('matches nothing rather than everything', () => {
    expect(emitted(where('id', 'in', []))).toBe('?$filter=false');
  });

  it('excludes nothing when the exclusion list is empty', () => {
    expect(emitted(where('id', 'notIn', []))).toBe('');
  });

  it('makes a conjunction containing it impossible', () => {
    expect(emitted(and(where('a', 'eq', 1), where('id', 'in', [])))).toBe('?$filter=false');
  });

  it('drops out of a disjunction, which the other branch still satisfies', () => {
    expect(emitted(or(where('a', 'eq', 1), where('id', 'in', [])))).toBe('?$filter=a eq 1');
  });

  it('becomes vacuous under negation, without emitting a broken not', () => {
    // `odata-query`'s `not` reads a string operand as a member name and would emit
    // `not eq 'false'`, so the literals are flipped before they reach it.
    expect(emitted(not(where('id', 'in', [])))).toBe('?$filter=true');
  });

  it('leaves a disjunction of nothing but impossibilities impossible', () => {
    expect(emitted(or(where('id', 'in', []), where('other', 'in', [])))).toBe('?$filter=false');
  });
});

describe('date fields', () => {
  const dates: FilterContext = { path: odataPath, dateFields: new Set(['lastVisitDate']) };

  function emittedWith(node: FilterNode): string {
    const filter = toODataFilter(node, dates);
    return filter === undefined ? '' : odataQueryString({ filter });
  }

  it('sends a local day bound as the bare day an Edm.Date compares with', () => {
    expect(emittedWith(where('lastVisitDate', 'ge', new Date(2026, 8, 1, 0, 0, 0, 0)))).toBe(
      '?$filter=lastVisitDate ge 2026-09-01',
    );
    expect(emittedWith(where('lastVisitDate', 'le', new Date(2026, 8, 1, 23, 59, 59, 999)))).toBe(
      '?$filter=lastVisitDate le 2026-09-01',
    );
  });

  it('sends a day string bare, and both bounds of a range', () => {
    expect(emittedWith(where('lastVisitDate', 'between', ['2026-09-01', '2026-09-30']))).toBe(
      '?$filter=lastVisitDate ge 2026-09-01 and lastVisitDate le 2026-09-30',
    );
  });

  it('leaves another field and a blank test alone', () => {
    expect(emittedWith(where('note', 'eq', '2026-09-01'))).toBe("?$filter=note eq '2026-09-01'");
    expect(emittedWith(where('lastVisitDate', 'isNull'))).toBe('?$filter=lastVisitDate eq null');
  });
});

describe('GUID fields', () => {
  const guids: FilterContext = {
    path: odataPath,
    guidFields: new Set(['customerId', 'services.serviceId']),
    collections: ['services'],
  };
  const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

  function emittedWith(node: FilterNode): string {
    const filter = toODataFilter(node, guids);
    return filter === undefined ? '' : odataQueryString({ filter });
  }

  it('sends a GUID bare, which an Edm.Guid member compares with', () => {
    expect(emittedWith(where('customerId', 'eq', ID))).toBe(`?$filter=customerId eq ${ID}`);
    expect(emittedWith(where('customerId', 'in', [ID]))).toBe(`?$filter=customerId in (${ID})`);
  });

  it('leaves a field it was not told about quoted', () => {
    expect(emittedWith(where('code', 'eq', ID))).toBe(`?$filter=code eq '${ID}'`);
  });

  it('sends a GUID bare inside a list lambda too', () => {
    expect(emittedWith(where('services.serviceId', 'in', [ID]))).toBe(
      `?$filter=services/any(services:services/serviceId in (${ID}))`,
    );
  });
});

describe('list members', () => {
  const lists: FilterContext = { path: odataPath, collections: ['services'] };

  function emittedWith(node: FilterNode): string {
    const filter = toODataFilter(node, lists);
    return filter === undefined ? '' : odataQueryString({ filter });
  }

  it('tests any element of the list', () => {
    expect(emittedWith(where('services.name', 'contains', 'fade'))).toBe(
      "?$filter=services/any(services:contains(services/name,'fade'))",
    );
  });

  it('negates the whole lambda for an exclusion, not the element test', () => {
    // "has no service in (a)", not "has some service other than a".
    expect(emittedWith(where('services.code', 'notIn', ['a']))).toBe(
      "?$filter=not (services/any(services:services/code in ('a')))",
    );
  });

  it('matches nothing for an empty membership test, without an empty lambda', () => {
    expect(emittedWith(where('services.code', 'in', []))).toBe('?$filter=false');
  });

  it('leaves a member outside the declared lists alone', () => {
    expect(emittedWith(where('customer.name', 'eq', 'a'))).toBe("?$filter=customer/name eq 'a'");
  });
});

describe('folded twins', () => {
  const folded: FilterContext = {
    path: odataPath,
    normalizedFields: { reason: 'reasonNormalized' },
  };

  function emittedWith(node: FilterNode): string {
    const filter = toODataFilter(node, folded);
    return filter === undefined ? '' : odataQueryString({ filter });
  }

  it('moves a text condition to the twin and folds the needle', () => {
    expect(emittedWith(where('reason', 'contains', 'CaféSICK'))).toBe(
      "?$filter=contains(reasonNormalized,'cafesick')",
    );
    expect(emittedWith(where('reason', 'notContains', 'ÉTÉ'))).toBe(
      "?$filter=not (contains(reasonNormalized,'ete'))",
    );
  });

  it('keeps a null test on the display field, which the twin mirrors anyway', () => {
    expect(emittedWith(where('reason', 'isNull'))).toBe('?$filter=reason eq null');
  });
});

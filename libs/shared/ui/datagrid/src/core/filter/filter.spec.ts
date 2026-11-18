import { and, isConditionNode, isGroupNode, isNotNode, not, or, where } from './filter-node';
import { compileFilterPredicate } from './compile-predicate';
import { resolveRelativeDateFilter, shiftDate, startOfZonedDay } from './relative-date';
import type { FilterGroupNode, FilterNode } from '../types/filter.types';

describe('where', () => {
  it('omits the value key entirely when undefined', () => {
    const node = where('status', 'isNull');
    expect(node).toEqual({ field: 'status', op: 'isNull' });
    expect('value' in node).toBe(false);
  });

  it('includes the value key when a value is given', () => {
    const node = where('status', 'eq', 'active');
    expect(node).toEqual({ field: 'status', op: 'eq', value: 'active' });
  });
});

describe('and / or', () => {
  it('skips null and undefined inputs', () => {
    const node = and(where('a', 'eq', 1), null, undefined, where('b', 'eq', 2));
    expect(node).toEqual({ op: 'and', nodes: [where('a', 'eq', 1), where('b', 'eq', 2)] });
  });

  it('returns null when every input is absent', () => {
    expect(and(null, undefined)).toBeNull();
    expect(or(null, undefined)).toBeNull();
  });

  it('unwraps a single survivor instead of wrapping it in a group', () => {
    const condition = where('a', 'eq', 1);
    expect(and(condition, null)).toBe(condition);
    expect(or(null, condition)).toBe(condition);
  });

  it('builds a group node for two or more survivors', () => {
    const left = where('a', 'eq', 1);
    const right = where('b', 'eq', 2);
    expect(and(left, right)).toEqual({ op: 'and', nodes: [left, right] });
    expect(or(left, right)).toEqual({ op: 'or', nodes: [left, right] });
  });
});

describe('not', () => {
  it('wraps the node in a not node', () => {
    const inner = where('a', 'eq', 1);
    expect(not(inner)).toEqual({ op: 'not', node: inner });
  });
});

describe('node guards', () => {
  const condition = where('a', 'eq', 1);
  const group: FilterGroupNode = { op: 'and', nodes: [condition] };
  const negation = not(condition);

  it('isGroupNode is true only for and/or nodes', () => {
    expect(isGroupNode(group)).toBe(true);
    expect(isGroupNode({ ...group, op: 'or' })).toBe(true);
    expect(isGroupNode(condition)).toBe(false);
    expect(isGroupNode(negation)).toBe(false);
  });

  it('isNotNode is true only for not nodes', () => {
    expect(isNotNode(negation)).toBe(true);
    expect(isNotNode(group)).toBe(false);
    expect(isNotNode(condition)).toBe(false);
  });

  it('isConditionNode is true only for field conditions', () => {
    expect(isConditionNode(condition)).toBe(true);
    expect(isConditionNode(group)).toBe(false);
    expect(isConditionNode(negation)).toBe(false);
  });
});

interface Row {
  name: string;
  age: number | null;
  createdAt: Date | null;
  tags: string;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    name: 'Ada',
    age: 30,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    tags: 'vip',
    ...overrides,
  };
}

describe('compileFilterPredicate', () => {
  it('matches every row when the tree is null or undefined', () => {
    expect(compileFilterPredicate<Row>(null)(row())).toBe(true);
    expect(compileFilterPredicate<Row>(undefined)(row())).toBe(true);
  });

  describe('eq / ne', () => {
    it('matches equal Date instants regardless of object identity', () => {
      const filterDate = new Date('2024-01-01T00:00:00.000Z');
      const predicate = compileFilterPredicate<Row>(where('createdAt', 'eq', filterDate));
      expect(predicate(row({ createdAt: new Date('2024-01-01T00:00:00.000Z') }))).toBe(true);
    });

    it('treats null and undefined as equal', () => {
      const predicate = compileFilterPredicate<Row>({ field: 'age', op: 'eq', value: undefined });
      expect(predicate(row({ age: null }))).toBe(true);
    });

    it('ne negates eq', () => {
      const predicate = compileFilterPredicate<Row>(where('name', 'ne', 'Ada'));
      expect(predicate(row({ name: 'Ada' }))).toBe(false);
      expect(predicate(row({ name: 'Grace' }))).toBe(true);
    });
  });

  describe('ordering operators', () => {
    it('compares numbers', () => {
      expect(compileFilterPredicate<Row>(where('age', 'lt', 40))(row({ age: 30 }))).toBe(true);
      expect(compileFilterPredicate<Row>(where('age', 'le', 30))(row({ age: 30 }))).toBe(true);
      expect(compileFilterPredicate<Row>(where('age', 'gt', 40))(row({ age: 30 }))).toBe(false);
      expect(compileFilterPredicate<Row>(where('age', 'ge', 30))(row({ age: 30 }))).toBe(true);
    });

    it('compares strings', () => {
      expect(compileFilterPredicate<Row>(where('name', 'lt', 'Bob'))(row({ name: 'Ada' }))).toBe(
        true,
      );
      expect(compileFilterPredicate<Row>(where('name', 'gt', 'Ada'))(row({ name: 'Bob' }))).toBe(
        true,
      );
    });

    it('compares Dates by instant', () => {
      const later = new Date('2024-06-01T00:00:00.000Z');
      expect(compileFilterPredicate<Row>(where('createdAt', 'lt', later))(row())).toBe(true);
      expect(compileFilterPredicate<Row>(where('createdAt', 'gt', later))(row())).toBe(false);
    });

    it('returns false for lt/le/gt/ge when the row value is null', () => {
      const predicate = (op: 'lt' | 'le' | 'gt' | 'ge') =>
        compileFilterPredicate<Row>(where('age', op, 10));
      expect(predicate('lt')(row({ age: null }))).toBe(false);
      expect(predicate('le')(row({ age: null }))).toBe(false);
      expect(predicate('gt')(row({ age: null }))).toBe(false);
      expect(predicate('ge')(row({ age: null }))).toBe(false);
    });

    it('returns false for lt/le/gt/ge when the filter value is null', () => {
      const predicate = (op: 'lt' | 'le' | 'gt' | 'ge') =>
        compileFilterPredicate<Row>({ field: 'age', op, value: null });
      expect(predicate('lt')(row({ age: 10 }))).toBe(false);
      expect(predicate('le')(row({ age: 10 }))).toBe(false);
      expect(predicate('gt')(row({ age: 10 }))).toBe(false);
      expect(predicate('ge')(row({ age: 10 }))).toBe(false);
    });
  });

  describe('text search operators', () => {
    it('contains is case-insensitive and coerces numbers', () => {
      expect(
        compileFilterPredicate<Row>(where('name', 'contains', 'AD'))(row({ name: 'Ada' })),
      ).toBe(true);
      expect(compileFilterPredicate<Row>(where('age', 'contains', '3'))(row({ age: 30 }))).toBe(
        true,
      );
    });

    it('startsWith and endsWith are case-insensitive', () => {
      expect(
        compileFilterPredicate<Row>(where('name', 'startsWith', 'ad'))(row({ name: 'Ada' })),
      ).toBe(true);
      expect(
        compileFilterPredicate<Row>(where('name', 'endsWith', 'DA'))(row({ name: 'Ada' })),
      ).toBe(true);
      expect(
        compileFilterPredicate<Row>(where('name', 'startsWith', 'zz'))(row({ name: 'Ada' })),
      ).toBe(false);
    });

    it('contains/startsWith/endsWith return false for null row values', () => {
      expect(
        compileFilterPredicate<Row>(where('name', 'contains', 'a'))(row({ name: null as never })),
      ).toBe(false);
    });

    it('notContains negates contains, so a null row value returns true', () => {
      expect(
        compileFilterPredicate<Row>(where('name', 'notContains', 'a'))(
          row({ name: null as never }),
        ),
      ).toBe(true);
      expect(
        compileFilterPredicate<Row>(where('name', 'notContains', 'ad'))(row({ name: 'Ada' })),
      ).toBe(false);
    });
  });

  describe('between', () => {
    it('matches within a closed [min, max] range', () => {
      const predicate = compileFilterPredicate<Row>(where('age', 'between', [10, 40]));
      expect(predicate(row({ age: 30 }))).toBe(true);
      expect(predicate(row({ age: 5 }))).toBe(false);
      expect(predicate(row({ age: 45 }))).toBe(false);
    });

    it('treats a null min as an open lower bound', () => {
      const predicate = compileFilterPredicate<Row>(where('age', 'between', [null, 40]));
      expect(predicate(row({ age: -1000 }))).toBe(true);
      expect(predicate(row({ age: 45 }))).toBe(false);
    });

    it('treats a null max as an open upper bound', () => {
      const predicate = compileFilterPredicate<Row>(where('age', 'between', [10, null]));
      expect(predicate(row({ age: 1000 }))).toBe(true);
      expect(predicate(row({ age: 5 }))).toBe(false);
    });

    it('compares Dates within the range', () => {
      const min = new Date('2024-01-01T00:00:00.000Z');
      const max = new Date('2024-12-31T00:00:00.000Z');
      const predicate = compileFilterPredicate<Row>(where('createdAt', 'between', [min, max]));
      expect(predicate(row({ createdAt: new Date('2024-06-01T00:00:00.000Z') }))).toBe(true);
      expect(predicate(row({ createdAt: new Date('2025-01-01T00:00:00.000Z') }))).toBe(false);
    });
  });

  describe('in / notIn', () => {
    it('matches membership in the option array', () => {
      const predicate = compileFilterPredicate<Row>(where('name', 'in', ['Ada', 'Grace']));
      expect(predicate(row({ name: 'Ada' }))).toBe(true);
      expect(predicate(row({ name: 'Bob' }))).toBe(false);
    });

    it('notIn negates membership', () => {
      const predicate = compileFilterPredicate<Row>(where('name', 'notIn', ['Ada', 'Grace']));
      expect(predicate(row({ name: 'Ada' }))).toBe(false);
      expect(predicate(row({ name: 'Bob' }))).toBe(true);
    });

    it('normalizes Dates when matching membership', () => {
      const option = new Date('2024-01-01T00:00:00.000Z');
      const predicate = compileFilterPredicate<Row>(where('createdAt', 'in', [option]));
      expect(predicate(row({ createdAt: new Date('2024-01-01T00:00:00.000Z') }))).toBe(true);
    });
  });

  describe('isNull / isNotNull', () => {
    it('isNull matches null and undefined, not a present value', () => {
      const predicate = compileFilterPredicate<Row>(where('age', 'isNull'));
      expect(predicate(row({ age: null }))).toBe(true);
      expect(predicate(row({ age: undefined as never }))).toBe(true);
      expect(predicate(row({ age: 30 }))).toBe(false);
    });

    it('isNotNull matches a present value, not null or undefined', () => {
      const predicate = compileFilterPredicate<Row>(where('age', 'isNotNull'));
      expect(predicate(row({ age: 30 }))).toBe(true);
      expect(predicate(row({ age: null }))).toBe(false);
      expect(predicate(row({ age: undefined as never }))).toBe(false);
    });
  });

  it('evaluates nested and/or/not trees', () => {
    const tree = and(
      where('age', 'ge', 18),
      or(where('tags', 'eq', 'vip'), not(where('name', 'eq', 'Bob'))),
    );
    const predicate = compileFilterPredicate<Row>(tree);
    expect(predicate(row({ age: 20, tags: 'vip', name: 'Ada' }))).toBe(true);
    expect(predicate(row({ age: 20, tags: 'std', name: 'Ada' }))).toBe(true);
    expect(predicate(row({ age: 20, tags: 'std', name: 'Bob' }))).toBe(false);
    expect(predicate(row({ age: 10, tags: 'vip', name: 'Ada' }))).toBe(false);
  });

  it('matches every row for an empty and group', () => {
    const empty: FilterNode = { op: 'and', nodes: [] };
    expect(compileFilterPredicate<Row>(empty)(row())).toBe(true);
  });

  it('consults a custom getValue option instead of dot-path access', () => {
    const getValue = vi.fn((source: Row, field: string) =>
      field === 'name' ? source.name.toUpperCase() : null,
    );
    const predicate = compileFilterPredicate<Row>(where('name', 'eq', 'ADA'), { getValue });
    expect(predicate(row({ name: 'ada' }))).toBe(true);
    expect(getValue).toHaveBeenCalledWith(expect.objectContaining({ name: 'ada' }), 'name');
  });
});

describe('shiftDate', () => {
  it('shifts minutes forward and backward', () => {
    const date = new Date(2024, 0, 15, 10, 30);
    expect(shiftDate(date, 15, 'minute').getTime()).toBe(new Date(2024, 0, 15, 10, 45).getTime());
    expect(shiftDate(date, -15, 'minute').getTime()).toBe(new Date(2024, 0, 15, 10, 15).getTime());
  });

  it('shifts hours forward and backward', () => {
    const date = new Date(2024, 0, 15, 10, 0);
    expect(shiftDate(date, 5, 'hour').getTime()).toBe(new Date(2024, 0, 15, 15, 0).getTime());
    expect(shiftDate(date, -5, 'hour').getTime()).toBe(new Date(2024, 0, 15, 5, 0).getTime());
  });

  it('shifts days forward and backward, rolling into the next/previous month', () => {
    const date = new Date(2024, 0, 30);
    expect(shiftDate(date, 3, 'day').getTime()).toBe(new Date(2024, 0, 33).getTime());
    expect(shiftDate(date, -35, 'day').getTime()).toBe(new Date(2024, 0, -5).getTime());
  });

  it('shifts weeks as seven-day multiples', () => {
    const date = new Date(2024, 0, 1);
    expect(shiftDate(date, 2, 'week').getTime()).toBe(new Date(2024, 0, 15).getTime());
    expect(shiftDate(date, -1, 'week').getTime()).toBe(new Date(2023, 11, 25).getTime());
  });

  it('rolls January 31 plus one month per Date.setMonth overflow semantics', () => {
    const date = new Date(2024, 0, 31);
    const expected = new Date(2024, 1, 31);
    expect(shiftDate(date, 1, 'month').getTime()).toBe(expected.getTime());
  });

  it('shifts months backward', () => {
    const date = new Date(2024, 5, 15);
    expect(shiftDate(date, -2, 'month').getTime()).toBe(new Date(2024, 3, 15).getTime());
  });

  it('rolls a leap-day February 29 plus one year per Date.setFullYear overflow semantics', () => {
    const date = new Date(2024, 1, 29);
    const expected = new Date(2025, 1, 29);
    expect(shiftDate(date, 1, 'year').getTime()).toBe(expected.getTime());
  });

  it('shifts years backward', () => {
    const date = new Date(2024, 5, 15);
    expect(shiftDate(date, -3, 'year').getTime()).toBe(new Date(2021, 5, 15).getTime());
  });
});

describe('resolveRelativeDateFilter', () => {
  const now = new Date('2024-06-15T12:00:00.000Z');

  it('returns a between condition looking back for direction "last"', () => {
    const condition = resolveRelativeDateFilter(
      'createdAt',
      { direction: 'last', amount: 3, unit: 'day' },
      now,
    );
    expect(condition.field).toBe('createdAt');
    expect(condition.op).toBe('between');
    expect(condition.value).toEqual([shiftDate(now, -3, 'day'), now]);
  });

  it('returns a between condition looking forward for direction "next"', () => {
    const condition = resolveRelativeDateFilter(
      'dueAt',
      { direction: 'next', amount: 2, unit: 'week' },
      now,
    );
    expect(condition.field).toBe('dueAt');
    expect(condition.op).toBe('between');
    expect(condition.value).toEqual([now, shiftDate(now, 2, 'week')]);
  });

  it('defaults now to the current instant when not given', () => {
    const before = Date.now();
    const condition = resolveRelativeDateFilter('createdAt', {
      direction: 'last',
      amount: 1,
      unit: 'hour',
    });
    const after = Date.now();
    const [, upper] = condition.value as [Date, Date];
    expect(upper.getTime()).toBeGreaterThanOrEqual(before);
    expect(upper.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('day-aligned relative periods', () => {
  // 00:30 on 15 June in Athens, and still 14 June in UTC.
  const lateEvening = new Date('2024-06-14T21:30:00.000Z');

  it('counts days in the zone it is given, not the host environment', () => {
    expect(startOfZonedDay(lateEvening, 0, 'Europe/Athens').toISOString()).toBe(
      '2024-06-14T21:00:00.000Z',
    );
    expect(startOfZonedDay(lateEvening, 0, 'UTC').toISOString()).toBe('2024-06-14T00:00:00.000Z');
  });

  it('finds the start of a day across a DST change', () => {
    // Athens moves from UTC+2 to UTC+3 on 31 March 2024.
    const beforeChange = new Date('2024-03-30T12:00:00.000Z');
    expect(startOfZonedDay(beforeChange, 0, 'Europe/Athens').toISOString()).toBe(
      '2024-03-29T22:00:00.000Z',
    );
    expect(startOfZonedDay(beforeChange, 2, 'Europe/Athens').toISOString()).toBe(
      '2024-03-31T21:00:00.000Z',
    );
  });

  it('reads "from" as the start of the day onward, with no end', () => {
    const condition = resolveRelativeDateFilter(
      'startsAt',
      { direction: 'from', amount: 0, unit: 'day' },
      lateEvening,
      'Europe/Athens',
    );
    expect(condition.op).toBe('ge');
    expect((condition.value as Date).toISOString()).toBe('2024-06-14T21:00:00.000Z');
  });

  it('reads "before" as everything before the start of the day', () => {
    const condition = resolveRelativeDateFilter(
      'startsAt',
      { direction: 'before', amount: 0, unit: 'day' },
      lateEvening,
      'Europe/Athens',
    );
    expect(condition.op).toBe('lt');
    expect((condition.value as Date).toISOString()).toBe('2024-06-14T21:00:00.000Z');
  });

  it('reads "on" as the whole day, ending a millisecond before the next', () => {
    const condition = resolveRelativeDateFilter(
      'startsAt',
      { direction: 'on', amount: 1, unit: 'day' },
      lateEvening,
      'Europe/Athens',
    );
    const [start, end] = condition.value as [Date, Date];
    expect(condition.op).toBe('between');
    expect(start.toISOString()).toBe('2024-06-15T21:00:00.000Z');
    expect(end.toISOString()).toBe('2024-06-16T20:59:59.999Z');
  });
});

import {
  buildColumnFilter,
  combineFilterOptions,
  flattenAnd,
  isEmptyFilterValue,
  readColumnFilter,
} from './column-filter';
import { dayEnd, dayStart, toDateValue } from './date-filter';
import { distinctValues } from './distinct-values';
import { describeFilters } from './filter-summary';
import {
  DEFAULT_RELATIVE_PRESETS,
  defaultFilterOperator,
  filterOperatorArity,
  filterOperatorLabelKey,
  filterOperatorsFor,
  filterOperatorsForType,
  isDateColumn,
  relativeFilterLabelKey,
  relativePresetsFor,
} from './operators';
import { compileFilterPredicate } from './compile-predicate';
import {
  DATAGRID_FEATURES,
  filterPanel,
  filterRow,
  findFeature,
  groupPanel,
  headerFilters,
  provideDatagridFeatures,
} from '../../features';
import type { ColumnDef } from '../types/column.types';

interface Row {
  id: number;
  name: string;
  price: number;
  active: boolean;
  starts: Date;
}

const NAME: ColumnDef<Row> = { id: 'name', field: 'name', caption: 'Name' };
const PRICE: ColumnDef<Row> = { id: 'price', field: 'price', caption: 'Price', dataType: 'number' };
const STARTS: ColumnDef<Row> = {
  id: 'starts',
  field: 'starts',
  caption: 'Starts',
  dataType: 'datetime',
};

describe('filter operators', () => {
  it('offers text operators to an undeclared column', () => {
    expect(filterOperatorsFor(NAME)[0]).toBe('contains');
    expect(filterOperatorsForType(undefined)).toEqual(filterOperatorsFor(NAME));
  });

  it('offers the numeric set to a number column', () => {
    expect(filterOperatorsFor(PRICE)).toContain('between');
    expect(filterOperatorsFor(PRICE)).not.toContain('contains');
  });

  // A date editor collects a day, and "not on this day" over a datetime column
  // would have to negate a range — which one condition cannot say.
  it('withholds `ne` from a date column', () => {
    expect(filterOperatorsFor(STARTS)).not.toContain('ne');
  });

  it('lets a column declare its own operators and default', () => {
    const column: ColumnDef<Row> = {
      ...NAME,
      filter: { operators: ['eq', 'ne'], defaultOperator: 'ne' },
    };
    expect(filterOperatorsFor(column)).toEqual(['eq', 'ne']);
    expect(defaultFilterOperator(column)).toBe('ne');
  });

  it('ignores a declared default the operator set does not offer', () => {
    const column: ColumnDef<Row> = {
      ...NAME,
      filter: { operators: ['eq'], defaultOperator: 'gt' },
    };
    expect(defaultFilterOperator(column)).toBe('eq');
  });

  it('reports the arity of every operator kind', () => {
    expect(filterOperatorArity('isNull')).toBe('none');
    expect(filterOperatorArity('between')).toBe('range');
    expect(filterOperatorArity('in')).toBe('list');
    expect(filterOperatorArity('contains')).toBe('single');
  });

  it('names operators and relative presets by message key', () => {
    expect(filterOperatorLabelKey('startsWith')).toBe('datagrid.filterOperator.startsWith');
    expect(relativeFilterLabelKey({ direction: 'last', amount: 7, unit: 'day' })).toBe(
      'datagrid.relative.lastDay',
    );
  });

  it('offers relative presets only on a date column', () => {
    expect(relativePresetsFor(STARTS)).toEqual(DEFAULT_RELATIVE_PRESETS);
    expect(relativePresetsFor(NAME)).toEqual([]);
    expect(isDateColumn(STARTS)).toBe(true);
  });

  it('lets a date column declare its own presets', () => {
    const column: ColumnDef<Row> = {
      ...STARTS,
      filter: { relativePresets: [{ direction: 'next', amount: 2, unit: 'week' }] },
    };
    expect(relativePresetsFor(column)).toHaveLength(1);
  });
});

describe('column filter translation', () => {
  it('treats an empty editor as no filter', () => {
    expect(isEmptyFilterValue('contains', '')).toBe(true);
    expect(isEmptyFilterValue('between', [null, null])).toBe(true);
    expect(isEmptyFilterValue('in', [])).toBe(true);
    expect(isEmptyFilterValue('isNull', undefined)).toBe(false);
    expect(buildColumnFilter(NAME, 'contains', '')).toBeNull();
  });

  it('builds and reads back a text condition', () => {
    const node = buildColumnFilter(NAME, 'contains', 'ann');
    if (node == null) {
      throw new Error('no condition built');
    }
    expect(node).toEqual({ field: 'name', op: 'contains', value: 'ann' });
    expect(readColumnFilter(node, 'name')).toEqual({ op: 'contains', value: 'ann' });
  });

  it('builds a null test with no operand', () => {
    expect(buildColumnFilter(NAME, 'isNull', null)).toEqual({ field: 'name', op: 'isNull' });
  });

  it('keeps a half-open range rather than collapsing it to an ordering operator', () => {
    expect(buildColumnFilter(PRICE, 'between', [10, null])).toEqual({
      field: 'price',
      op: 'between',
      value: [10, null],
    });
  });

  it('honours a column that builds its own expression', () => {
    const column: ColumnDef<Row> = {
      ...NAME,
      filterExpression: (value) => ({ field: 'alias', op: 'eq', value }),
    };
    expect(buildColumnFilter(column, 'contains', 'x')).toEqual({
      field: 'alias',
      op: 'eq',
      value: 'x',
    });
  });

  it('refuses to read a node it cannot show in a filter row', () => {
    expect(readColumnFilter({ op: 'not', node: { field: 'name', op: 'eq' } }, 'name')).toBeNull();
    expect(readColumnFilter({ field: 'other', op: 'eq', value: 1 }, 'name')).toBeNull();
  });

  it('flattens a top-level `and` and leaves anything else alone', () => {
    const child = { field: 'name', op: 'eq', value: 'a' } as const;
    expect(flattenAnd({ op: 'and', nodes: [child, child] })).toHaveLength(2);
    expect(flattenAnd(child)).toEqual([child]);
    expect(flattenAnd(null)).toEqual([]);
  });
});

describe('day boundaries on a date column', () => {
  it('widens equality to the whole day, so a datetime row matches', () => {
    const node = buildColumnFilter(STARTS, 'eq', '2026-01-05');
    const matches = compileFilterPredicate<Row>(node);
    const row = { id: 1, name: 'a', price: 1, active: true, starts: new Date(2026, 0, 5, 14, 30) };
    expect(matches(row)).toBe(true);
    expect(matches({ ...row, starts: new Date(2026, 0, 6, 0, 1) })).toBe(false);
  });

  it('uses an exact instant when a datetime value includes time', () => {
    const instant = new Date(2026, 0, 5, 14, 30);
    expect(buildColumnFilter(STARTS, 'eq', instant)).toEqual({
      field: 'starts',
      op: 'eq',
      value: instant,
    });
  });

  it('allows each datetime range bound to opt into time independently', () => {
    const start = new Date(2026, 0, 5, 9, 30);
    expect(buildColumnFilter(STARTS, 'between', [start, '2026-01-06'])).toEqual({
      field: 'starts',
      op: 'between',
      value: [start, dayEnd('2026-01-06')],
    });
  });

  it('takes the boundary that leaves the named day on the side the user meant', () => {
    expect(buildColumnFilter(STARTS, 'ge', '2026-01-05')).toEqual({
      field: 'starts',
      op: 'ge',
      value: dayStart('2026-01-05'),
    });
    expect(buildColumnFilter(STARTS, 'gt', '2026-01-05')).toEqual({
      field: 'starts',
      op: 'gt',
      value: dayEnd('2026-01-05'),
    });
  });

  it('widens both ends of a range', () => {
    expect(buildColumnFilter(STARTS, 'between', ['2026-01-05', '2026-01-06'])).toEqual({
      field: 'starts',
      op: 'between',
      value: [dayStart('2026-01-05'), dayEnd('2026-01-06')],
    });
  });

  // `toISOString` shifts to UTC, which moves the date by one in a negative
  // offset — the editor would then show the day before the one it holds.
  it('renders a local date without shifting it to UTC', () => {
    expect(toDateValue(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(toDateValue('2026-01-05')).toBe('2026-01-05');
    expect(toDateValue('not a date')).toBe('');
  });
});

describe('header filter values', () => {
  const rows: Row[] = [
    { id: 1, name: 'Ann', price: 1, active: true, starts: new Date() },
    { id: 2, name: 'Bob', price: 1, active: true, starts: new Date() },
    { id: 3, name: 'Ann', price: 1, active: true, starts: new Date() },
    { id: 4, name: '', price: 1, active: true, starts: new Date() },
  ];

  it('counts distinct values and leads with the blanks', () => {
    const values = distinctValues(rows, {
      getValue: (row) => row.name,
      format: (value) => String(value),
    });
    expect(values.map((entry) => entry.text)).toEqual(['', 'Ann', 'Bob']);
    expect(values[0].blank).toBe(true);
    expect(values[1].count).toBe(2);
  });

  // A group valued `null` and one valued the string `'null'` share a key
  // without the type tag, and one checkbox would then check both.
  it('keeps values of different types apart', () => {
    const mixed = distinctValues([{ v: 1 }, { v: '1' }], {
      getValue: (row) => row.v,
      format: (value) => String(value),
    });
    expect(mixed).toHaveLength(2);
  });

  it('collapses equality options on one field into a single `in`', () => {
    expect(
      combineFilterOptions([
        { field: 'name', op: 'eq', value: 'Ann' },
        { field: 'name', op: 'eq', value: 'Bob' },
      ]),
    ).toEqual({ field: 'name', op: 'in', value: ['Ann', 'Bob'] });
  });

  it('falls back to `or` when the options are not all equalities', () => {
    const combined = combineFilterOptions([
      { field: 'name', op: 'eq', value: 'Ann' },
      { field: 'name', op: 'isNull' },
    ]);
    expect(combined?.op).toBe('or');
  });

  it('unwraps a lone option and reports nothing for none', () => {
    expect(combineFilterOptions([{ field: 'name', op: 'eq', value: 'Ann' }])).toEqual({
      field: 'name',
      op: 'eq',
      value: 'Ann',
    });
    expect(combineFilterOptions([])).toBeNull();
  });
});

describe('filter summary', () => {
  const format = (value: unknown): string => {
    if (typeof value === 'string') {
      return value;
    }
    return typeof value === 'number' ? value.toString() : '';
  };

  it('describes a column filter, a relative period and the search', () => {
    const entries = describeFilters<Row>({
      columns: [NAME, PRICE, STARTS],
      columnFilters: new Map([['name', { field: 'name', op: 'contains', value: 'ann' }]]),
      relativeFilters: new Map([
        ['starts', { field: 'starts', filter: { direction: 'last', amount: 7, unit: 'day' } }],
      ]),
      tree: null,
      search: 'shop',
      formatValue: format,
    });
    expect(entries.map((entry) => entry.id)).toEqual(['column:name', 'relative:starts', 'search']);
    expect(entries[0].labelKey).toBe('datagrid.filterOperator.contains');
    expect(entries[0].text).toBe('ann');
    expect(entries[1].labelKey).toBe('datagrid.relative.lastDay');
    expect(entries[2].text).toBe('shop');
  });

  it('joins the operands of a range', () => {
    const entries = describeFilters<Row>({
      columns: [PRICE],
      columnFilters: new Map([['price', { field: 'price', op: 'between', value: [10, 20] }]]),
      relativeFilters: new Map(),
      tree: null,
      search: null,
      formatValue: format,
    });
    expect(entries[0].text).toBe('10 – 20');
  });

  // §7.3: a surface that cannot show an expression must say so, not drop it.
  it('marks an expression the filter row cannot represent', () => {
    const entries = describeFilters<Row>({
      columns: [NAME],
      columnFilters: new Map(),
      relativeFilters: new Map(),
      tree: { op: 'not', node: { field: 'name', op: 'eq', value: 'a' } },
      search: null,
      formatValue: format,
    });
    expect(entries[0].representable).toBe(false);
    expect(entries[0].labelKey).toBe('datagrid.filterPanel.expression');
  });

  it('lists each condition of a composed tree separately', () => {
    const entries = describeFilters<Row>({
      columns: [NAME, PRICE],
      columnFilters: new Map(),
      relativeFilters: new Map(),
      tree: {
        op: 'and',
        nodes: [
          { field: 'name', op: 'eq', value: 'a' },
          { field: 'price', op: 'gt', value: 5 },
        ],
      },
      search: null,
      formatValue: format,
    });
    expect(entries.map((entry) => entry.id)).toEqual(['tree:0', 'tree:1']);
    expect(entries.every((entry) => entry.representable)).toBe(true);
  });
});

describe('feature descriptors', () => {
  it('carries its options and defaults the rest', () => {
    expect(filterRow()).toEqual({ name: 'filterRow', apply: 'auto' });
    expect(filterRow({ apply: 'deferred' }).apply).toBe('deferred');
    expect(headerFilters().pageSize).toBe(50);
    expect(headerFilters({ pageSize: 10 }).pageSize).toBe(10);
    expect(headerFilters({ pageSize: 0 }).pageSize).toBe(50);
  });

  it('finds a descriptor by name and reports its absence', () => {
    const features = [filterRow(), filterPanel(), groupPanel()];
    expect(findFeature(features, 'filterPanel')?.name).toBe('filterPanel');
    expect(findFeature(features, 'headerFilter')).toBeNull();
  });

  it('provides features to an injector', () => {
    expect(provideDatagridFeatures(filterRow())).toBeDefined();
    expect(DATAGRID_FEATURES.toString()).toContain('DATAGRID_FEATURES');
  });
});

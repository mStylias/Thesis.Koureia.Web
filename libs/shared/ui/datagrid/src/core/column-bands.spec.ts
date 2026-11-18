import { describe, expect, it } from 'vitest';
import {
  computeHeaderMatrix,
  indexColumnBands,
  isBand,
  leavesOfBand,
  leavesOfUnit,
  orderWithinBands,
} from './column-bands';
import type { BandLayoutEntry } from './column-bands.types';
import type { ColumnDef } from './types/column.types';

interface Row {
  code: string;
  name: string;
  phone: string;
  city: string;
  total: number;
}

/** `Code | [Customer: Name, [Contact: Phone]] | [Address: City] | Total`. */
const COLUMNS: ColumnDef<Row>[] = [
  { id: 'code', field: 'code' },
  {
    id: 'customer',
    caption: 'Customer',
    columns: [
      { id: 'name', field: 'name' },
      { id: 'contact', caption: 'Contact', columns: [{ id: 'phone', field: 'phone' }] },
    ],
  },
  { id: 'address', caption: 'Address', columns: [{ id: 'city', field: 'city' }] },
  { id: 'total', field: 'total' },
];

function entries(...ids: string[]): BandLayoutEntry[] {
  return ids.map((id) => ({ id, pinned: false as const, inset: null, edge: false }));
}

describe('indexColumnBands', () => {
  it('leaves an unbanded set exactly as it was', () => {
    const flat: ColumnDef<Row>[] = [{ id: 'code' }, { id: 'total' }];
    const index = indexColumnBands(flat);
    expect(index.leaves).toBe(flat);
    expect(index.depth).toBe(0);
  });

  it('flattens to the data columns in declaration order', () => {
    expect(indexColumnBands(COLUMNS).leaves.map((column) => column.id)).toEqual([
      'code',
      'name',
      'phone',
      'city',
      'total',
    ]);
  });

  it('records the bands above each column, outermost first', () => {
    const index = indexColumnBands(COLUMNS);
    expect(index.pathOf.get('phone')).toEqual(['customer', 'contact']);
    expect(index.pathOf.get('name')).toEqual(['customer']);
    expect(index.pathOf.has('code')).toBe(false);
  });

  it('counts the header rows the deepest nesting needs', () => {
    expect(indexColumnBands(COLUMNS).depth).toBe(2);
  });

  it('reports a nested band parent, so it reorders among its siblings', () => {
    const index = indexColumnBands(COLUMNS);
    expect(index.parentOf.get('contact')).toBe('customer');
    expect(index.parentOf.get('customer')).toBe(null);
  });

  it('says which definitions are bands', () => {
    expect(isBand(COLUMNS[1])).toBe(true);
    expect(isBand(COLUMNS[0])).toBe(false);
    expect(isBand({ id: 'empty', columns: [] })).toBe(false);
  });
});

describe('orderWithinBands', () => {
  const paths = indexColumnBands(COLUMNS).pathOf;

  it('keeps an order that is already contiguous, identity included', () => {
    const order = ['code', 'name', 'phone', 'city', 'total'];
    expect(orderWithinBands(order, paths)).toBe(order);
  });

  it('gathers a column that was moved out of its band back beside its siblings', () => {
    expect(orderWithinBands(['name', 'code', 'phone', 'city', 'total'], paths)).toEqual([
      'name',
      'phone',
      'code',
      'city',
      'total',
    ]);
  });

  it('places the band where its first column appeared', () => {
    expect(orderWithinBands(['code', 'city', 'name', 'phone', 'total'], paths)).toEqual([
      'code',
      'city',
      'name',
      'phone',
      'total',
    ]);
  });

  it('keeps a nested band together inside the band that holds it', () => {
    expect(orderWithinBands(['phone', 'name', 'code', 'city', 'total'], paths)).toEqual([
      'phone',
      'name',
      'code',
      'city',
      'total',
    ]);
  });

  it('leaves an unbanded grid untouched', () => {
    const order = ['b', 'a'];
    expect(orderWithinBands(order, new Map())).toBe(order);
  });
});

describe('unit membership', () => {
  const paths = indexColumnBands(COLUMNS).pathOf;
  const order = ['code', 'name', 'phone', 'city', 'total'];

  it('gives every column of a band, nested ones included', () => {
    expect(leavesOfBand('customer', order, paths)).toEqual(['name', 'phone']);
  });

  it('gives one column for a column, so a leaf and a band move the same way', () => {
    expect(leavesOfUnit('name', order, paths)).toEqual(['name']);
    expect(leavesOfUnit('customer', order, paths)).toEqual(['name', 'phone']);
  });
});

describe('computeHeaderMatrix', () => {
  const index = indexColumnBands(COLUMNS);

  it('draws nothing for a grid with no bands', () => {
    const flat = indexColumnBands<Row>([{ id: 'code' }]);
    const matrix = computeHeaderMatrix(entries('code'), flat);
    expect(matrix.bandRows).toEqual([]);
    expect(matrix.rows).toBe(1);
  });

  it('spans a band over the columns it covers', () => {
    const matrix = computeHeaderMatrix(entries('code', 'name', 'phone', 'city', 'total'), index);
    expect(matrix.bandRows[0].map((cell) => [cell.id, cell.colIndex, cell.colSpan])).toEqual([
      ['customer', 2, 2],
      ['address', 4, 1],
    ]);
    expect(matrix.bandRows[1].map((cell) => [cell.id, cell.colIndex, cell.colSpan])).toEqual([
      ['contact', 3, 1],
    ]);
  });

  it('narrows the span when a column is hidden, without being told', () => {
    const matrix = computeHeaderMatrix(entries('code', 'name', 'city', 'total'), index);
    expect(matrix.bandRows[0][0]).toMatchObject({ id: 'customer', colSpan: 1 });
  });

  it('drops a band whose every column has gone', () => {
    const matrix = computeHeaderMatrix(entries('code', 'city', 'total'), index);
    expect(matrix.bandRows[0].map((cell) => cell.id)).toEqual(['address']);
    expect(matrix.bandRows[1]).toEqual([]);
  });

  it('reaches an unbanded column down through every band row', () => {
    const matrix = computeHeaderMatrix(entries('code', 'name', 'phone', 'city', 'total'), index);
    expect(matrix.leaves.get('code')).toEqual({ row: 0, rowSpan: 3, parentId: null });
    expect(matrix.leaves.get('name')).toEqual({ row: 1, rowSpan: 2, parentId: 'customer' });
    expect(matrix.leaves.get('phone')).toEqual({ row: 2, rowSpan: 1, parentId: 'contact' });
  });

  it('takes a start-pinned band inset from its first column', () => {
    const pinned: BandLayoutEntry[] = [
      { id: 'name', pinned: 'start', inset: 0, edge: false },
      { id: 'phone', pinned: 'start', inset: 120, edge: true },
      { id: 'code', pinned: false, inset: null, edge: false },
    ];
    const [band] = computeHeaderMatrix(pinned, index).bandRows[0];
    expect(band).toMatchObject({ id: 'customer', pinned: 'start', inset: 0, edge: true });
  });

  it('takes an end-pinned band inset from its last column', () => {
    const pinned: BandLayoutEntry[] = [
      { id: 'code', pinned: false, inset: null, edge: false },
      { id: 'name', pinned: 'end', inset: 100, edge: true },
      { id: 'phone', pinned: 'end', inset: 0, edge: false },
    ];
    const [band] = computeHeaderMatrix(pinned, index).bandRows[0];
    expect(band).toMatchObject({ id: 'customer', pinned: 'end', inset: 0 });
  });

  it('falls back to the band id when it carries no caption', () => {
    const unnamed = indexColumnBands<Row>([{ id: 'group', columns: [{ id: 'code' }] }]);
    expect(computeHeaderMatrix(entries('code'), unnamed).bandRows[0][0].caption).toBe('group');
  });
});

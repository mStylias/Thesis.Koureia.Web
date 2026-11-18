import { createKeyGetter, isDataSource, keyFields, keyTypeOf, serializeKey } from './keys';
import type { DataSource } from './data-source.types';

interface Row {
  id: string;
  owner: { id: number };
}

describe('data-source keys', () => {
  const row: Row = { id: 'row-1', owner: { id: 7 } };

  it('resolves field, nested, function, and composite keys', () => {
    expect(createKeyGetter<Row>('id')(row)).toBe('row-1');
    expect(createKeyGetter<Row>('owner.id')(row)).toBe(7);
    expect(createKeyGetter<Row>((item) => item.owner.id)(row)).toBe(7);
    expect(createKeyGetter<Row>(['id', 'owner.id'])(row)).toBe('["row-1",7]');
  });

  it('keeps declared type and projection fields', () => {
    expect(keyTypeOf<Row>({ selector: 'id', type: 'uuid' })).toBe('uuid');
    expect(keyFields<Row>(['id', 'owner.id'])).toEqual(['id', 'owner.id']);
    expect(keyFields<Row>((item) => item.id)).toEqual([]);
  });

  it('preserves bigint keys', () => {
    expect(serializeKey(42n)).toBe('42');
  });

  it('recognizes arrays and data sources', () => {
    const source: DataSource<Row> = { load: () => Promise.resolve({ rows: [] }) };
    expect(isDataSource<Row>([])).toBe(false);
    expect(isDataSource(source)).toBe(true);
  });
});

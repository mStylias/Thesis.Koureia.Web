import { applyRowTransaction } from './transactions';

interface Row {
  id: number;
  name: string;
  score: number;
}

const ROWS: readonly Row[] = [
  { id: 1, name: 'One', score: 10 },
  { id: 2, name: 'Two', score: 20 },
  { id: 3, name: 'Three', score: 30 },
];

const keyOf = (row: Row): number => row.id;

describe('applyRowTransaction', () => {
  it('appends inserts and reports their keys', () => {
    const result = applyRowTransaction(
      ROWS,
      { insert: [{ id: 4, name: 'Four', score: 40 }] },
      keyOf,
    );
    expect(result.rows.map(keyOf)).toEqual([1, 2, 3, 4]);
    expect(result.inserted).toEqual([4]);
  });

  it('merges an update into a copy, leaving the host row untouched', () => {
    const original = ROWS[1];
    const result = applyRowTransaction(
      ROWS,
      { update: [{ key: 2, changes: { score: 99 } }] },
      keyOf,
    );
    expect(result.rows[1].score).toBe(99);
    expect(result.rows[1].name).toBe('Two');
    expect(original.score).toBe(20);
    expect(result.updated).toEqual([2]);
  });

  it('keeps the identity of every row the transaction does not name', () => {
    const result = applyRowTransaction(
      ROWS,
      { update: [{ key: 2, changes: { score: 99 } }] },
      keyOf,
    );
    expect(result.rows[0]).toBe(ROWS[0]);
    expect(result.rows[2]).toBe(ROWS[2]);
    expect(result.rows[1]).not.toBe(ROWS[1]);
  });

  it('removes by key', () => {
    const result = applyRowTransaction(ROWS, { remove: [1, 3] }, keyOf);
    expect(result.rows.map(keyOf)).toEqual([2]);
    expect(result.removed).toEqual([1, 3]);
  });

  it('updates in place rather than adding a second row under one key', () => {
    const result = applyRowTransaction(
      ROWS,
      { insert: [{ id: 2, name: 'Replaced', score: 0 }] },
      keyOf,
    );
    expect(result.rows.map(keyOf)).toEqual([1, 2, 3]);
    expect(result.rows[1].name).toBe('Replaced');
    expect(result.inserted).toEqual([]);
    expect(result.updated).toEqual([2]);
  });

  it('removes before inserting, so one transaction can replace a row', () => {
    const result = applyRowTransaction(
      ROWS,
      { remove: [2], insert: [{ id: 2, name: 'Fresh', score: 5 }] },
      keyOf,
    );
    expect(result.rows.map(keyOf)).toEqual([1, 3, 2]);
    expect(result.rows[2].name).toBe('Fresh');
    expect(result.removed).toEqual([2]);
    expect(result.inserted).toEqual([2]);
  });

  it('reports keys that match no loaded row instead of failing', () => {
    const result = applyRowTransaction(
      ROWS,
      { remove: [99], update: [{ key: 98, changes: { score: 1 } }] },
      keyOf,
    );
    expect(result.rows).toBe(ROWS);
    expect(result.missing).toEqual([99, 98]);
  });

  it('returns the same array for an empty transaction', () => {
    expect(applyRowTransaction(ROWS, {}, keyOf).rows).toBe(ROWS);
  });
});

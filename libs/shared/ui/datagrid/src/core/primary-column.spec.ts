import { describe, expect, it, vi } from 'vitest';
import { applyPrimaryRules, primarySpecOf } from './primary-column';
import type { ColumnDef } from './types/column.types';

interface Row {
  id: number;
  code: string;
}

describe('primarySpecOf', () => {
  it('reads both declarations as the same thing', () => {
    expect(primarySpecOf<Row>({ id: 'code', primary: true })).toEqual({});
    const href = (row: Row): string => `/bookings/${row.id.toString()}`;
    expect(primarySpecOf<Row>({ id: 'code', primary: { href } })).toEqual({ href });
  });

  it('says nothing for an ordinary column', () => {
    expect(primarySpecOf<Row>({ id: 'code' })).toBe(null);
    expect(primarySpecOf<Row>({ id: 'code', primary: false })).toBe(null);
  });
});

describe('applyPrimaryRules', () => {
  const reported = (): Set<string> => new Set<string>();

  it('leaves a set with no primary column as it was', () => {
    const columns: ColumnDef<Row>[] = [{ id: 'code' }];
    expect(applyPrimaryRules(columns, reported())).toBe(columns);
  });

  it('pins to the start and locks hiding and reordering', () => {
    const [column] = applyPrimaryRules<Row>([{ id: 'code', primary: true }], reported());
    expect(column).toMatchObject({
      pinned: 'start',
      allow: { hiding: false, reordering: false },
    });
  });

  it('honours a declared end edge', () => {
    const [column] = applyPrimaryRules<Row>(
      [{ id: 'code', primary: true, pinned: 'end' }],
      reported(),
    );
    expect(column.pinned).toBe('end');
  });

  it('keeps the permissions the column declared for itself', () => {
    const [column] = applyPrimaryRules<Row>(
      [{ id: 'code', primary: true, allow: { sorting: false } }],
      reported(),
    );
    expect(column.allow).toEqual({ sorting: false, hiding: false, reordering: false });
  });

  it('reports a second primary column and leaves it ordinary', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const columns = applyPrimaryRules<Row>(
      [
        { id: 'code', primary: true },
        { id: 'ref', primary: true },
      ],
      reported(),
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(primarySpecOf(columns[1])).toBe(null);
    expect(columns[1].pinned).toBeUndefined();
    warn.mockRestore();
  });

  it('reports one column once, however often the definitions are re-read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seen = reported();
    const columns: ColumnDef<Row>[] = [
      { id: 'code', primary: true },
      { id: 'ref', primary: true },
    ];
    applyPrimaryRules(columns, seen);
    applyPrimaryRules(columns, seen);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

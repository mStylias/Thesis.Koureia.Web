import { densityStep, fitList, packTimed } from './tile-layout';
import type { TimedItem } from './tile-layout.types';

const item = (id: string, start: number, end: number): TimedItem => ({ id, start, end });
const options = { minMinutes: 30, maxColumns: 4 };

describe('packTimed', () => {
  it('gives a lone event the whole column', () => {
    const { tiles, overflow } = packTimed([item('a', 540, 600)], options);

    expect(tiles).toEqual([{ id: 'a', start: 540, end: 600, column: 0, columns: 1 }]);
    expect(overflow).toEqual([]);
  });

  it('puts overlapping events side by side and shares the column count across the cluster', () => {
    const { tiles } = packTimed(
      [item('a', 540, 600), item('b', 570, 630), item('c', 600, 660)],
      options,
    );

    expect(tiles.map((tile) => [tile.id, tile.column, tile.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      // `c` starts as `a` ends, so it takes the first column back.
      ['c', 0, 2],
    ]);
  });

  it('opens a new cluster when everything before has ended', () => {
    const { tiles } = packTimed([item('a', 540, 600), item('b', 600, 660)], options);

    expect(tiles.map((tile) => tile.columns)).toEqual([1, 1]);
  });

  it('stretches a short event to the minimum, and packs by the stretched end', () => {
    const { tiles } = packTimed([item('a', 540, 545), item('b', 560, 600)], options);

    expect(tiles.find((tile) => tile.id === 'a')?.end).toBe(570);
    expect(tiles.map((tile) => tile.columns)).toEqual([2, 2]);
  });

  it('hands the events past the column cap to one overflow chip', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => item(id, 540 + index * 5, 660));
    const { tiles, overflow } = packTimed(items, { minMinutes: 30, maxColumns: 4 });

    expect(tiles).toHaveLength(4);
    expect(tiles.every((tile) => tile.columns === 4)).toBe(true);
    expect(overflow).toEqual([{ start: 560, end: 660, ids: ['e', 'f'] }]);
  });

  it('orders by start, then longer first, then id, so the layout is stable', () => {
    const { tiles } = packTimed(
      [item('b', 540, 600), item('a', 540, 660), item('c', 540, 600)],
      options,
    );

    expect(tiles.map((tile) => tile.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('fitList', () => {
  it('shows everything that fits', () => {
    expect(fitList(['a', 'b'], 3)).toEqual({ visible: ['a', 'b'], hidden: 0 });
    expect(fitList(['a', 'b', 'c'], 3)).toEqual({ visible: ['a', 'b', 'c'], hidden: 0 });
  });

  it('gives one row to the chip when the list overflows', () => {
    expect(fitList(['a', 'b', 'c', 'd'], 3)).toEqual({ visible: ['a', 'b'], hidden: 2 });
  });

  it('shows the chip alone when there is room for one row', () => {
    expect(fitList(['a', 'b'], 1)).toEqual({ visible: [], hidden: 2 });
  });
});

describe('densityStep', () => {
  it('has four steps', () => {
    expect([0, 1, 2, 3, 5, 6, 40].map(densityStep)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

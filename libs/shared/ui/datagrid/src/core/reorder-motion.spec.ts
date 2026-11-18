import { computeColumnLayout } from './column-layout';
import { placementsOf, rearrangement } from './reorder-motion';
import type { Rearrangement } from './reorder-motion.types';
import type { ColumnDef } from './types/column.types';

function placements(columns: ColumnDef[]): ReturnType<typeof placementsOf> {
  return placementsOf(
    computeColumnLayout(columns, {
      containerWidth: 0,
      defaultWidth: 100,
      minWidth: 50,
      fit: false,
    }),
  );
}

/** The same columns under `fitColumns`, where the container decides the widths. */
function fitted(columns: ColumnDef[], containerWidth: number): ReturnType<typeof placementsOf> {
  return placementsOf(
    computeColumnLayout(columns, {
      containerWidth,
      defaultWidth: 100,
      minWidth: 50,
      fit: true,
    }),
  );
}

/** The travel alone, for the plays where no column changes width. */
function travels(change: Rearrangement | null): [string, number][] {
  return [...(change?.moves ?? [])].map(([id, motion]) => [id, motion.dx]);
}

const abc: ColumnDef[] = [
  { id: 'a', width: 100 },
  { id: 'b', width: 200 },
  { id: 'c', width: 300 },
];

describe('rearrangement', () => {
  it('reports nothing for the first render', () => {
    expect(rearrangement(new Map(), placements(abc))).toBeNull();
  });

  it('reports nothing when the layout did not change', () => {
    expect(rearrangement(placements(abc), placements(abc))).toBeNull();
  });

  // `dx` is where the column has to start, so it reads against the travel: the
  // column moving left starts to the right of where it lands.
  it('plays both columns of a swap, in opposite directions', () => {
    const change = rearrangement(placements(abc), placements([abc[1], abc[0], abc[2]]));
    expect(travels(change)).toEqual([
      ['b', 100],
      ['a', -200],
    ]);
    expect([...(change?.arrived ?? [])]).toEqual([]);
  });

  // A swap moves the boxes and does not resize them, so the width leg of the
  // play has to be absent — `width` costs a layout per frame.
  it('leaves the widths alone on a swap', () => {
    const change = rearrangement(placements(abc), placements([abc[1], abc[0], abc[2]]));
    for (const [, motion] of change?.moves ?? []) {
      expect(motion.fromWidth).toBe(motion.toWidth);
    }
  });

  it('closes the gap a removed column leaves', () => {
    const change = rearrangement(placements(abc), placements([abc[0], abc[2]]));
    expect(travels(change)).toEqual([['c', 200]]);
    expect([...(change?.arrived ?? [])]).toEqual([]);
  });

  it('opens a gap for a column that arrives, and marks it as arriving', () => {
    const change = rearrangement(placements([abc[0], abc[2]]), placements(abc));
    expect(travels(change)).toEqual([['c', -200]]);
    expect([...(change?.arrived ?? [])]).toEqual(['b']);
  });

  // A resize walks these offsets a pixel at a time. Playing a 260ms slide on
  // every drag frame would leave the columns permanently chasing the pointer.
  it('refuses a width change with the same columns on both sides', () => {
    const wider: ColumnDef[] = [abc[0], { id: 'b', width: 220 }, abc[2]];
    expect(rearrangement(placements(abc), placements(wider))).toBeNull();
  });

  // Same refusal, for the reflow a container resize plays under `fit`.
  it('refuses a fit re-spread the columns did not change', () => {
    expect(rearrangement(fitted(abc, 1200), fitted(abc, 900))).toBeNull();
  });

  // Under `fit` every survivor takes a share of the width the column gave up,
  // so the removal that must play is also a width change on all of them. `a`
  // travels nowhere and still plays: growing in place is its whole part in the
  // move, and leaving it out is what made the first frame jump.
  it('grows the survivors under fit as well as moving them', () => {
    const change = rearrangement(fitted(abc, 1200), fitted([abc[0], abc[2]], 1200));
    expect([...(change?.moves ?? [])]).toEqual([
      ['a', { dx: 0, fromWidth: 200, toWidth: 300 }],
      ['c', { dx: 300, fromWidth: 600, toWidth: 900 }],
    ]);
    expect([...(change?.arrived ?? [])]).toEqual([]);
  });

  it('shrinks the survivors under fit when a column arrives', () => {
    const change = rearrangement(fitted([abc[0], abc[2]], 1200), fitted(abc, 1200));
    expect([...(change?.moves ?? [])]).toEqual([
      ['a', { dx: 0, fromWidth: 300, toWidth: 200 }],
      ['c', { dx: -300, fromWidth: 900, toWidth: 600 }],
    ]);
    expect([...(change?.arrived ?? [])]).toEqual(['b']);
  });

  // A pinned cell is sticky: what it travels is the change of inset, which is
  // not the change of its place on the canvas.
  it('refuses a pin', () => {
    const pinned: ColumnDef[] = [{ ...abc[1], pinned: 'start' }, abc[0], abc[2]];
    expect(rearrangement(placements(abc), placements(pinned))).toBeNull();
  });
});

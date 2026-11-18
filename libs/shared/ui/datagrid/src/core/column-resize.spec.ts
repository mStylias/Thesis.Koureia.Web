import { ColumnStore } from './column.store';
import { computeColumnLayout } from './column-layout';
import type { GridLayout } from './column-layout.types';
import { reorderTarget, resizeColumn, swapTarget } from './column-resize';
import type { ColumnBox, ResizeOptions } from './column-resize.types';
import type { ColumnDef } from './types/column.types';

function layoutOf(columns: ColumnDef[]): GridLayout {
  return computeColumnLayout(columns, {
    containerWidth: 0,
    defaultWidth: 100,
    minWidth: 50,
    fit: false,
  });
}

function widenOptions(): ResizeOptions {
  return { minWidth: 50, mode: 'widen' };
}

function adjacentOptions(): ResizeOptions {
  return { minWidth: 50, mode: 'adjacent' };
}

describe('resizeColumn', () => {
  describe("mode: 'widen'", () => {
    it('grows the target column only', () => {
      const layout = layoutOf([
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ]);
      expect(resizeColumn(layout, 'a', 20, widenOptions())).toEqual([{ id: 'a', width: 120 }]);
    });

    it('clamps at the minWidth', () => {
      const layout = layoutOf([{ id: 'a', width: 100, minWidth: 80 }]);
      expect(resizeColumn(layout, 'a', -500, widenOptions())).toEqual([{ id: 'a', width: 80 }]);
    });

    it('clamps at the maxWidth', () => {
      const layout = layoutOf([{ id: 'a', width: 100, maxWidth: 150 }]);
      expect(resizeColumn(layout, 'a', 500, widenOptions())).toEqual([{ id: 'a', width: 150 }]);
    });

    it('returns [] when the width would not change', () => {
      const layout = layoutOf([{ id: 'a', width: 100 }]);
      expect(resizeColumn(layout, 'a', 0, widenOptions())).toEqual([]);
    });

    it('returns [] when allow.resizing is false', () => {
      const layout = layoutOf([{ id: 'a', width: 100, allow: { resizing: false } }]);
      expect(resizeColumn(layout, 'a', 20, widenOptions())).toEqual([]);
    });
  });

  describe("mode: 'adjacent'", () => {
    it('grows the target and shrinks the next column by the same amount, leaving the total width unchanged', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ];
      const layout = layoutOf(columns);
      const result = resizeColumn(layout, 'a', 20, adjacentOptions());
      expect(result).toEqual([
        { id: 'a', width: 120 },
        { id: 'b', width: 80 },
      ]);
      const total = result.reduce((sum, entry) => sum + entry.width, 0);
      expect(total).toBe(layout.totalWidth);
    });

    it('gives the target only what the neighbour releases when the neighbour clamps at its minimum', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100, minWidth: 90 },
      ];
      const layout = layoutOf(columns);
      const result = resizeColumn(layout, 'a', 50, adjacentOptions());
      expect(result).toEqual([
        { id: 'a', width: 110 },
        { id: 'b', width: 90 },
      ]);
      const total = result.reduce((sum, entry) => sum + entry.width, 0);
      expect(total).toBe(layout.totalWidth);
    });

    it('returns [] when there is no resizable neighbour because the target is the last column', () => {
      const layout = layoutOf([
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ]);
      expect(resizeColumn(layout, 'b', 20, adjacentOptions())).toEqual([]);
    });

    it('skips a neighbour with allow.resizing false and uses the next one', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100, allow: { resizing: false } },
        { id: 'c', width: 100 },
      ];
      const layout = layoutOf(columns);
      const result = resizeColumn(layout, 'a', 20, adjacentOptions());
      expect(result).toEqual([
        { id: 'a', width: 120 },
        { id: 'c', width: 80 },
      ]);
    });
  });
});

describe('reorderTarget', () => {
  const abc = (): GridLayout =>
    layoutOf([
      { id: 'a', width: 100 },
      { id: 'b', width: 100 },
      { id: 'c', width: 100 },
    ]);

  it('returns null when dragged onto itself', () => {
    expect(reorderTarget(abc(), 'a', 'a')).toBeNull();
  });

  it('returns null for an unknown dragged id', () => {
    expect(reorderTarget(abc(), 'unknown', 'b')).toBeNull();
  });

  it('returns null for an unknown drop target id', () => {
    expect(reorderTarget(abc(), 'a', 'unknown')).toBeNull();
  });

  it('returns null when the drop target has allow.reordering false', () => {
    const layout = layoutOf([
      { id: 'a', width: 100 },
      { id: 'b', width: 100, allow: { reordering: false } },
    ]);
    expect(reorderTarget(layout, 'a', 'b')).toBeNull();
  });

  it('lands on the target index when dragging rightwards', () => {
    expect(reorderTarget(abc(), 'a', 'c')).toBe(2);
  });

  it('lands on the target index when dragging leftwards', () => {
    expect(reorderTarget(abc(), 'c', 'a')).toBe(0);
  });

  // The regression: a midpoint model resolved a drop on the left half of the
  // next column to the position the dragged column already held, so the
  // indicator lit up and nothing moved.
  it('moves onto the adjacent column wherever within it the drop lands', () => {
    expect(reorderTarget(abc(), 'a', 'b')).toBe(1);
    expect(reorderTarget(abc(), 'b', 'a')).toBe(0);
  });

  // The index only means anything once `ColumnStore.move` consumes it, and the
  // defect lived in that pairing rather than in either half alone.
  describe('applied through the column store', () => {
    function orderAfterDrop(draggedId: string, overId: string): string[] {
      const defs: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
        { id: 'c', width: 100 },
        { id: 'd', width: 100 },
      ];
      const store = new ColumnStore();
      store.setColumns(defs);
      const target = reorderTarget(layoutOf(defs), draggedId, overId);
      if (target == null) {
        throw new Error('drop refused');
      }
      store.move(draggedId, target);
      return store.columns().map((column) => column.id);
    }

    it('puts the dragged column where the target was, dragging right', () => {
      expect(orderAfterDrop('a', 'b')).toEqual(['b', 'a', 'c', 'd']);
      expect(orderAfterDrop('a', 'c')).toEqual(['b', 'c', 'a', 'd']);
      expect(orderAfterDrop('a', 'd')).toEqual(['b', 'c', 'd', 'a']);
    });

    it('puts the dragged column where the target was, dragging left', () => {
      expect(orderAfterDrop('d', 'c')).toEqual(['a', 'b', 'd', 'c']);
      expect(orderAfterDrop('d', 'a')).toEqual(['d', 'a', 'b', 'c']);
      expect(orderAfterDrop('c', 'b')).toEqual(['a', 'c', 'b', 'd']);
    });

    it('never leaves the order unchanged', () => {
      for (const [from, to] of [
        ['a', 'b'],
        ['b', 'a'],
        ['b', 'c'],
        ['c', 'b'],
        ['c', 'd'],
        ['d', 'c'],
      ]) {
        expect(orderAfterDrop(from, to)).not.toEqual(['a', 'b', 'c', 'd']);
      }
    });
  });
});

describe('swapTarget', () => {
  /** Lays the columns out end to end, the way the header renders them. */
  function boxesOf(columns: readonly (readonly [string, number])[]): ColumnBox[] {
    let start = 0;
    return columns.map(([id, width]) => {
      const box: ColumnBox = { id, start, width, reorderable: true };
      start += width;
      return box;
    });
  }

  const abc = (): ColumnBox[] =>
    boxesOf([
      ['a', 100],
      ['b', 100],
      ['c', 100],
    ]);

  it('holds while the pointer is on the near half of the next column', () => {
    expect(swapTarget(abc(), 'a', 120)).toBeNull();
  });

  it('swaps once the pointer passes the middle of the next column', () => {
    expect(swapTarget(abc(), 'a', 160)).toBe('b');
  });

  it('reads the same rule leftwards', () => {
    expect(swapTarget(abc(), 'c', 160)).toBeNull();
    expect(swapTarget(abc(), 'c', 120)).toBe('b');
  });

  it('reaches a column the pointer skipped over', () => {
    expect(swapTarget(abc(), 'a', 280)).toBe('c');
  });

  it('holds over the dragged column itself', () => {
    expect(swapTarget(abc(), 'b', 150)).toBeNull();
  });

  it('holds past the last column', () => {
    expect(swapTarget(abc(), 'a', 400)).toBeNull();
  });

  it('holds over a column that cannot be reordered', () => {
    const boxes = abc();
    boxes[1].reorderable = false;
    expect(swapTarget(boxes, 'a', 160)).toBeNull();
  });

  // The oscillation the midpoint exists to prevent: on contact, a narrow
  // column dropped onto a wide one leaves the pointer inside the wide column
  // after it moves aside, and the pair swaps back and forth.
  it('does not swap back at the pointer that caused the swap', () => {
    const narrowFirst = 215;
    expect(
      swapTarget(
        boxesOf([
          ['a', 60],
          ['b', 300],
        ]),
        'a',
        narrowFirst,
      ),
    ).toBe('b');
    expect(
      swapTarget(
        boxesOf([
          ['b', 300],
          ['a', 60],
        ]),
        'a',
        narrowFirst,
      ),
    ).toBeNull();

    const wideFirst = 335;
    expect(
      swapTarget(
        boxesOf([
          ['a', 300],
          ['b', 60],
        ]),
        'a',
        wideFirst,
      ),
    ).toBe('b');
    expect(
      swapTarget(
        boxesOf([
          ['b', 60],
          ['a', 300],
        ]),
        'a',
        wideFirst,
      ),
    ).toBeNull();
  });
});

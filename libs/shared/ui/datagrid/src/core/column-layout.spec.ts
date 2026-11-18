import { computeColumnLayout } from './column-layout';
import type { ColumnLayout, ColumnLayoutOptions, GridLayout } from './column-layout.types';
import type { ColumnDef } from './types/column.types';

function defaultOptions(overrides: Partial<ColumnLayoutOptions> = {}): ColumnLayoutOptions {
  return { containerWidth: 0, defaultWidth: 100, minWidth: 50, fit: false, ...overrides };
}

function byId(layout: GridLayout, id: string): ColumnLayout {
  const found = layout.columns.find((column) => column.id === id);
  if (found === undefined) {
    throw new Error(`expected a column layout for "${id}"`);
  }
  return found;
}

describe('computeColumnLayout', () => {
  describe('resolved width', () => {
    it('uses the declared numeric width', () => {
      const columns: ColumnDef[] = [{ id: 'a', width: 150 }];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(byId(layout, 'a').width).toBe(150);
    });

    it('falls back to defaultWidth when width is absent', () => {
      const columns: ColumnDef[] = [{ id: 'a' }];
      const layout = computeColumnLayout(columns, defaultOptions({ defaultWidth: 120 }));
      expect(byId(layout, 'a').width).toBe(120);
    });

    it("falls back to defaultWidth when width is 'auto'", () => {
      const columns: ColumnDef[] = [{ id: 'a', width: 'auto' }];
      const layout = computeColumnLayout(columns, defaultOptions({ defaultWidth: 120 }));
      expect(byId(layout, 'a').width).toBe(120);
    });

    it('falls back to defaultWidth when width is 0', () => {
      const columns: ColumnDef[] = [{ id: 'a', width: 0 }];
      const layout = computeColumnLayout(columns, defaultOptions({ defaultWidth: 120 }));
      expect(byId(layout, 'a').width).toBe(120);
    });

    it('falls back to defaultWidth when width is negative', () => {
      const columns: ColumnDef[] = [{ id: 'a', width: -20 }];
      const layout = computeColumnLayout(columns, defaultOptions({ defaultWidth: 120 }));
      expect(byId(layout, 'a').width).toBe(120);
    });

    it('clamps to the per-column minWidth', () => {
      const columns: ColumnDef[] = [{ id: 'a', width: 10, minWidth: 80 }];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(byId(layout, 'a').width).toBe(80);
    });

    it('clamps to the per-column maxWidth', () => {
      const columns: ColumnDef[] = [{ id: 'a', width: 500, maxWidth: 200 }];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(byId(layout, 'a').width).toBe(200);
    });

    it('applies the global minWidth when the column declares none', () => {
      const columns: ColumnDef[] = [{ id: 'a', width: 10 }];
      const layout = computeColumnLayout(columns, defaultOptions({ minWidth: 80 }));
      expect(byId(layout, 'a').width).toBe(80);
    });
  });

  describe('template and totalWidth', () => {
    it('joins the resolved widths as a grid-template-columns value and sums them', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 50 },
        { id: 'c', width: 80 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(layout.template).toBe('100px 50px 80px');
      expect(layout.totalWidth).toBe(230);
    });
  });

  describe('pinned hoisting', () => {
    it('hoists start-pinned columns first and end-pinned columns last, preserving relative order within each group', () => {
      const columns: ColumnDef[] = [
        { id: 'end1', pinned: 'end', width: 60 },
        { id: 'mid1', width: 100 },
        { id: 'start1', pinned: 'start', width: 100 },
        { id: 'mid2', width: 90 },
        { id: 'end2', pinned: 'end', width: 70 },
        { id: 'start2', pinned: 'start', width: 80 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(layout.columns.map((column) => column.id)).toEqual([
        'start1',
        'start2',
        'mid1',
        'mid2',
        'end1',
        'end2',
      ]);
    });
  });

  describe('insets and edge', () => {
    it('gives start-pinned columns cumulative insets from 0, in order', () => {
      const columns: ColumnDef[] = [
        { id: 'start1', pinned: 'start', width: 100 },
        { id: 'start2', pinned: 'start', width: 80 },
        { id: 'mid1', width: 100 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(byId(layout, 'start1').inset).toBe(0);
      expect(byId(layout, 'start2').inset).toBe(100);
    });

    it('gives end-pinned columns cumulative insets from the right', () => {
      const columns: ColumnDef[] = [
        { id: 'mid1', width: 100 },
        { id: 'end1', pinned: 'end', width: 60 },
        { id: 'end2', pinned: 'end', width: 70 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      // end2 renders last: it sits flush against the edge, inset 0.
      expect(byId(layout, 'end2').inset).toBe(0);
      // end1 renders just before it, so it is inset by end2's width.
      expect(byId(layout, 'end1').inset).toBe(70);
    });

    it('leaves unpinned columns with a null inset', () => {
      const columns: ColumnDef[] = [
        { id: 'start1', pinned: 'start', width: 100 },
        { id: 'mid1', width: 100 },
        { id: 'end1', pinned: 'end', width: 60 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(byId(layout, 'mid1').inset).toBeNull();
    });

    it('marks edge true only for the last start-pinned and the first end-pinned column', () => {
      const columns: ColumnDef[] = [
        { id: 'start1', pinned: 'start', width: 100 },
        { id: 'start2', pinned: 'start', width: 80 },
        { id: 'mid1', width: 100 },
        { id: 'end1', pinned: 'end', width: 60 },
        { id: 'end2', pinned: 'end', width: 70 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(byId(layout, 'start1').edge).toBe(false);
      expect(byId(layout, 'start2').edge).toBe(true);
      expect(byId(layout, 'mid1').edge).toBe(false);
      expect(byId(layout, 'end1').edge).toBe(true);
      expect(byId(layout, 'end2').edge).toBe(false);
    });

    it('marks every column edge false when there are no pinned columns', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions());
      expect(layout.columns.every((column) => !column.edge)).toBe(true);
      expect(layout.columns.every((column) => column.inset === null)).toBe(true);
    });
  });

  describe('fit mode', () => {
    it('keeps totalWidth as the plain sum regardless of containerWidth when fit is false', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ];
      const layout = computeColumnLayout(
        columns,
        defaultOptions({ fit: false, containerWidth: 1000 }),
      );
      expect(layout.totalWidth).toBe(200);
    });

    it('grows columns proportionally to fill a container wider than the total', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ];
      const layout = computeColumnLayout(
        columns,
        defaultOptions({ fit: true, containerWidth: 300 }),
      );
      expect(layout.totalWidth).toBeCloseTo(300, 5);
      expect(byId(layout, 'a').width).toBeCloseTo(150, 5);
      expect(byId(layout, 'b').width).toBeCloseTo(150, 5);
    });

    it('stops a column at its maxWidth and hands the surplus to the others', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100, maxWidth: 120 },
        { id: 'b', width: 100 },
      ];
      const layout = computeColumnLayout(
        columns,
        defaultOptions({ fit: true, containerWidth: 300 }),
      );
      expect(byId(layout, 'a').width).toBeCloseTo(120, 5);
      expect(byId(layout, 'b').width).toBeCloseTo(180, 5);
      expect(layout.totalWidth).toBeCloseTo(300, 5);
    });

    it('does not shrink columns when the container is smaller than the total, so the grid scrolls instead of clipping', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 150 },
        { id: 'b', width: 150 },
      ];
      const layout = computeColumnLayout(
        columns,
        defaultOptions({ fit: true, containerWidth: 100 }),
      );
      expect(byId(layout, 'a').width).toBe(150);
      expect(byId(layout, 'b').width).toBe(150);
      expect(layout.totalWidth).toBe(300);
    });

    it('lands on whole pixels that sum to exactly the container width', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
        { id: 'c', width: 100 },
      ];
      const layout = computeColumnLayout(
        columns,
        defaultOptions({ fit: true, containerWidth: 1000 }),
      );
      expect(layout.columns.every((column) => Number.isInteger(column.width))).toBe(true);
      expect(layout.totalWidth).toBe(1000);
    });

    it('leaves no surplus for a second pass to hand out again', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
        { id: 'c', width: 100 },
      ];
      const options = defaultOptions({ fit: true, containerWidth: 1000 });
      const once = computeColumnLayout(columns, options);
      // Feeding the resolved widths back in is what a resize under fit does.
      const again = computeColumnLayout(
        once.columns.map((column) => ({ id: column.id, width: column.width })),
        options,
      );
      expect(again.columns.map((column) => column.width)).toEqual(
        once.columns.map((column) => column.width),
      );
    });

    it('holds a maxWidth column at its cap while settling the remainder', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100, maxWidth: 100 },
        { id: 'b', width: 100 },
        { id: 'c', width: 100 },
      ];
      const layout = computeColumnLayout(
        columns,
        defaultOptions({ fit: true, containerWidth: 1001 }),
      );
      expect(byId(layout, 'a').width).toBe(100);
      expect(layout.totalWidth).toBe(1001);
    });

    it('does not grow columns when the container is unmeasured (0)', () => {
      const columns: ColumnDef[] = [
        { id: 'a', width: 100 },
        { id: 'b', width: 100 },
      ];
      const layout = computeColumnLayout(columns, defaultOptions({ fit: true, containerWidth: 0 }));
      expect(byId(layout, 'a').width).toBe(100);
      expect(byId(layout, 'b').width).toBe(100);
    });
  });

  describe('empty column list', () => {
    it('yields empty columns, totalWidth 0 and an empty template', () => {
      const layout = computeColumnLayout([], defaultOptions());
      expect(layout.columns).toEqual([]);
      expect(layout.totalWidth).toBe(0);
      expect(layout.template).toBe('');
    });
  });
});

import {
  computeRowWindow,
  computeWindow,
  createRowOffsets,
  offsetToRevealEntry,
  pageStep,
  rowOffset,
  safeRowHeight,
  scrollOffsetToReveal,
  totalCanvasHeight,
} from './viewport';

describe('safeRowHeight', () => {
  it('normalizes zero to 1', () => {
    expect(safeRowHeight(0)).toBe(1);
  });

  it('normalizes a negative value to 1', () => {
    expect(safeRowHeight(-10)).toBe(1);
  });

  it('normalizes NaN to 1', () => {
    expect(safeRowHeight(NaN)).toBe(1);
  });

  it('normalizes Infinity to 1', () => {
    expect(safeRowHeight(Infinity)).toBe(1);
  });

  it('rounds a fractional value', () => {
    expect(safeRowHeight(24.6)).toBe(25);
  });

  it('never returns below 1, even for a small fraction that rounds to zero', () => {
    expect(safeRowHeight(0.4)).toBe(1);
  });
});

describe('computeRowWindow', () => {
  it('returns an empty window for an empty dataset', () => {
    expect(
      computeRowWindow({ scrollTop: 0, viewportHeight: 100, rowHeight: 10, rowCount: 0 }),
    ).toEqual({ start: 0, end: 0 });
  });

  it('renders from index 0 when scrollTop is 0', () => {
    const window_ = computeRowWindow({
      scrollTop: 0,
      viewportHeight: 100,
      rowHeight: 10,
      rowCount: 1000,
    });
    expect(window_.start).toBe(0);
  });

  it('covers viewportHeight/rowHeight rows plus one extra row', () => {
    const window_ = computeRowWindow({
      scrollTop: 0,
      viewportHeight: 95,
      rowHeight: 10,
      rowCount: 1000,
    });
    // ceil(95 / 10) = 10, plus one extra row.
    expect(window_.end - window_.start).toBe(11);
  });

  it('extends the start edge by overscan, clamped at 0', () => {
    const window_ = computeRowWindow({
      scrollTop: 15,
      viewportHeight: 10,
      rowHeight: 10,
      rowCount: 50,
      overscan: 5,
    });
    expect(window_.start).toBe(0);
  });

  it('extends the end edge by overscan, clamped at rowCount', () => {
    const window_ = computeRowWindow({
      scrollTop: 90,
      viewportHeight: 10,
      rowHeight: 10,
      rowCount: 10,
      overscan: 5,
    });
    expect(window_.end).toBe(10);
  });

  it('derives the first index by floor division for a scrollTop deep into the set', () => {
    const window_ = computeRowWindow({
      scrollTop: 253,
      viewportHeight: 100,
      rowHeight: 25,
      rowCount: 1000,
    });
    expect(window_.start).toBe(10);
  });

  it('yields a non-empty window when the viewport is not measured yet', () => {
    const window_ = computeRowWindow({
      scrollTop: 0,
      viewportHeight: 0,
      rowHeight: 10,
      rowCount: 5,
    });
    expect(window_.end).toBeGreaterThan(window_.start);
  });

  it('treats a negative scrollTop as 0', () => {
    const negative = computeRowWindow({
      scrollTop: -50,
      viewportHeight: 100,
      rowHeight: 10,
      rowCount: 100,
    });
    const zero = computeRowWindow({
      scrollTop: 0,
      viewportHeight: 100,
      rowHeight: 10,
      rowCount: 100,
    });
    expect(negative).toEqual(zero);
  });

  it('treats a NaN scrollTop as 0', () => {
    const nan = computeRowWindow({
      scrollTop: NaN,
      viewportHeight: 100,
      rowHeight: 10,
      rowCount: 100,
    });
    const zero = computeRowWindow({
      scrollTop: 0,
      viewportHeight: 100,
      rowHeight: 10,
      rowCount: 100,
    });
    expect(nan).toEqual(zero);
  });

  it('never lets end precede start, even when scrollTop lands past the last row', () => {
    const window_ = computeRowWindow({
      scrollTop: 100000,
      viewportHeight: 50,
      rowHeight: 10,
      rowCount: 5,
      overscan: 2,
    });
    expect(window_.end).toBeGreaterThanOrEqual(window_.start);
  });
});

describe('rowOffset', () => {
  it('multiplies the row index by the row height', () => {
    expect(rowOffset(4, 10)).toBe(40);
  });

  it('clamps a negative index to 0', () => {
    expect(rowOffset(-3, 10)).toBe(0);
  });

  it('normalizes the row height before multiplying', () => {
    expect(rowOffset(4, 10.6)).toBe(44);
  });
});

describe('totalCanvasHeight', () => {
  it('multiplies rowCount by the row height', () => {
    expect(totalCanvasHeight(10, 20)).toBe(200);
  });

  it('clamps a negative rowCount to 0', () => {
    expect(totalCanvasHeight(-5, 20)).toBe(0);
  });
});

describe('pageStep', () => {
  it('returns the floor of viewportHeight / rowHeight', () => {
    expect(pageStep(100, 20)).toBe(5);
  });

  it('returns at least 1 when the viewport is shorter than one row', () => {
    expect(pageStep(15, 20)).toBe(1);
  });

  it('returns at least 1 for an unmeasured viewport', () => {
    expect(pageStep(0, 20)).toBe(1);
  });
});

describe('scrollOffsetToReveal', () => {
  it('returns null when the row is fully visible', () => {
    const offset = scrollOffsetToReveal({
      index: 5,
      rowHeight: 10,
      scrollTop: 0,
      viewportHeight: 100,
    });
    expect(offset).toBeNull();
  });

  it('returns the row top when the row is above the current scroll', () => {
    const offset = scrollOffsetToReveal({
      index: 2,
      rowHeight: 10,
      scrollTop: 50,
      viewportHeight: 100,
    });
    expect(offset).toBe(20);
  });

  it('returns bottom-minus-viewportHeight when the row is below the current scroll', () => {
    const offset = scrollOffsetToReveal({
      index: 20,
      rowHeight: 10,
      scrollTop: 0,
      viewportHeight: 100,
    });
    expect(offset).toBe(110);
  });

  it('never returns a negative offset', () => {
    const above = scrollOffsetToReveal({
      index: 0,
      rowHeight: 10,
      scrollTop: 50,
      viewportHeight: 100,
    });
    if (above === null) {
      throw new Error('expected a scroll offset');
    }
    expect(above).toBeGreaterThanOrEqual(0);

    const below = scrollOffsetToReveal({
      index: 1,
      rowHeight: 10,
      scrollTop: 0,
      viewportHeight: 15,
    });
    if (below === null) {
      throw new Error('expected a scroll offset');
    }
    expect(below).toBeGreaterThanOrEqual(0);
  });

  it('does not force a scroll for a row below with an unmeasured viewport', () => {
    const offset = scrollOffsetToReveal({
      index: 20,
      rowHeight: 10,
      scrollTop: 0,
      viewportHeight: 0,
    });
    expect(offset).toBeNull();
  });

  it('still forces a scroll for a row above with an unmeasured viewport', () => {
    const offset = scrollOffsetToReveal({
      index: 2,
      rowHeight: 10,
      scrollTop: 50,
      viewportHeight: 0,
    });
    expect(offset).toBe(20);
  });
});

describe('createRowOffsets', () => {
  it('takes the uniform path when no heights are given', () => {
    const offsets = createRowOffsets(null, { count: 10, rowHeight: 40 });
    expect(offsets.uniform).toBe(true);
    expect(offsets.totalHeight).toBe(400);
    expect(offsets.offsetOf(3)).toBe(120);
  });

  // The plain case must stay arithmetic: a body of nothing but data rows is
  // what a grid without grouping renders, and it must allocate nothing per frame.
  it('takes the uniform path when every declared height is equal', () => {
    expect(createRowOffsets([40, 40, 40], { count: 3, rowHeight: 40 }).uniform).toBe(true);
  });

  it('takes the variable path when the heights differ', () => {
    const offsets = createRowOffsets([32, 40, 200, 40], { count: 4, rowHeight: 40 });
    expect(offsets.uniform).toBe(false);
    expect(offsets.totalHeight).toBe(312);
  });

  it('sums the heights before an entry', () => {
    const offsets = createRowOffsets([32, 40, 200, 40], { count: 4, rowHeight: 40 });
    expect(offsets.offsetOf(0)).toBe(0);
    expect(offsets.offsetOf(1)).toBe(32);
    expect(offsets.offsetOf(2)).toBe(72);
    expect(offsets.offsetOf(3)).toBe(272);
  });

  it('reports each entry its own height', () => {
    const offsets = createRowOffsets([32, 40, 200], { count: 3, rowHeight: 40 });
    expect(offsets.heightOf(2)).toBe(200);
  });

  it('finds the entry covering an offset', () => {
    const offsets = createRowOffsets([32, 40, 200, 40], { count: 4, rowHeight: 40 });
    expect(offsets.indexAt(0)).toBe(0);
    expect(offsets.indexAt(31)).toBe(0);
    expect(offsets.indexAt(32)).toBe(1);
    expect(offsets.indexAt(271)).toBe(2);
    expect(offsets.indexAt(272)).toBe(3);
  });

  it('clamps an offset past the end to the last entry', () => {
    const offsets = createRowOffsets([32, 40], { count: 2, rowHeight: 40 });
    expect(offsets.indexAt(10_000)).toBe(1);
  });

  it('normalizes a zero height rather than dividing by it', () => {
    const offsets = createRowOffsets([0, 40], { count: 2, rowHeight: 40 });
    expect(offsets.heightOf(0)).toBe(1);
  });

  it('reports an empty body as empty', () => {
    const offsets = createRowOffsets([], { count: 0, rowHeight: 40 });
    expect(offsets.count).toBe(0);
    expect(offsets.totalHeight).toBe(0);
  });
});

describe('computeWindow', () => {
  const offsets = createRowOffsets([32, 40, 200, 40, 40, 40], { count: 6, rowHeight: 40 });

  it('covers the visible band of a variable-height body', () => {
    expect(computeWindow(offsets, { scrollTop: 0, viewportHeight: 100 })).toEqual({
      start: 0,
      end: 3,
    });
  });

  it('starts at the entry the scroll offset lands in', () => {
    expect(computeWindow(offsets, { scrollTop: 100, viewportHeight: 100 })).toEqual({
      start: 2,
      end: 3,
    });
  });

  it('grows the window by the overscan on both sides', () => {
    expect(computeWindow(offsets, { scrollTop: 100, viewportHeight: 100, overscan: 1 })).toEqual({
      start: 1,
      end: 4,
    });
  });

  it('clamps to the body rather than running past it', () => {
    expect(computeWindow(offsets, { scrollTop: 10_000, viewportHeight: 400 })).toEqual({
      start: 5,
      end: 6,
    });
  });

  it('renders one band while the viewport is unmeasured', () => {
    expect(computeWindow(offsets, { scrollTop: 0, viewportHeight: 0 })).toEqual({
      start: 0,
      end: 1,
    });
  });

  it('produces an empty window for an empty body', () => {
    const empty = createRowOffsets([], { count: 0, rowHeight: 40 });
    expect(computeWindow(empty, { scrollTop: 0, viewportHeight: 400 })).toEqual({
      start: 0,
      end: 0,
    });
  });
});

describe('offsetToRevealEntry', () => {
  const offsets = createRowOffsets([32, 40, 200, 40], { count: 4, rowHeight: 40 });

  it('returns null for an entry already in view', () => {
    expect(
      offsetToRevealEntry(offsets, { index: 1, scrollTop: 0, viewportHeight: 300 }),
    ).toBeNull();
  });

  it('scrolls up to an entry above the viewport', () => {
    expect(offsetToRevealEntry(offsets, { index: 0, scrollTop: 100, viewportHeight: 100 })).toBe(0);
  });

  it('scrolls down by the entry own height, not by the row height', () => {
    expect(offsetToRevealEntry(offsets, { index: 2, scrollTop: 0, viewportHeight: 100 })).toBe(172);
  });

  it('returns null for an empty body', () => {
    const empty = createRowOffsets([], { count: 0, rowHeight: 40 });
    expect(offsetToRevealEntry(empty, { index: 0, scrollTop: 0, viewportHeight: 100 })).toBeNull();
  });
});

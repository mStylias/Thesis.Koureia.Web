import { clampRect, moveRect, resizeRect } from './floating-panel-geometry';
import type { PanelRect, PanelSize } from './floating-panel-geometry.types';

const BOUNDS: PanelRect = { left: 10, top: 60, width: 1000, height: 600 };
const MIN: PanelSize = { width: 200, height: 150 };
const START: PanelRect = { left: 700, top: 60, width: 300, height: 600 };

describe('moveRect', () => {
  it('moves by the delta and keeps the size', () => {
    const tall = { ...START, height: 400 };

    expect(moveRect(tall, -100, 50, BOUNDS, MIN)).toEqual({
      left: 600,
      top: 110,
      width: 300,
      height: 400,
    });
  });

  it('stops at every edge of the bounds', () => {
    expect(moveRect(START, 500, -500, BOUNDS, MIN)).toEqual({ ...START, left: 710, top: 60 });
    expect(moveRect(START, -2000, 500, BOUNDS, MIN)).toEqual({ ...START, left: 10, top: 60 });
  });
});

describe('resizeRect', () => {
  it('grows to the left from the west grip and keeps the right edge', () => {
    const next = resizeRect(START, 'w', -100, 0, BOUNDS, MIN);

    expect(next).toEqual({ left: 600, top: 60, width: 400, height: 600 });
    expect(next.left + next.width).toBe(START.left + START.width);
  });

  it('moves the top edge down from the north grip and keeps the bottom edge', () => {
    expect(resizeRect(START, 'n', 0, 100, BOUNDS, MIN)).toEqual({
      left: 700,
      top: 160,
      width: 300,
      height: 500,
    });
  });

  it('moves both edges a corner names', () => {
    expect(resizeRect(START, 'nw', -50, 40, BOUNDS, MIN)).toEqual({
      left: 650,
      top: 100,
      width: 350,
      height: 560,
    });
  });

  it('stops at the minimum size', () => {
    expect(resizeRect(START, 'e', -500, 0, BOUNDS, MIN).width).toBe(200);
    expect(resizeRect(START, 'w', 500, 0, BOUNDS, MIN)).toEqual({
      left: 800,
      top: 60,
      width: 200,
      height: 600,
    });
  });

  it('stops at the bounds', () => {
    expect(resizeRect(START, 'e', 500, 0, BOUNDS, MIN).width).toBe(310);
    expect(resizeRect(START, 's', 0, 500, BOUNDS, MIN).height).toBe(600);
  });
});

describe('clampRect', () => {
  it('pulls a box back inside bounds that shrank', () => {
    const smaller: PanelRect = { left: 10, top: 60, width: 800, height: 400 };

    expect(clampRect(START, smaller, MIN)).toEqual({ left: 510, top: 60, width: 300, height: 400 });
  });

  it('lets bounds smaller than the minimum win', () => {
    const tiny: PanelRect = { left: 0, top: 0, width: 120, height: 100 };

    expect(clampRect(START, tiny, MIN)).toEqual({ left: 0, top: 0, width: 120, height: 100 });
  });
});

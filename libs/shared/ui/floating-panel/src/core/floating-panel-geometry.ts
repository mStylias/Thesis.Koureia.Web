import type { PanelEdge, PanelRect, PanelSize } from './floating-panel-geometry.types';

/** Every grip, in the order the template draws them. */
export const PANEL_EDGES: readonly PanelEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/**
 * Fits a box inside the bounds: first the size, then the place.
 *
 * Bounds smaller than the minimum win over the minimum, so the panel never
 * leaves the viewport on a small window.
 */
export function clampRect(rect: PanelRect, bounds: PanelRect, min: PanelSize): PanelRect {
  const width = clamp(rect.width, Math.min(min.width, bounds.width), bounds.width);
  const height = clamp(rect.height, Math.min(min.height, bounds.height), bounds.height);
  return {
    left: clamp(rect.left, bounds.left, bounds.left + bounds.width - width),
    top: clamp(rect.top, bounds.top, bounds.top + bounds.height - height),
    width,
    height,
  };
}

/** Moves a box by a pointer delta. The size does not change. */
export function moveRect(
  start: PanelRect,
  dx: number,
  dy: number,
  bounds: PanelRect,
  min: PanelSize,
): PanelRect {
  return clampRect({ ...start, left: start.left + dx, top: start.top + dy }, bounds, min);
}

/**
 * Moves the edges a grip names by a pointer delta. The opposite edges stay
 * where they are, so a drag on the west grip grows the panel to the left.
 */
export function resizeRect(
  start: PanelRect,
  edge: PanelEdge,
  dx: number,
  dy: number,
  bounds: PanelRect,
  min: PanelSize,
): PanelRect {
  const [left, width] = resizeAxis(
    start.left,
    start.width,
    dx,
    edge.includes('w') ? 'start' : edge.includes('e') ? 'end' : null,
    bounds.left,
    bounds.left + bounds.width,
    min.width,
  );
  const [top, height] = resizeAxis(
    start.top,
    start.height,
    dy,
    edge.includes('n') ? 'start' : edge.includes('s') ? 'end' : null,
    bounds.top,
    bounds.top + bounds.height,
    min.height,
  );
  return { left, top, width, height };
}

function resizeAxis(
  position: number,
  size: number,
  delta: number,
  side: 'start' | 'end' | null,
  boundStart: number,
  boundEnd: number,
  minSize: number,
): [number, number] {
  if (side === 'end') {
    const end = clamp(position + size + delta, position + minSize, boundEnd);
    return [position, end - position];
  }
  if (side === 'start') {
    const end = position + size;
    const start = clamp(position + delta, boundStart, end - minSize);
    return [start, end - start];
  }
  return [position, size];
}

/** The upper limit wins when the limits cross. */
function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), upper);
}

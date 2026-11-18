import { ConnectedPosition, ConnectionPositionPair } from '@angular/cdk/overlay';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

// Gap between the target and the tooltip surface — mirrors --space-2
// (8px). CDK connected positions take pixel offsets, not CSS values.
const TOOLTIP_OFFSET = 8;

const CONNECTED_POSITIONS: Record<TooltipPosition, ConnectedPosition> = {
  top: {
    originX: 'center',
    originY: 'top',
    overlayX: 'center',
    overlayY: 'bottom',
    offsetY: -TOOLTIP_OFFSET,
  },
  bottom: {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: TOOLTIP_OFFSET,
  },
  left: {
    originX: 'start',
    originY: 'center',
    overlayX: 'end',
    overlayY: 'center',
    offsetX: -TOOLTIP_OFFSET,
  },
  right: {
    originX: 'end',
    originY: 'center',
    overlayX: 'start',
    overlayY: 'center',
    offsetX: TOOLTIP_OFFSET,
  },
};

const OPPOSITE: Record<TooltipPosition, TooltipPosition> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/**
 * Preferred position first, its opposite second (the natural flip when
 * the viewport runs out of room), then the remaining sides.
 */
export function buildTooltipPositions(preferred: TooltipPosition): ConnectedPosition[] {
  const rest = (Object.keys(CONNECTED_POSITIONS) as TooltipPosition[]).filter(
    (p) => p !== preferred && p !== OPPOSITE[preferred],
  );

  return [preferred, OPPOSITE[preferred], ...rest].map((p) => CONNECTED_POSITIONS[p]);
}

/** The side the overlay actually landed on, for origin-aware animation. */
export function resolveTooltipPosition(pair: ConnectionPositionPair): TooltipPosition {
  if (pair.overlayY === 'bottom') {
    return 'top';
  }
  if (pair.overlayY === 'top') {
    return 'bottom';
  }
  return pair.overlayX === 'end' ? 'left' : 'right';
}

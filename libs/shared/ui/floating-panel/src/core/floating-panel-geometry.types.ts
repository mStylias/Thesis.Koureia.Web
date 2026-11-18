/** A box in viewport pixels. */
export interface PanelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The smallest box a resize may leave. */
export interface PanelSize {
  width: number;
  height: number;
}

/** The edge or corner a resize grip sits on, as compass points. */
export type PanelEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

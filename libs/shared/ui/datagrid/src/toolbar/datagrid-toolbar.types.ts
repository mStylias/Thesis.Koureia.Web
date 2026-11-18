import type { ToolbarEntry, ToolbarLocation } from '../core/toolbar.types';

/** One region of the bar, with the entries that stayed in it. */
export interface ToolbarRegionView {
  location: ToolbarLocation;
  entries: readonly ToolbarEntry[];
}

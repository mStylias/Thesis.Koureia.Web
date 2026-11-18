/**
 * The capability mask (§3.3).
 *
 * A capability answers "may the user do this here". It is separate from the
 * per-column `allow` of §5, which answers "does this column permit it", and
 * from whether a feature is loaded at all. The two combine by conjunction, so
 * neither can override the other.
 *
 * The mask is configuration, not user state: it never reaches `GridState` and
 * is never persisted.
 */
import type { ColumnAllow } from './types/column.types';
import type { GridCapabilities, GridCapability } from './types/config.types';
import type { GridCapabilityMask } from './capabilities.types';
/** Every capability, in declaration order. */
export const GRID_CAPABILITIES: readonly GridCapability[] = [
  'sorting',
  'filtering',
  'grouping',
  'reordering',
  'resizing',
  'hiding',
  'editing',
  'selection',
  'paging',
  'exporting',
  'stateChange',
];

function maskOf(granted: boolean): Record<GridCapability, boolean> {
  return Object.fromEntries(GRID_CAPABILITIES.map((capability) => [capability, granted])) as Record<
    GridCapability,
    boolean
  >;
}

/** Everything permitted, which is what a grid with no mask declares. */
export const ALL_CAPABILITIES: GridCapabilityMask = maskOf(true);

/**
 * Resolves a declaration into an answer per capability.
 *
 * `readOnly` withholds every capability in one line and the individual keys
 * re-grant selectively, so one set of columns and one config object serve a
 * read-only presentation and an interactive one.
 */
export function resolveCapabilities(mask?: GridCapabilities | null): GridCapabilityMask {
  if (mask == null) {
    return ALL_CAPABILITIES;
  }
  const resolved = maskOf(mask.readOnly !== true);
  for (const capability of GRID_CAPABILITIES) {
    const declared = mask[capability];
    if (declared !== undefined) {
      resolved[capability] = declared;
    }
  }
  return resolved;
}

/**
 * The capability each per-column permission pairs with. A column's header
 * filter is filtering: the surface differs, the class of action does not.
 */
export const CAPABILITY_OF_ALLOW: Readonly<Record<keyof ColumnAllow, GridCapability>> = {
  sorting: 'sorting',
  filtering: 'filtering',
  headerFiltering: 'filtering',
  rowFiltering: 'filtering',
  grouping: 'grouping',
  reordering: 'reordering',
  resizing: 'resizing',
  hiding: 'hiding',
  editing: 'editing',
  exporting: 'exporting',
};

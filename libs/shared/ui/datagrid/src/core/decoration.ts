/**
 * What a host {@link Decoration} may contribute to a row or a cell.
 *
 * Classes and styles pass through. ARIA does not pass through untouched: the
 * grid publishes a table structure of its own, and an attribute that
 * contradicts it turns a correct grid into an incorrect one for the only
 * users who read those attributes.
 */
import type { Decoration } from './types/config.types';

/**
 * Attributes the grid owns. Every one of them names a position, a state or a
 * role the grid computes, so a decoration that set one would describe a grid
 * that is not there.
 */
const RESERVED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'role',
  'tabindex',
  'aria-colcount',
  'aria-colindex',
  'aria-expanded',
  'aria-level',
  'aria-rowcount',
  'aria-rowindex',
  'aria-selected',
]);

/** The styles a decoration contributes, or `null` when it contributes none. */
export function decorationStyles(
  decoration: Decoration | null,
): Readonly<Record<string, string>> | null {
  const styles = decoration?.styles;
  return styles == null || Object.keys(styles).length === 0 ? null : styles;
}

/** The ARIA a decoration may contribute, or `null` when it contributes none. */
export function decorationAria(
  decoration: Decoration | null,
): Readonly<Record<string, string>> | null {
  const aria = decoration?.aria;
  if (aria == null) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(aria)) {
    const attribute = name.toLowerCase();
    if (!RESERVED_ATTRIBUTES.has(attribute)) {
      result[attribute] = value;
    }
  }
  return Object.keys(result).length === 0 ? null : result;
}

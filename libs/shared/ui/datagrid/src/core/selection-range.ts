/**
 * Range and select-all arithmetic over the loaded key order.
 *
 * Ranges are resolved against the keys as currently ordered, so a range
 * selected after a sort covers what the user saw, not what the source
 * returned.
 */
import type { GridKey } from './types/key.types';
import type { SelectAllState } from './selection-range.types';
/** Keys between two anchors inclusive, in the given order. Either end may be first. */
export function rangeBetween(
  keys: readonly GridKey[],
  anchor: GridKey,
  target: GridKey,
): GridKey[] {
  const from = keys.indexOf(anchor);
  const to = keys.indexOf(target);
  if (from < 0 || to < 0) {
    return to < 0 ? [] : [target];
  }
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return keys.slice(start, end + 1);
}

export function selectAllState(
  keys: readonly GridKey[],
  isSelected: (key: GridKey) => boolean,
): SelectAllState {
  if (keys.length === 0) {
    return 'none';
  }
  let selected = 0;
  for (const key of keys) {
    if (isSelected(key)) {
      selected += 1;
    }
  }
  if (selected === 0) {
    return 'none';
  }
  return selected === keys.length ? 'all' : 'some';
}

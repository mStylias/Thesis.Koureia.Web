/** Dot-path access into item objects. */

/**
 * Reads a value at a dot path. Returns `undefined` when any segment is
 * missing or not an object.
 */
export function getPath(source: unknown, path: string): unknown {
  if (source == null) {
    return undefined;
  }
  if (!path.includes('.')) {
    return (source as Record<string, unknown>)[path];
  }
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

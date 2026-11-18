/** One segment of a validation-error property path: a member name or an array index. */
export type PropertyPathSegment = string | number;

/**
 * Parses a `ValidationError.propertyName` path into its segments. `"items[2].name"` gives
 * `['items', 2, 'name']`, and `"address.street"` gives `['address', 'street']`.
 *
 * Use it to place a server validation error onto a client-side structure.
 */
export function parsePropertyPath(path: string): PropertyPathSegment[] {
  const segments: PropertyPathSegment[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path)) !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else {
      segments.push(Number(match[2]));
    }
  }
  return segments;
}

/** Writes the segments back as one dotted and indexed path. */
export function formatPropertyPath(segments: readonly PropertyPathSegment[]): string {
  let path = '';
  for (const segment of segments) {
    if (typeof segment === 'number') {
      path += `[${segment}]`;
    } else {
      path += path.length === 0 ? segment : `.${segment}`;
    }
  }
  return path;
}

/** Structural comparison for queries, states and event dedup. */

function canonical(value: unknown): unknown {
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const entry = record[key];
    if (entry !== undefined) {
      result[key] = canonical(entry);
    }
  }
  return result;
}

/**
 * Deep equality insensitive to key order and absent-vs-`undefined`
 * properties. Values must be JSON-representable (plus `Date` and `bigint`).
 */
export function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  try {
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  } catch {
    return false;
  }
}

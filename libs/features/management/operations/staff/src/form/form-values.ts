/**
 * Whether two plain form values hold the same data. The tabs add and remove rows through the
 * model, which Signal Forms does not count as dirty, so a change is a difference from what was
 * loaded.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

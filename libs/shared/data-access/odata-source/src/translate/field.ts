/**
 * Field paths.
 *
 * The contract addresses a nested member with a dot (`customer.name`). OData spells the same
 * path with a slash in `$filter` and `$orderby`, and does not accept it in `$select` at all —
 * there a navigation member is selected inside its own expansion.
 */

/** Turns a contract field into an OData path: `customer.name` into `customer/name`. */
export function odataPath(field: string): string {
  return field.replace(/\./g, '/');
}

/** How a projection splits: the members to select here, and the ones to select inside an expansion. */
export interface Projection {
  /** Members of the element itself. */
  select: readonly string[];
  /**
   * Members to select inside each expansion, keyed by the navigation member.
   *
   * An entry with an empty list expands without narrowing, which is what a bare `expand`
   * entry asks for.
   */
  expand: ReadonlyMap<string, readonly string[]>;
}

/**
 * Splits a contract projection into `$select` and a nested `$expand`.
 *
 * `select: ['id', 'customer.name']` with `expand: ['customer']` becomes
 * `$select=id&$expand=customer($select=name)`. A dot path implies its own expansion, so a host
 * that projected `customer.name` without also naming `customer` still gets the expansion it
 * needs.
 */
export function splitProjection(
  select: readonly string[] | undefined,
  expand: readonly string[] | undefined,
): Projection {
  const own = new Set<string>();
  const nested = new Map<string, Set<string>>();

  for (const entity of expand ?? []) {
    // A bare expansion is requested whole. A later dot path may narrow it.
    nested.set(entity, new Set<string>());
  }

  for (const field of select ?? []) {
    const separator = field.indexOf('.');
    if (separator < 0) {
      own.add(field);
      continue;
    }
    const entity = field.slice(0, separator);
    const member = field.slice(separator + 1);
    const members = nested.get(entity) ?? new Set<string>();
    // Only a leaf narrows. A deeper path (`a.b.c`) is left to the expansion whole rather
    // than guessing a second level the host did not ask for.
    if (!member.includes('.')) {
      members.add(member);
    }
    nested.set(entity, members);
  }

  return {
    select: [...own],
    expand: new Map([...nested].map(([entity, members]) => [entity, [...members]])),
  };
}

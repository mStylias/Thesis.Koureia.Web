import type { GrantablePermissionResponse } from '../../roles.types';

/**
 * What a row of the permission tree carries.
 *
 * The catalog groups by a flat `category` string, so the tree is exactly two levels and a row
 * is one or the other. A category row exists to group and to cascade; only a permission row
 * names a code the server accepts.
 */
export type PermissionNodeData =
  | { readonly kind: 'category'; readonly category: string }
  | { readonly kind: 'permission'; readonly permission: GrantablePermissionResponse };

/**
 * How a row gets its visible text.
 *
 * Both kinds are resolved through the caller rather than read off the catalog: a category has no
 * string of its own at all, and a permission's `name` off the wire is only the English fallback.
 */
export interface PermissionTreeLabels {
  category: (category: string) => string;
  permission: (permission: GrantablePermissionResponse) => string;
}

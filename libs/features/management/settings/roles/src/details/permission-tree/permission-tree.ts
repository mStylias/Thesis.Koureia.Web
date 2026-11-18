import { TreeModel, TreeNode } from '@ui/tree';

import type { GrantablePermissionResponse } from '../../roles.types';
import type { PermissionNodeData, PermissionTreeLabels } from './permission-tree.types';

/**
 * Marks a category row's key.
 *
 * A permission row's key **is** its code, because that is what the tree's `value` has to yield
 * for a write. A category row needs a key of its own that no code can collide with, and no code
 * contains `@` — every one is `resource:action`.
 */
const CATEGORY_PREFIX = '@';

/** The key of the row grouping `category`. */
export function categoryKey(category: string): string {
  return `${CATEGORY_PREFIX}${category}`;
}

/** Whether a key names a category row rather than a permission code. */
export function isCategoryKey(key: string): boolean {
  return key.startsWith(CATEGORY_PREFIX);
}

/**
 * Builds the two-level tree from the catalog.
 *
 * The catalog arrives ordered by category then code, so grouping it in arrival order is the
 * whole layout — no sort of our own, which would disagree with the server's collation.
 *
 * `canGrant: false` becomes a disabled row rather than an absent one: the catalog omits nothing
 * so the editor can show why a code is out of reach. A category every one of whose codes is
 * refused is disabled too — it has nothing left to toggle.
 *
 * @param permissions The catalog, as `grantable-permissions` returned it.
 * @param labels Resolves a row's visible text. The string off the wire is the fallback.
 */
export function buildPermissionTree(
  permissions: readonly GrantablePermissionResponse[],
  labels: PermissionTreeLabels,
): TreeModel<PermissionNodeData> {
  const byCategory = new Map<string, GrantablePermissionResponse[]>();
  for (const permission of permissions) {
    const bucket = byCategory.get(permission.category);
    if (bucket === undefined) {
      byCategory.set(permission.category, [permission]);
    } else {
      bucket.push(permission);
    }
  }

  const categories = [...byCategory].map(([category, entries]) => {
    const children = entries.map(
      (permission) =>
        new TreeNode<PermissionNodeData>({
          key: permission.code,
          data: { kind: 'permission', permission },
          label: labels.permission(permission),
          disabled: !permission.canGrant,
        }),
    );

    return new TreeNode<PermissionNodeData>({
      key: categoryKey(category),
      data: { kind: 'category', category },
      label: labels.category(category),
      // Open, because a collapsed tree hides the whole point of the screen. Nine categories
      // of five rows is a list a reader scrolls, not one they have to open row by row.
      expanded: true,
      disabled: entries.every((permission) => !permission.canGrant),
      children,
    });
  });

  return new TreeModel<PermissionNodeData>(categories);
}

/**
 * The catalog narrowed to the codes a role holds, in catalog order.
 *
 * View mode asks what this role can do, and the shortest true answer is the codes it holds — not
 * the whole catalog with a few rows ticked, which makes the answer a hunt. A category with
 * nothing granted has no row at all, because `buildPermissionTree` groups what it is given.
 *
 * A code the role holds that the catalog does not name is dropped. It cannot be rendered: the
 * name and the category come from the catalog and nowhere else.
 */
export function grantedPermissions(
  permissions: readonly GrantablePermissionResponse[],
  codes: readonly string[],
): readonly GrantablePermissionResponse[] {
  const held = new Set(codes);
  return permissions.filter((permission) => held.has(permission.code));
}

/**
 * The codes a selection names, in catalog order.
 *
 * Checkbox mode selects a category once all its eligible children are, so `value` carries
 * category keys the server has never heard of. They are dropped here rather than never
 * selected: the cascade is what makes a category row worth having.
 */
export function selectedCodes(
  permissions: readonly GrantablePermissionResponse[],
  selection: readonly string[],
): readonly string[] {
  const selected = new Set(selection.filter((key) => !isCategoryKey(key)));
  return permissions.filter((permission) => selected.has(permission.code)).map(({ code }) => code);
}

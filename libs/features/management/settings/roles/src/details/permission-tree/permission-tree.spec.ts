/**
 * The catalog-to-tree translation, which is the whole layout of the permission editor and the
 * only place a key that is not a permission code can be invented.
 */
import type { GrantablePermissionResponse } from '../../roles.types';
import { buildPermissionTree, categoryKey, isCategoryKey, selectedCodes } from './permission-tree';
import type { PermissionTreeLabels } from './permission-tree.types';

/** The identity resolvers: a category is its value and a permission is its catalog name. */
const RAW: PermissionTreeLabels = {
  category: (category) => category,
  permission: (permission) => permission.name,
};

function permission(
  code: string,
  category: string,
  canGrant = true,
  isTenantGrantable = true,
): GrantablePermissionResponse {
  return { code, name: code, description: null, category, isTenantGrantable, canGrant };
}

// The endpoint orders by category then code, and this is that order.
const CATALOG: readonly GrantablePermissionResponse[] = [
  permission('appointments:cancel', 'appointments'),
  permission('appointments:create', 'appointments'),
  permission('roles:delete', 'roles', false),
  permission('roles:update', 'roles', false),
];

describe('the permission tree', () => {
  it('groups by category in the order the catalog arrived', () => {
    const tree = buildPermissionTree(CATALOG, {
      ...RAW,
      category: (category) => category.toUpperCase(),
    });
    const categories = tree.children();

    expect(categories.map((node) => node.key)).toEqual([
      categoryKey('appointments'),
      categoryKey('roles'),
    ]);
    expect(categories[0].children().map((node) => node.key)).toEqual([
      'appointments:cancel',
      'appointments:create',
    ]);
  });

  it('labels both kinds of row through the resolver', () => {
    const tree = buildPermissionTree(CATALOG, {
      category: () => 'Ραντεβού',
      permission: () => 'Ακύρωση ραντεβού',
    });
    const [appointments] = tree.children();

    expect(appointments.label()).toBe('Ραντεβού');
    expect(appointments.children()[0].label()).toBe('Ακύρωση ραντεβού');
  });

  it('falls back to the catalog name, which is the English string off the wire', () => {
    const tree = buildPermissionTree(CATALOG, RAW);

    expect(tree.children()[0].children()[0].label()).toBe('appointments:cancel');
  });

  it('keeps a code the caller cannot grant, disabled rather than absent', () => {
    const tree = buildPermissionTree(CATALOG, RAW);
    const roles = tree.children()[1];

    expect(roles.children()).toHaveLength(2);
    expect(roles.children().every((node) => node.disabled())).toBe(true);
    // Nothing under it is grantable, so the row grouping them has nothing to toggle.
    expect(roles.disabled()).toBe(true);
  });

  it('leaves a category enabled while one code under it can be granted', () => {
    const mixed = [permission('roles:read', 'roles'), permission('roles:delete', 'roles', false)];
    const tree = buildPermissionTree(mixed, RAW);

    expect(tree.children()[0].disabled()).toBe(false);
  });

  it('gives a category a key no permission code can collide with', () => {
    expect(isCategoryKey(categoryKey('appointments'))).toBe(true);
    expect(isCategoryKey('appointments:create')).toBe(false);
  });

  it('drops the category keys checkbox cascading adds, and keeps catalog order', () => {
    const codes = selectedCodes(CATALOG, [
      'appointments:create',
      categoryKey('appointments'),
      'appointments:cancel',
    ]);

    expect(codes).toEqual(['appointments:cancel', 'appointments:create']);
  });

  it('drops a key the catalog does not name, so no write can carry one', () => {
    expect(selectedCodes(CATALOG, ['nothing:here'])).toEqual([]);
  });
});

import type { TranslocoService } from '@jsverse/transloco';

import type { GrantablePermissionResponse, RoleODataResponse } from './roles.types';

/** The scope every key below lives under. */
const SCOPE = 'managementRoles';

/**
 * Whatever the client says a role, a category or a permission is called.
 *
 * The seeded roles and the permission catalog are English in the database and stay English:
 * there is no per-language column and no endpoint that edits one, so the visible text is keyed
 * on the identifier here and the server's own `name` is only the fallback.
 *
 * Every resolver below **falls back to the string off the wire**. A permission code a migration
 * adds shows in English rather than as a raw key or not at all.
 *
 * A caller that must relabel on a language change has to read `getActiveLang()` itself: these
 * are plain functions and track nothing.
 */

/** The dictionary's answer, or `null` when it does not name the key. */
function resolve(transloco: TranslocoService, key: string): string | null {
  const full = `${SCOPE}.${key}`;
  const translated = transloco.translate(full);
  return translated === full || translated === '' ? null : translated;
}

/**
 * A role's visible name.
 *
 * Only an `isSystem` row is looked up. A company's own role name is tenant free text, already in
 * whatever language the company typed, and running it through the dictionary could only
 * mistranslate it.
 */
export function roleLabel(
  transloco: TranslocoService,
  role: Pick<RoleODataResponse, 'name' | 'isSystem'>,
): string {
  return role.isSystem ? (resolve(transloco, `roleNames.${role.name}`) ?? role.name) : role.name;
}

/**
 * A permission category's visible text.
 *
 * The `category` **value** is never translated — the catalog comes back ordered by it and the
 * tree groups on it. This is the group header alone.
 */
export function categoryLabel(transloco: TranslocoService, category: string): string {
  return resolve(transloco, `details.categories.${category}`) ?? category;
}

/** A permission's short label, for a checkbox row or a chip. */
export function permissionLabel(
  transloco: TranslocoService,
  permission: Pick<GrantablePermissionResponse, 'code' | 'name'>,
): string {
  return resolve(transloco, `details.codes.${permission.code}.name`) ?? permission.name;
}

/** A permission's helper line, or `null` when neither the dictionary nor the server has one. */
export function permissionDescription(
  transloco: TranslocoService,
  permission: Pick<GrantablePermissionResponse, 'code' | 'description'>,
): string | null {
  return (
    resolve(transloco, `details.codes.${permission.code}.description`) ?? permission.description
  );
}

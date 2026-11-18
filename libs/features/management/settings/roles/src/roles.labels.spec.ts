/**
 * The three lookups that turn an identifier the database holds in English into the text a
 * reader sees. The fallback is the point of every one of them: a code a migration adds must
 * render as the server's own name rather than as a raw key or not at all.
 */
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';

import { categoryLabel, permissionDescription, permissionLabel, roleLabel } from './roles.labels';
import type { GrantablePermissionResponse } from './roles.types';

const DICTIONARY = {
  roleNames: { company_admin: 'Ιδιοκτήτης' },
  details: {
    categories: { appointments: 'Ραντεβού' },
    codes: {
      'appointments:cancel': { name: 'Ακύρωση ραντεβού', description: 'Ακύρωση ραντεβού' },
    },
  },
};

function permission(
  code: string,
  name: string,
  description: string | null,
): GrantablePermissionResponse {
  return {
    code,
    name,
    description,
    category: 'appointments',
    isTenantGrantable: true,
    canGrant: true,
  };
}

describe('the authorization labels', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTransloco({ config: { availableLangs: ['el'], defaultLang: 'el' } })],
    });
    transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ managementRoles: DICTIONARY }, 'el');
  });

  it('translates a seeded role name', () => {
    expect(roleLabel(transloco, { name: 'company_admin', isSystem: true })).toBe('Ιδιοκτήτης');
  });

  it("leaves a company role name alone, because it is the company's own text", () => {
    // Keyed on `name`, so a company that happens to name a role `company_admin` would be
    // relabelled if `isSystem` were not consulted.
    expect(roleLabel(transloco, { name: 'company_admin', isSystem: false })).toBe('company_admin');
    expect(roleLabel(transloco, { name: 'Ταμείο', isSystem: false })).toBe('Ταμείο');
  });

  it('falls back to the server string for a seeded name the dictionary does not hold', () => {
    expect(roleLabel(transloco, { name: 'super_admin', isSystem: true })).toBe('super_admin');
  });

  it('translates a category header and falls back to the category value', () => {
    expect(categoryLabel(transloco, 'appointments')).toBe('Ραντεβού');
    expect(categoryLabel(transloco, 'billing')).toBe('billing');
  });

  it('translates a permission and falls back to the English name off the wire', () => {
    const known = permission('appointments:cancel', 'Cancel appointments', 'Cancel appointments');
    const added = permission('billing:read', 'View invoices', 'View invoices');

    expect(permissionLabel(transloco, known)).toBe('Ακύρωση ραντεβού');
    expect(permissionLabel(transloco, added)).toBe('View invoices');
  });

  it('falls back to the wire description, and to nothing when there is none either', () => {
    expect(permissionDescription(transloco, permission('billing:read', 'x', 'View invoices'))).toBe(
      'View invoices',
    );
    expect(permissionDescription(transloco, permission('billing:read', 'x', null))).toBeNull();
  });
});

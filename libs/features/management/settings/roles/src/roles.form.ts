import { field, fields } from '@util/forms';
import type { FieldByCode } from '@synax/forms';
import type { RoleFormValue } from './roles.types';

/** The longest name the write endpoints accept, trimmed. */
export const NAME_MAX_LENGTH = 64;

/**
 * The role editor's fields: their copy, their limits and how they read when the panel is not
 * editable. Nothing else declares them — the form, the labels, the messages and the view items
 * are all built from here.
 */
export const ROLE_FIELDS = fields<RoleFormValue>({
  name: field({
    label: 'managementRoles.name',
    required: 'managementRoles.details.nameRequired',
    maxLength: [NAME_MAX_LENGTH, 'managementRoles.details.nameTooLong'],
  }),
  description: field({ label: 'managementRoles.description' }),
});

/**
 * A name the company already uses is the one refusal with a field to blame, and the server
 * reports it as a code rather than as a property error. Everything else — an escalated code, a
 * permission no company-owned role may hold — belongs to the whole submission.
 */
export const ROLE_ERROR_FIELDS: FieldByCode = { ROLE_NAME_TAKEN: 'name' };

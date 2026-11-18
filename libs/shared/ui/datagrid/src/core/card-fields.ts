/**
 * Resolves the columns into the places a card draws them (§5.4).
 *
 * Pure, and the whole of the "define the columns once" rule: a card is built
 * from the same `ColumnDef` array the table renders, so nothing about a field
 * is stated twice. A column refines its place with `ColumnDef.card`; without
 * one, the primary column becomes the title and every other column becomes a
 * labelled field row in visible-column order.
 */
import { isBuiltInColumn } from './builtin-columns';
import type {
  CardFieldEntry,
  CardFieldPlan,
  CardFieldPlanOptions,
  RoleAssignment,
} from './card-fields.types';
import type { CardFieldRole } from './types/card.types';
import type { ColumnDef } from './types/column.types';

/** Roles that draw their value without a caption. A title labelled "Name" reads twice. */
const UNLABELLED_ROLES: ReadonlySet<CardFieldRole> = new Set<CardFieldRole>([
  'title',
  'subtitle',
  'meta',
  'actions',
  'media',
]);

export function planCardFields<TRow>(
  columns: readonly ColumnDef<TRow>[],
  options: CardFieldPlanOptions,
): CardFieldPlan<TRow> {
  const assigned: RoleAssignment<TRow>[] = [];
  let titleTaken = false;
  for (const [index, column] of columns.entries()) {
    // The grid's own columns are card chrome, not fields: selection is a
    // checkbox in the header, detail is the expander, and a row number
    // describes a position the card does not have.
    if (isBuiltInColumn(column.id)) {
      continue;
    }
    const declared = column.card?.role;
    const role = declared ?? defaultRole(column, options, titleTaken);
    if (role === 'none') {
      continue;
    }
    if (role === 'title') {
      // A second title would draw two headings on one card, so the later one
      // falls back to a field rather than being dropped.
      if (titleTaken) {
        assigned.push({ role: 'field', entry: entryOf(column, 'field', options), order: index });
        continue;
      }
      titleTaken = true;
    }
    assigned.push({
      role,
      entry: entryOf(column, role, options),
      order: column.card?.order ?? index,
    });
  }

  assigned.sort((a, b) => a.order - b.order);
  const of = (role: CardFieldRole): CardFieldEntry<TRow>[] =>
    assigned.filter((item) => item.role === role).map((item) => item.entry);

  return {
    title: of('title')[0] ?? null,
    subtitle: of('subtitle')[0] ?? null,
    media: of('media')[0] ?? null,
    meta: of('meta'),
    fields: of('field'),
    actions: of('actions'),
    all: assigned.map((item) => item.entry),
  };
}

/**
 * The role a column takes when it declares none. The identifier heads the
 * card, as it heads the record; everything else is a field.
 */
function defaultRole<TRow>(
  column: ColumnDef<TRow>,
  options: CardFieldPlanOptions,
  titleTaken: boolean,
): CardFieldRole {
  return !titleTaken && options.isPrimary(column.id) ? 'title' : 'field';
}

function entryOf<TRow>(
  column: ColumnDef<TRow>,
  role: CardFieldRole,
  options: CardFieldPlanOptions,
): CardFieldEntry<TRow> {
  return {
    column,
    id: column.id,
    label: column.caption ?? column.field ?? column.id,
    hideLabel: column.card?.hideLabel ?? (!options.showLabels || UNLABELLED_ROLES.has(role)),
    wide: column.card?.wide ?? false,
  };
}

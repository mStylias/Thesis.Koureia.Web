/**
 * The presets' renderers, described for an export that draws (§15).
 *
 * Each function reads the same options and the same display value as the
 * renderer it mirrors, so the PDF draws what the cell drew.
 */
import { formatCellText } from '../core/format';
import type { ColumnDef } from '../core/types/column.types';
import type { ExportCellVisual } from '../core/types/export.types';
import type { LinkSpec, TagSpec, TagTone } from './preset.types';

/** The tone of one tag value. */
export function resolveTone<TRow>(
  resolver: TagSpec<TRow>['tone'],
  value: unknown,
  row: TRow,
): TagTone {
  if (resolver == null) {
    return 'neutral';
  }
  if (typeof resolver === 'function') {
    return resolver(value, row);
  }
  if (typeof resolver === 'string') {
    return resolver;
  }
  // A map is keyed by the stored value's text form, so a numeric code and the
  // string it prints as reach the same entry.
  return resolver[String(value)] ?? 'neutral';
}

/** The values a tag cell draws: an array draws one tag per entry. */
export function tagValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value as readonly unknown[];
  }
  return value == null || value === '' ? [] : [value];
}

/**
 * Every tag, `maxVisible` ignored. A page has no `+n` tooltip to name the
 * hidden ones, so the tags wrap instead.
 */
export function tagsVisual<TRow>(
  column: ColumnDef<TRow>,
  spec: TagSpec<TRow>,
): (row: TRow, value: unknown) => ExportCellVisual | null {
  return (row, value) => {
    const tags = tagValues(value).map((entry) => ({
      label: spec.label ? spec.label(entry, row) : formatCellText(entry, column),
      tone: resolveTone(spec.tone, entry, row),
    }));
    return tags.length === 0 ? null : { kind: 'tags', tags };
  };
}

/** A check for `true` and a dash for anything else, as the boolean cell draws. */
export function checkVisual(_row: unknown, value: unknown): ExportCellVisual {
  return { kind: 'check', checked: value === true };
}

/** A link for a row with a target. A row without one exports plain text. */
export function linkVisual<TRow>(
  column: ColumnDef<TRow>,
  spec: LinkSpec<TRow>,
): (row: TRow, value: unknown) => ExportCellVisual | null {
  return (row, value) => {
    const href = spec.href(row);
    if (href === '') {
      return null;
    }
    const label = spec.label ? spec.label(value, row) : formatCellText(value, column);
    return { kind: 'link', href, label };
  };
}

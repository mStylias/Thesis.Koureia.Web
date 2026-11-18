/**
 * Cell preset options (§6.2).
 *
 * A preset is a factory returning a {@link ColumnDef} with its renderer already
 * attached as a component type, not an option bag the grid interprets. A
 * factory composes by spread, so a host varies one property without re-stating
 * the rest, and the renderer travels as a value — which is what makes a preset
 * usable through a wrapper.
 */
import type { LucideIconInput } from '@lucide/angular';
import type { ExportTone } from '../core/types/export.types';
import type { GridKey } from '../core/types/key.types';

/**
 * Colour family of a tag. A name from the semantic palette rather than a
 * colour: the tag re-themes with everything else, and a host cannot leak a hex
 * into a themed surface.
 */
export type TagTone = ExportTone;

/** How a tag cell resolves its tone: one for all, a map, or a function. */
export type TagToneResolver<TRow> =
  | TagTone
  | Readonly<Record<string, TagTone>>
  | ((value: unknown, row: TRow) => TagTone);

/** Tag / badge cell options. */
export interface TagSpec<TRow = unknown> {
  /** Defaults to `'neutral'`, and to `'neutral'` for a value the map omits. */
  tone?: TagToneResolver<TRow>;
  /** Text of the tag. Defaults to the column's own formatted display value. */
  label?: (value: unknown, row: TRow) => string;
  /** Tooltip per tag. Empty or absent draws none. */
  tooltip?: (value: unknown, row: TRow) => string;
  /**
   * A hard cap on the tags a cell draws, the rest collapsing into a `+n` marker.
   * Only reached when the cell value is an array. `0`, the default, caps nothing:
   * in a table the tags that do not fit the column collapse on their own.
   */
  maxVisible?: number;
}

/** One row action drawn by the action-buttons preset. */
export interface RowAction<TRow = unknown> {
  id: string;
  /**
   * Accessible name, and the visible caption unless the action is icon-only.
   * Required: an unlabelled control is a defect (§16.3).
   */
  label: string;
  icon?: LucideIconInput;
  /** Repeats the label when the button draws the icon alone. */
  tooltip?: string;
  /** Marks a destructive action, which draws in the error colour. */
  destructive?: boolean;
  /** Whether this row offers the action at all. Absent means it does. */
  visible?: (row: TRow) => boolean;
  /** Whether the action is available on this row. Absent means it is. */
  disabled?: (row: TRow) => boolean;
  run: (row: TRow, key: GridKey) => void;
}

/** Action-buttons cell options. */
export interface ActionsSpec<TRow = unknown> {
  actions: readonly RowAction<TRow>[];
  /**
   * How many actions draw as buttons before the rest collapse into a menu.
   *
   * Declared rather than measured: §22 forbids a per-row observer, and a
   * column has one width for every row, so a measured answer would be the same
   * number computed thousands of times. Default 2.
   */
  maxInline?: number;
  /** Draws the buttons as icons alone, keeping the label as their name. */
  iconOnly?: boolean;
}

/** Link cell options. */
export interface LinkSpec<TRow = unknown> {
  /** The target. Returning an empty string renders plain text instead. */
  href: (row: TRow) => string;
  /** Link text. Defaults to the column's own formatted display value. */
  label?: (value: unknown, row: TRow) => string;
  /** Window target, e.g. `_blank`. A `_blank` link gets `rel="noopener"`. */
  target?: string;
  /** Repeats the text when the column is too narrow to show it. */
  tooltip?: (value: unknown, row: TRow) => string;
}

/** How a boolean cell draws. */
export type BooleanDisplay = 'labels' | 'check';

/** Boolean cell options. */
export interface BooleanSpec {
  /**
   * `'labels'` prints the translated yes/no text. `'check'` draws a glyph and
   * keeps the same text as the cell's accessible name — the state is never
   * carried by the glyph alone.
   */
  display?: BooleanDisplay;
}

/**
 * A selectable entry. `value` can be any type; it is compared with
 * reference equality (`===`), so use primitives or stable references.
 *
 * `TItem` is the item a `DataSource` returned. It is set only on the `source`
 * path, where `value` is the item's declared key rather than the item itself.
 */
export interface SelectOption<T, TItem = unknown> {
  /** Text shown for the option; also drives the typeahead search. */
  readonly label: string;
  /** The value written to `value` when the option is selected. */
  readonly value: T;
  /** Prevents the option from being selected. */
  readonly disabled?: boolean;
  /** The source item this option was built from. */
  readonly item?: TItem;
}

/** Control size, aligned with the Button sizes. */
export type SelectSize = 'sm' | 'md' | 'lg';

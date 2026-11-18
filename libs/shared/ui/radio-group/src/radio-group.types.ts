/** Control size, aligned with the shared form-control scale. */
export type RadioGroupSize = 'sm' | 'md' | 'lg';

/** Layout direction of the options. Arrow keys work in either. */
export type RadioGroupOrientation = 'vertical' | 'horizontal';

/**
 * `classic` renders a dot + label row; `card` turns the whole bordered
 * tile into the selectable option (accent border when selected).
 */
export type RadioGroupVariant = 'classic' | 'card';

/**
 * A selectable entry. `value` is compared with reference equality
 * (`===`), so use primitives or stable references.
 */
export interface RadioOption<T> {
  /** Primary text shown for the option. */
  readonly label: string;
  /** The value written to `value` when the option is selected. */
  readonly value: T;
  /** Secondary text under the label (e.g. a price). Shines in `card`. */
  readonly description?: string;
  /** Prevents the option from being selected. */
  readonly disabled?: boolean;
}

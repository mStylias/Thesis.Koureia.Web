/** How the committed value renders once the input loses focus. */
export type InputNumberMode = 'decimal' | 'currency';

/**
 * Arrangement of the step buttons: `stacked` puts a half-height up/down
 * pair at the right edge; `horizontal` puts − and + on either side.
 */
export type InputNumberButtonLayout = 'stacked' | 'horizontal';

/** Control size, aligned with the Button and InputText sizes. */
export type InputNumberSize = 'sm' | 'md' | 'lg';

/** When typed text becomes the value. */
export type InputNumberCommit = 'blur' | 'input';

/** Formats the committed value while the field is not being edited. */
export type InputNumberValueFormatter = (value: number) => string;

/** Number formatting options a preset accepts. */
export interface NumberColumnOptions {
  /** Fraction digits, fixed. Absent leaves it to the locale. */
  precision?: number;
}

/** Currency formatting options. */
export interface CurrencyColumnOptions extends NumberColumnOptions {
  /** ISO 4217 code. Defaults to `'EUR'`. */
  currency?: string;
}

/** Date and time formatting options. */
export interface DateColumnOptions {
  /** Formatting pattern, where the source honours one. */
  pattern?: string;
}

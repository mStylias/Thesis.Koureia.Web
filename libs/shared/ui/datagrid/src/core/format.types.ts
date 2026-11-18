/** Locale-dependent inputs of {@link formatCellText}. */
export interface FormatOptions {
  /** BCP 47 tag. Defaults to the host environment's locale. */
  locale?: string;
  /** IANA timezone for date and time formatting. */
  timezone?: string;
  /** Translated labels for boolean columns. */
  booleanLabels?: { true: string; false: string };
}

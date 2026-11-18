/** The controlled value of a single- or multi-expandable accordion. */
export type AccordionValue = string | readonly string[] | null;

/** Type-safe replacement for `Array.isArray`, which narrows to `any[]`. */
export function isAccordionValueList(value: AccordionValue): value is readonly string[] {
  return Array.isArray(value);
}

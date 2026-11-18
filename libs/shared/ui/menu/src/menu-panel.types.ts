import type { MenuItem } from './menu.types';

/** A heading and the entries under it, up to the next heading. The first entries can have none. */
export interface MenuSection {
  readonly heading: MenuItem | null;
  /** The heading's element id, which labels the section's `group`. Empty without a heading. */
  readonly headingId: string;
  readonly entries: MenuItem[];
}

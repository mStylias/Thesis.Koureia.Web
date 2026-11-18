import type { DataInput } from './types/query.types';

/** One resolved lookup entry. */
export interface LookupEntry {
  value: unknown;
  display: unknown;
}

/** A page of lookup entries, for a source that pages its own collection. */
export interface LookupPage {
  entries: readonly LookupEntry[];
  hasMore: boolean;
}

/** What one column's lookup has resolved so far. */
export interface LookupState {
  entries: readonly LookupEntry[];
  /**
   * Every entry the store can display, by value: the loaded collection plus
   * anything {@link LookupStore.resolveValues} looked up by key.
   */
  byValue: ReadonlyMap<string, LookupEntry>;
  loading: boolean;
  /** True while the source has more entries than the store has loaded. */
  partial: boolean;
}

/**
 * One column's lookup after its item type has been erased.
 *
 * `ensure` is the one place the item type is known, so it closes over the two
 * accessors there. Keeping the declaration itself would force every later
 * reader to be generic in a type it cannot name, and the accessors are
 * contravariant, so no cast makes that sound.
 */
export interface LookupBinding {
  /** The declaration, held for identity alone. */
  readonly declaration: object;
  readonly source: DataInput<unknown>;
  readonly toEntry: (item: unknown) => LookupEntry;
}

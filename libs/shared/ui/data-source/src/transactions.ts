/**
 * Keyed local mutation.
 *
 * A transaction produces a new items array and names the keys it touched, so a
 * renderer can invalidate those and leave every other one alone. Items no
 * change names keep their identity, which is what makes the re-render
 * proportional to the change rather than to the dataset.
 *
 * This is what an optimistic edit and a "just add the row I created" both
 * need, and neither has to wait for a round trip.
 */
import type { DataKey, RowTransaction } from './data-source.types';

/** What a transaction did, by key. */
export interface TransactionResult<T> {
  rows: readonly T[];
  inserted: readonly DataKey[];
  updated: readonly DataKey[];
  removed: readonly DataKey[];
  /** Keys the transaction named that match no loaded item. */
  missing: readonly DataKey[];
}

/**
 * Applies inserts, updates and removes to an items array.
 *
 * The host's items are never mutated — an update produces a copy — because an
 * item object may be shared with the source that produced it. Removes run
 * before inserts, so one transaction can replace an item. An insert carrying a
 * key that is already loaded **updates that item in place**: two items under
 * one key would make every keyed feature — selection, focus, expansion —
 * ambiguous.
 */
export function applyRowTransaction<T>(
  rows: readonly T[],
  transaction: RowTransaction<T>,
  keyOf: (item: T) => DataKey,
): TransactionResult<T> {
  const removed: DataKey[] = [];
  const updated: DataKey[] = [];
  const inserted: DataKey[] = [];
  const missing: DataKey[] = [];

  const removals = new Set(transaction.remove ?? []);
  let next = rows;
  if (removals.size > 0) {
    const kept = rows.filter((row) => {
      const key = keyOf(row);
      if (!removals.has(key)) {
        return true;
      }
      removed.push(key);
      removals.delete(key);
      return false;
    });
    missing.push(...removals);
    // A filter that dropped nothing still returns a fresh array, and a new
    // identity is what makes the renderer treat every item as changed.
    if (removed.length > 0) {
      next = kept;
    }
  }

  const changes = transaction.update ?? [];
  if (changes.length > 0) {
    const byKey = new Map(changes.map((change) => [change.key, change.changes]));
    const applied = new Set<DataKey>();
    const merged = next.map((row) => {
      const key = keyOf(row);
      const change = byKey.get(key);
      if (change === undefined) {
        return row;
      }
      applied.add(key);
      updated.push(key);
      return { ...row, ...change };
    });
    for (const change of changes) {
      if (!applied.has(change.key)) {
        missing.push(change.key);
      }
    }
    if (updated.length > 0) {
      next = merged;
    }
  }

  const additions = transaction.insert ?? [];
  if (additions.length > 0) {
    const positions = new Map(next.map((row, index) => [keyOf(row), index]));
    const appended: T[] = [];
    const replaced = new Map<number, T>();
    for (const row of additions) {
      const key = keyOf(row);
      const position = positions.get(key);
      if (position === undefined) {
        positions.set(key, next.length + appended.length);
        appended.push(row);
        inserted.push(key);
      } else {
        replaced.set(position, row);
        updated.push(key);
      }
    }
    const base = replaced.size === 0 ? next : next.map((row, index) => replaced.get(index) ?? row);
    next = appended.length === 0 ? base : [...base, ...appended];
  }

  return { rows: next, inserted, updated, removed, missing };
}

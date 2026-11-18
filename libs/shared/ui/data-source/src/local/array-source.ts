/**
 * An in-memory collection as a {@link DataSource}.
 *
 * A control bound to an array and a control bound to a remote source run one
 * code path, not two. This is what makes that true, and it is why swapping a
 * source for an array changes one binding and nothing else.
 */
import { abortedRejection } from '../abort';
import type { DataKey, DataSource, KeySpec, LoadRequest, LoadResult } from '../data-source.types';
import { createKeyGetter, serializeKey } from '../keys';
import { getPath } from '../paths';
import { applyLoadRequest, type LocalEngineOptions } from './apply-request';

/** What {@link createArraySource} is told about the collection. */
export interface ArraySourceOptions<T> extends LocalEngineOptions<T> {
  /**
   * Item identity. Declaring it is what gives the source `byKeys`; without it
   * the capability is absent rather than guessed.
   */
  key?: KeySpec<T>;
  /**
   * The field holding each item's parent key, for a flat hierarchy.
   *
   * Declaring it is what gives the source `loadChildren`. Leave it out and the
   * capability is absent, which is deliberate: `@ui/tree` reads a source
   * without `loadChildren` once and nests it in memory, and that is the right
   * shape for an array. Declare it only to drive the lazy path — from a test,
   * or from a host that wants a level at a time over a large local set.
   */
  parentKey?: string;
}

/**
 * Wraps a collection so every control has one load path.
 *
 * `rows` is read through a function so a signal-backed collection stays live:
 * a source built once at construction must still see the array the host
 * replaced.
 */
export function createArraySource<T>(
  rows: readonly T[] | (() => readonly T[]),
  options: ArraySourceOptions<T> = {},
): DataSource<T> {
  const read = typeof rows === 'function' ? rows : (): readonly T[] => rows;
  const keyOf = options.key === undefined ? undefined : createKeyGetter(options.key);
  const { parentKey } = options;

  const source: DataSource<T> = {
    // An aborted signal rejects rather than throwing out of the call: a method
    // typed to return a promise must not throw past it, or `Promise.all` over
    // several loads breaks on the first aborted one.
    load: (request: LoadRequest): Promise<LoadResult<T>> =>
      abortedRejection(request.signal) ??
      Promise.resolve(applyLoadRequest(read(), request, options)),
  };

  if (keyOf !== undefined) {
    source.byKeys = (keys: readonly DataKey[], signal?: AbortSignal): Promise<readonly T[]> => {
      const aborted = abortedRejection(signal);
      if (aborted !== null) {
        return aborted;
      }
      // Serialized, because a composite key getter produces a string while the
      // caller may hold the number it started from.
      const wanted = new Set(keys.map(serializeKey));
      return Promise.resolve(read().filter((item) => wanted.has(serializeKey(keyOf(item)))));
    };
  }

  if (keyOf !== undefined && parentKey !== undefined) {
    source.loadChildren = (
      parent: DataKey | null,
      request: LoadRequest = {},
    ): Promise<LoadResult<T>> => {
      const aborted = abortedRejection(request.signal);
      if (aborted !== null) {
        return aborted;
      }
      const wanted = parent === null ? null : serializeKey(parent);
      const level = read().filter((item) => {
        const value = getPath(item, parentKey);
        // A root item is one whose parent is absent, not one whose parent is
        // the empty string: `null` and `undefined` are the only roots.
        if (value == null) {
          return wanted === null;
        }
        return wanted !== null && serializeKey(value as DataKey) === wanted;
      });
      return Promise.resolve(applyLoadRequest(level, request, options));
    };
  }

  return source;
}

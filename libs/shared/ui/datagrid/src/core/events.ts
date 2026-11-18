/**
 * Typed event bus with deduplication support.
 *
 * `emit` returns the payload so callers of cancellable events can read the
 * veto flag. `emitDistinct` drops a payload structurally identical to the
 * last one emitted under the same name, which backs the guarantee that
 * identical consecutive states produce no duplicate change events.
 */
import { structurallyEqual } from './equality';
import type { GridEventMap, GridEventName } from './types/event.types';
import type { AnyHandler } from './events.types';

/** Synchronous, typed publish/subscribe over {@link GridEventMap}. */
export class GridEventBus<TRow = unknown> {
  private readonly handlers = new Map<GridEventName, Set<AnyHandler>>();
  private readonly lastPayloads = new Map<GridEventName, unknown>();

  /** Subscribes. Returns the unsubscribe function. */
  on<K extends GridEventName>(
    name: K,
    handler: (payload: GridEventMap<TRow>[K]) => void,
  ): () => void {
    const set = this.handlers.get(name) ?? new Set<AnyHandler>();
    const anyHandler = handler as AnyHandler;
    set.add(anyHandler);
    this.handlers.set(name, set);
    return () => {
      set.delete(anyHandler);
    };
  }

  /** Emits to every subscriber and returns the (possibly mutated) payload. */
  emit<K extends GridEventName>(name: K, payload: GridEventMap<TRow>[K]): GridEventMap<TRow>[K] {
    const set = this.handlers.get(name);
    if (set) {
      for (const handler of [...set]) {
        handler(payload);
      }
    }
    return payload;
  }

  /**
   * Emits unless the payload is structurally identical to the last payload
   * emitted under this name. Returns whether it emitted.
   */
  emitDistinct<K extends GridEventName>(name: K, payload: GridEventMap<TRow>[K]): boolean {
    if (this.lastPayloads.has(name) && structurallyEqual(this.lastPayloads.get(name), payload)) {
      return false;
    }
    this.lastPayloads.set(name, payload);
    this.emit(name, payload);
    return true;
  }

  /**
   * Records a payload as the dedup baseline without emitting it. The initial
   * value of a facet is the state, not a change to it — seeding stops the
   * first read of an unchanged facet from reaching subscribers.
   */
  seed<K extends GridEventName>(name: K, payload: GridEventMap<TRow>[K]): void {
    this.lastPayloads.set(name, payload);
  }

  /** Drops every subscription and dedup baseline. */
  clear(): void {
    this.handlers.clear();
    this.lastPayloads.clear();
  }
}

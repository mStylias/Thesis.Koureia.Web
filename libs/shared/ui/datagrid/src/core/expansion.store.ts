/**
 * Row detail expansion.
 *
 * Keyed, like everything else that references rows, so an expanded row keeps
 * its detail open across a reload that returns it in a different position.
 */
import { computed, signal, type Signal } from '@angular/core';
import type { GridKey } from './types/key.types';
import type { ExpansionMode } from './expansion.store.types';

/** Holds the keys of the rows whose detail is open. */
export class ExpansionStore {
  private readonly keysSig = signal<ReadonlySet<GridKey>>(new Set());
  private readonly modeSig = signal<ExpansionMode>('multiple');

  readonly keys: Signal<ReadonlySet<GridKey>> = computed(() => this.keysSig());

  /** Expanded keys in insertion order. */
  readonly expandedKeys: Signal<readonly GridKey[]> = computed(() => [...this.keysSig()]);

  readonly mode: Signal<ExpansionMode> = computed(() => this.modeSig());

  setMode(mode: ExpansionMode): void {
    if (this.modeSig() === mode) {
      return;
    }
    this.modeSig.set(mode);
    const keys = this.keysSig();
    if (mode === 'single' && keys.size > 1) {
      // Keep the most recent, which is the one the user opened last.
      this.keysSig.set(new Set([[...keys][keys.size - 1]]));
    }
  }

  isExpanded(key: GridKey): boolean {
    return this.keysSig().has(key);
  }

  expand(key: GridKey): void {
    if (this.keysSig().has(key)) {
      return;
    }
    this.keysSig.set(
      this.modeSig() === 'single' ? new Set([key]) : new Set([...this.keysSig(), key]),
    );
  }

  collapse(key: GridKey): void {
    if (!this.keysSig().has(key)) {
      return;
    }
    const next = new Set(this.keysSig());
    next.delete(key);
    this.keysSig.set(next);
  }

  toggle(key: GridKey): void {
    if (this.keysSig().has(key)) {
      this.collapse(key);
    } else {
      this.expand(key);
    }
  }

  /** Replaces the whole set. `'single'` keeps the last key only. */
  set(keys: readonly GridKey[]): void {
    const next =
      this.modeSig() === 'single' && keys.length > 1
        ? new Set([keys[keys.length - 1]])
        : new Set(keys);
    if (sameKeys(next, this.keysSig())) {
      return;
    }
    this.keysSig.set(next);
  }

  clear(): void {
    if (this.keysSig().size > 0) {
      this.keysSig.set(new Set());
    }
  }

  /** Drops keys that vanished from the data. */
  retainKeys(live: ReadonlySet<GridKey>): void {
    const current = this.keysSig();
    const next = new Set([...current].filter((key) => live.has(key)));
    if (next.size !== current.size) {
      this.keysSig.set(next);
    }
  }
}

function sameKeys(a: ReadonlySet<GridKey>, b: ReadonlySet<GridKey>): boolean {
  return a.size === b.size && [...a].every((key) => b.has(key));
}

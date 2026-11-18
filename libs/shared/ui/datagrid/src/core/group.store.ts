/**
 * Group expansion state.
 *
 * Stored as a default plus the paths that depart from it, not as the set of
 * expanded groups. A grid grouped by a field with ten thousand values would
 * otherwise need ten thousand entries to say "expanded", and `expandAll()`
 * would have to enumerate groups the grid has not built yet.
 */
import { computed, signal, type Signal } from '@angular/core';
import { groupPathKey } from './grouping/group-nodes';

/** Holds which groups are open. */
export class GroupStore {
  private readonly defaultExpandedSig = signal(true);
  private readonly exceptionsSig = signal<ReadonlySet<string>>(new Set());

  /** Whether a group with no explicit state is open. */
  readonly defaultExpanded: Signal<boolean> = computed(() => this.defaultExpandedSig());

  /** Paths whose state differs from the default. */
  readonly exceptions: Signal<ReadonlySet<string>> = computed(() => this.exceptionsSig());

  setDefaultExpanded(expanded: boolean): void {
    if (this.defaultExpandedSig() === expanded) {
      return;
    }
    this.defaultExpandedSig.set(expanded);
    // The exceptions were written against the old default, so keeping them
    // would silently invert every group the user had touched.
    if (this.exceptionsSig().size > 0) {
      this.exceptionsSig.set(new Set());
    }
  }

  isExpanded(path: readonly unknown[]): boolean {
    const differs = this.exceptionsSig().has(groupPathKey(path));
    return differs ? !this.defaultExpandedSig() : this.defaultExpandedSig();
  }

  expand(path: readonly unknown[]): void {
    this.set(path, true);
  }

  collapse(path: readonly unknown[]): void {
    this.set(path, false);
  }

  toggle(path: readonly unknown[]): void {
    this.set(path, !this.isExpanded(path));
  }

  /** Opens every group, including ones the grid has not built yet. */
  expandAll(): void {
    this.defaultExpandedSig.set(true);
    if (this.exceptionsSig().size > 0) {
      this.exceptionsSig.set(new Set());
    }
  }

  collapseAll(): void {
    this.defaultExpandedSig.set(false);
    if (this.exceptionsSig().size > 0) {
      this.exceptionsSig.set(new Set());
    }
  }

  /** Returns every group to the default, without changing the default. */
  reset(): void {
    if (this.exceptionsSig().size === 0) {
      return;
    }
    this.exceptionsSig.set(new Set());
  }

  private set(path: readonly unknown[], expanded: boolean): void {
    if (this.isExpanded(path) === expanded) {
      return;
    }
    const key = groupPathKey(path);
    const next = new Set(this.exceptionsSig());
    if (expanded === this.defaultExpandedSig()) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.exceptionsSig.set(next);
  }
}

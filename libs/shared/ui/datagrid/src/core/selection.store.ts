/**
 * Keyed selection state.
 *
 * "Select all matching" is stored as a predicate — the filter at the moment
 * of selection plus explicit exclusions — never as a materialized key list,
 * so it stays correct over remote sources of any size.
 */
import { computed, signal, type Signal } from '@angular/core';
import { rangeBetween, selectAllState } from './selection-range';
import type { SelectAllState } from './selection-range.types';
import type { SelectionSnapshot } from './types/api.types';
import type { FilterNode } from './types/filter.types';
import type { GridKey } from './types/key.types';
import type { SelectionMode, AnchorState, InternalSelection } from './selection.store.types';

const EMPTY: InternalSelection = { kind: 'keys', keys: new Set<GridKey>() };

/** Holds the selection as data and enforces the interaction mode. */
export class SelectionStore {
  private readonly modeSig = signal<SelectionMode>('none');
  private readonly stateSig = signal<InternalSelection>(EMPTY);
  private readonly anchorSig = signal<GridKey | null>(null);
  private readonly rangeBaseSig = signal<ReadonlySet<GridKey> | null>(null);

  readonly mode: Signal<SelectionMode> = computed(() => this.modeSig());

  /** Where a shift-range starts: the last row selected without shift. */
  readonly anchor: Signal<GridKey | null> = computed(() => this.anchorSig());

  /** True while the selection is the "everything matching" predicate form. */
  readonly isAllMatching: Signal<boolean> = computed(() => this.stateSig().kind === 'allMatching');

  /**
   * Selected row count, or `null` in the predicate form — that form covers a
   * set the grid has deliberately not materialized.
   */
  readonly selectedCount: Signal<number | null> = computed(() => {
    const state = this.stateSig();
    return state.kind === 'keys' ? state.keys.size : null;
  });

  /** The selection as serializable data. */
  readonly selection: Signal<SelectionSnapshot> = computed(() => {
    const state = this.stateSig();
    if (state.kind === 'keys') {
      return { kind: 'keys', keys: [...state.keys] };
    }
    return {
      kind: 'allMatching',
      filter: state.filter,
      search: state.search,
      exclusions: [...state.exclusions],
    };
  });

  /** Selected keys. Empty in `allMatching` — that form has no key list. */
  readonly selectedKeys: Signal<readonly GridKey[]> = computed(() => {
    const state = this.stateSig();
    return state.kind === 'keys' ? [...state.keys] : [];
  });

  /** Switching to `'none'` clears; `'single'` keeps only the first key. */
  setMode(mode: SelectionMode): void {
    if (mode === this.modeSig()) {
      return;
    }
    this.modeSig.set(mode);
    this.rangeBaseSig.set(null);
    const state = this.stateSig();
    if (mode === 'none') {
      this.stateSig.set(EMPTY);
      return;
    }
    if (mode === 'single') {
      const first = state.kind === 'keys' ? [...state.keys].slice(0, 1) : [];
      this.stateSig.set({ kind: 'keys', keys: new Set(first) });
    }
  }

  isSelected(key: GridKey): boolean {
    const state = this.stateSig();
    if (state.kind === 'keys') {
      return state.keys.has(key);
    }
    return !state.exclusions.has(key);
  }

  /** Replaces the selection. Respects the mode. */
  setSelectedKeys(keys: readonly GridKey[]): void {
    const mode = this.modeSig();
    if (mode === 'none') {
      return;
    }
    const limited = mode === 'single' ? keys.slice(0, 1) : keys;
    this.stateSig.set({ kind: 'keys', keys: new Set(limited) });
    this.rangeBaseSig.set(null);
  }

  /**
   * Anchors a range at `key` over the selection as it stands. Call it after
   * the mutation, so the clicked row is inside the base a later range keeps.
   */
  private anchorAt(key: GridKey): void {
    this.anchorSig.set(key);
    const state = this.stateSig();
    this.rangeBaseSig.set(state.kind === 'keys' ? new Set(state.keys) : null);
  }

  /**
   * Anchors a range at `key` only when no anchor exists.
   *
   * A keyboard range starts at the row the user is standing on. Without a
   * seeded anchor the first `Shift+Arrow` would fall through to a plain
   * selection of the destination and leave the row it came from out.
   */
  anchorIfUnset(key: GridKey): void {
    if (this.anchorSig() == null) {
      this.anchorAt(key);
    }
  }

  /** Toggles one key. In `allMatching`, flips the key's exclusion. */
  toggle(key: GridKey): void {
    const mode = this.modeSig();
    if (mode === 'none') {
      return;
    }
    const state = this.stateSig();
    if (state.kind === 'allMatching') {
      const exclusions = new Set(state.exclusions);
      if (exclusions.has(key)) {
        exclusions.delete(key);
      } else {
        exclusions.add(key);
      }
      this.stateSig.set({ ...state, exclusions });
    } else if (mode === 'single') {
      this.stateSig.set({
        kind: 'keys',
        keys: state.keys.has(key) ? new Set() : new Set([key]),
      });
    } else {
      const keys = new Set(state.keys);
      if (keys.has(key)) {
        keys.delete(key);
      } else {
        keys.add(key);
      }
      this.stateSig.set({ kind: 'keys', keys });
    }
    // A click moves the anchor, so the next shift-click measures from what
    // the user last touched and keeps everything selected up to here.
    this.anchorAt(key);
  }

  /**
   * Selects one row the way a plain click does: it becomes the whole
   * selection and the anchor a later shift-click measures from. With
   * `additive`, it joins the selection instead of replacing it.
   */
  select(key: GridKey, options: { additive?: boolean } = {}): void {
    const mode = this.modeSig();
    if (mode === 'none') {
      return;
    }
    if (mode === 'multiple' && options.additive === true) {
      this.toggle(key);
      return;
    }
    this.stateSig.set({ kind: 'keys', keys: new Set([key]) });
    this.anchorAt(key);
  }

  /**
   * Selects the rows between the anchor and `key` in the given order. With
   * no anchor it behaves as a plain selection.
   *
   * A range never takes a row away: it adds to the selection the anchor was
   * set over. The anchor and that base both stay put, so shift-clicking again
   * re-measures from the same start — a shorter range releases the rows only
   * the longer range had, and rows selected before the anchor survive both.
   */
  selectRange(key: GridKey, orderedKeys: readonly GridKey[]): void {
    if (this.modeSig() !== 'multiple') {
      this.select(key);
      return;
    }
    const anchor = this.anchorSig();
    if (anchor == null) {
      this.select(key);
      return;
    }
    const range = rangeBetween(orderedKeys, anchor, key);
    const state = this.stateSig();
    if (state.kind === 'allMatching') {
      // Every row is already selected here, so the range only takes back the
      // exclusions it covers.
      const exclusions = new Set(state.exclusions);
      for (const rangeKey of range) {
        exclusions.delete(rangeKey);
      }
      this.stateSig.set({ ...state, exclusions });
      return;
    }
    let base = this.rangeBaseSig();
    if (base == null) {
      base = new Set(state.keys);
      this.rangeBaseSig.set(base);
    }
    this.stateSig.set({ kind: 'keys', keys: new Set([...base, ...range]) });
  }

  /** Adds or removes a whole page of keys. Used by the header checkbox. */
  setPageSelected(keys: readonly GridKey[], selected: boolean): void {
    const mode = this.modeSig();
    if (mode !== 'multiple') {
      return;
    }
    const state = this.stateSig();
    // A whole-page change is not a range start, and the base it left behind
    // describes a selection the user has moved on from.
    this.rangeBaseSig.set(null);
    if (state.kind === 'allMatching') {
      const exclusions = new Set(state.exclusions);
      for (const key of keys) {
        if (selected) {
          exclusions.delete(key);
        } else {
          exclusions.add(key);
        }
      }
      this.stateSig.set({ ...state, exclusions });
      return;
    }
    const next = new Set(state.keys);
    for (const key of keys) {
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    this.stateSig.set({ kind: 'keys', keys: next });
  }

  /** Tri-state of a select-all control over the given keys. */
  pageState(keys: readonly GridKey[]): SelectAllState {
    return selectAllState(keys, (key) => this.isSelected(key));
  }

  /** Selects every row matching the given filter, as a predicate. */
  selectAllMatching(filter: FilterNode | null, search: string | null): void {
    if (this.modeSig() !== 'multiple') {
      return;
    }
    this.stateSig.set({ kind: 'allMatching', filter, search, exclusions: new Set() });
    this.rangeBaseSig.set(null);
  }

  clear(): void {
    this.stateSig.set(EMPTY);
    this.anchorSig.set(null);
    this.rangeBaseSig.set(null);
  }

  /** Where a range starts and what it preserves. Snapshot for the veto path. */
  anchorState(): AnchorState {
    return { anchor: this.anchorSig(), rangeBase: this.rangeBaseSig() };
  }

  /**
   * Puts back a snapshot taken before a mutation, anchor included.
   *
   * The only caller is the veto path: a handler that cancels
   * `selectionChanging` must leave no trace of the change it refused, and the
   * anchor moves on an ordinary click. Mode checks are deliberately skipped —
   * the snapshot is a state the mode already allowed.
   */
  restore(snapshot: SelectionSnapshot, anchor: AnchorState): void {
    this.stateSig.set(
      snapshot.kind === 'keys'
        ? { kind: 'keys', keys: new Set(snapshot.keys) }
        : {
            kind: 'allMatching',
            filter: snapshot.filter,
            search: snapshot.search,
            exclusions: new Set(snapshot.exclusions),
          },
    );
    this.anchorSig.set(anchor.anchor);
    this.rangeBaseSig.set(anchor.rangeBase);
  }

  /**
   * Drops selected keys that are not in the given set. Used after a reload
   * when the configured policy for vanished keys is `'drop'`.
   */
  retainKeys(existing: ReadonlySet<GridKey>): void {
    const state = this.stateSig();
    if (state.kind !== 'keys') {
      return;
    }
    const kept = [...state.keys].filter((key) => existing.has(key));
    if (kept.length !== state.keys.size) {
      this.stateSig.set({ kind: 'keys', keys: new Set(kept) });
    }
    const anchor = this.anchorSig();
    if (anchor != null && !existing.has(anchor)) {
      this.anchorSig.set(null);
    }
    const base = this.rangeBaseSig();
    if (base != null) {
      this.rangeBaseSig.set(new Set([...base].filter((key) => existing.has(key))));
    }
  }
}

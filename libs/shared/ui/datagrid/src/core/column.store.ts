/**
 * Column layout state: order, visibility, width and pinning.
 *
 * Definitions come from the config and are never mutated; user arrangement
 * lives in override maps keyed by the stable column id, so replacing the
 * config keeps the user's layout for columns that survive.
 */
import { computed, signal, type Signal } from '@angular/core';
import { leavesOfBand, leavesOfUnit, orderWithinBands } from './column-bands';
import type { ColumnDef } from './types/column.types';
import type { GridColumnState } from './types/state.types';
import type { BandPaths } from './column.store.types';

const NO_BANDS: BandPaths = new Map();

/** The query field a column reads and filters on. */
export function columnField<TRow>(def: ColumnDef<TRow>): string {
  return def.field ?? def.id;
}

/**
 * Folds the definitions' declared visibility into the hidden set, returning
 * the new set or `null` when nothing moved.
 *
 * The hidden set is the whole of visibility — a known column absent from it is
 * shown — so a column the definitions hid has to start out inside it. That is
 * what lets the chooser, the API and a restored state show it again.
 *
 * `declared` remembers what each column last declared. A definitions array
 * that says the same thing again therefore does not hide a column the user has
 * just shown, while a host that flips `visible` is followed.
 */
export function seedHiddenColumns(
  columns: readonly Pick<ColumnDef, 'id' | 'visible'>[],
  hidden: readonly string[],
  declared: Map<string, boolean>,
): readonly string[] | null {
  const next = new Set(hidden);
  let changed = false;
  for (const column of columns) {
    const visible = column.visible !== false;
    if (declared.get(column.id) === visible) {
      continue;
    }
    declared.set(column.id, visible);
    if (visible) {
      changed = next.delete(column.id) || changed;
    } else if (!next.has(column.id)) {
      next.add(column.id);
      changed = true;
    }
  }
  return changed ? [...next] : null;
}

function defaultOrder<TRow>(defs: readonly ColumnDef<TRow>[]): string[] {
  return defs
    .map((def, index) => ({ def, index }))
    .sort((a, b) => (a.def.visibleIndex ?? a.index) - (b.def.visibleIndex ?? b.index))
    .map((entry) => entry.def.id);
}

/** Holds column definitions plus the user's layout overrides. */
export class ColumnStore<TRow = unknown> {
  private readonly defsSig = signal<readonly ColumnDef<TRow>[]>([]);
  private readonly orderSig = signal<readonly string[] | null>(null);
  private readonly visibilitySig = signal<ReadonlyMap<string, boolean>>(new Map());
  private readonly widthsSig = signal<ReadonlyMap<string, number | 'auto'>>(new Map());
  private readonly pinsSig = signal<ReadonlyMap<string, 'start' | 'end' | false>>(new Map());
  private readonly bandsSig = signal<BandPaths>(NO_BANDS);

  /** Source fields of the row key, included in every projection. */
  private readonly keyFieldsSig = signal<readonly string[]>([]);

  /** All columns in display order, overrides merged into the definitions. */
  readonly columns: Signal<readonly ColumnDef<TRow>[]> = computed(() => {
    const defs = this.defsSig();
    const byId = new Map(defs.map((def) => [def.id, def]));
    const order = this.order();
    const visibility = this.visibilitySig();
    const widths = this.widthsSig();
    const pins = this.pinsSig();
    const result: ColumnDef<TRow>[] = [];
    for (const id of order) {
      const def = byId.get(id);
      if (!def) {
        continue;
      }
      result.push({
        ...def,
        // A withheld permission outranks the override: state restored from
        // before the column was locked must not hide or move a column the
        // definitions say the user cannot touch.
        visible:
          def.allow?.hiding === false
            ? def.visible !== false
            : (visibility.get(id) ?? def.visible ?? true),
        width: widths.get(id) ?? def.width,
        pinned:
          def.allow?.reordering === false
            ? (def.pinned ?? false)
            : (pins.get(id) ?? def.pinned ?? false),
      });
    }
    return result;
  });

  /** Visible columns in display order. */
  readonly visibleColumns: Signal<readonly ColumnDef<TRow>[]> = computed(() =>
    this.columns().filter((column) => column.visible !== false),
  );

  /**
   * The union of source fields and expansions the visible columns require,
   * plus the key fields.
   */
  readonly projection: Signal<{ select: readonly string[]; expand: readonly string[] }> = computed(
    () => {
      const select = new Set<string>(this.keyFieldsSig());
      const expand = new Set<string>();
      for (const column of this.visibleColumns()) {
        if (column.field != null) {
          select.add(column.field);
        }
        if (typeof column.display === 'string') {
          select.add(column.display);
        }
        for (const field of column.requires?.select ?? []) {
          select.add(field);
        }
        for (const entity of column.requires?.expand ?? []) {
          expand.add(entity);
        }
      }
      return { select: [...select], expand: [...expand] };
    },
  );

  /** The display order, with every band's leaves gathered together. */
  private order(): readonly string[] {
    return orderWithinBands(this.orderSig() ?? defaultOrder(this.defsSig()), this.bandsSig());
  }

  /** Replaces the definitions. Prunes overrides of columns that disappeared. */
  setColumns(defs: readonly ColumnDef<TRow>[]): void {
    const ids = new Set(defs.map((def) => def.id));
    this.defsSig.set(defs);
    const order = this.orderSig();
    if (order != null) {
      const kept = order.filter((id) => ids.has(id));
      const appended = defaultOrder(defs).filter((id) => !kept.includes(id));
      this.orderSig.set([...kept, ...appended]);
    }
    this.visibilitySig.set(prune(this.visibilitySig(), ids));
    this.widthsSig.set(prune(this.widthsSig(), ids));
    this.pinsSig.set(prune(this.pinsSig(), ids));
  }

  /**
   * Declares which band covers each leaf (§5.1).
   *
   * The store keeps working on a flat list of leaves; this is only what tells
   * it which of them must stay together.
   */
  setBandPaths(paths: BandPaths): void {
    this.bandsSig.set(paths);
  }

  setKeyFields(fields: readonly string[]): void {
    this.keyFieldsSig.set(fields);
  }

  setVisible(id: string, visible: boolean): void {
    this.visibilitySig.set(withEntry(this.visibilitySig(), id, visible));
  }

  /**
   * Replaces visibility with the user's hidden set, which is the whole of it:
   * a known column absent from the set is visible.
   *
   * The grid seeds the set from the definitions' `visible: false` before it
   * ever calls this, so a default-hidden column is in the set to begin with —
   * and can therefore be taken back out of it. A set that only ever recorded
   * hiding would leave the chooser, the API and a restored state with no way
   * to express the other deviation.
   */
  setHiddenIds(ids: ReadonlySet<string>): void {
    const next = new Map<string, boolean>();
    for (const def of this.defsSig()) {
      next.set(def.id, !ids.has(def.id));
    }
    if (sameVisibility(next, this.visibilitySig())) {
      return;
    }
    this.visibilitySig.set(next);
  }

  setWidth(id: string, width: number | 'auto'): void {
    this.widthsSig.set(withEntry(this.widthsSig(), id, width));
  }

  /**
   * Pins a column, and with it every other column of its band.
   *
   * Half a band at the frozen edge would leave its caption spanning a gap, so
   * the band is what pins (§5.1).
   */
  pin(id: string, side: 'start' | 'end' | false): void {
    const band = this.bandsSig().get(id)?.[0];
    const ids = band === undefined ? [id] : leavesOfBand(band, this.order(), this.bandsSig());
    let pins = this.pinsSig();
    for (const target of ids) {
      pins = withEntry(pins, target, side);
    }
    this.pinsSig.set(pins);
  }

  /** Moves a column to a position among the visible columns. */
  move(id: string, visibleIndex: number): void {
    const order = [...this.order()];
    const from = order.indexOf(id);
    if (from < 0) {
      return;
    }
    order.splice(from, 1);
    const visibleIds = order.filter((candidate) => this.isVisibleId(candidate));
    const clamped = Math.max(0, Math.min(visibleIndex, visibleIds.length));
    const anchor = visibleIds[clamped] as string | undefined;
    if (anchor === undefined) {
      order.push(id);
    } else {
      order.splice(order.indexOf(anchor), 0, id);
    }
    this.writeOrder(order);
  }

  /**
   * Moves a header unit — one column, or a whole band — to where a sibling
   * unit sits.
   *
   * The band case is why this is not {@link move}: a band has no single
   * position, and moving its leaves one at a time would walk them through the
   * band they are passing.
   *
   * Returns the new position of the unit's first visible column, or `null`
   * when nothing moved.
   */
  moveUnit(unitId: string, overId: string): number | null {
    const bands = this.bandsSig();
    const order = this.order();
    const moving = leavesOfUnit(unitId, order, bands);
    const target = leavesOfUnit(overId, order, bands);
    if (moving.length === 0 || target.length === 0 || moving.includes(target[0])) {
      return null;
    }
    const movingSet = new Set(moving);
    const rest = order.filter((id) => !movingSet.has(id));
    // Forward means landing after the target run, backward means before it —
    // which is what makes a drag that passed over a band clear it entirely.
    const forward = order.indexOf(moving[0]) < order.indexOf(target[0]);
    const anchor = forward ? target[target.length - 1] : target[0];
    const at = rest.indexOf(anchor) + (forward ? 1 : 0);
    const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
    this.writeOrder(next);
    return this.visibleIndexOf(moving[0]);
  }

  /** Position of a column among the visible ones, or `null` when it is hidden. */
  visibleIndexOf(id: string): number | null {
    const index = this.order()
      .filter((candidate) => this.isVisibleId(candidate))
      .indexOf(id);
    return index < 0 ? null : index;
  }

  /** Writes an order, gathering each band's leaves back together first. */
  private writeOrder(order: readonly string[]): void {
    this.orderSig.set(orderWithinBands(order, this.bandsSig()));
  }

  private isVisibleId(id: string): boolean {
    const def = this.defsSig().find((candidate) => candidate.id === id);
    if (def?.allow?.hiding === false) {
      return def.visible !== false;
    }
    const override = this.visibilitySig().get(id);
    if (override !== undefined) {
      return override;
    }
    return def?.visible ?? true;
  }

  /** Clears every layout override. */
  reset(): void {
    this.orderSig.set(null);
    this.visibilitySig.set(new Map());
    this.widthsSig.set(new Map());
    this.pinsSig.set(new Map());
  }

  /** Serializes the layout as state entries, one per column, in display order. */
  layoutState(): GridColumnState[] {
    let visibleIndex = 0;
    return this.columns().map((column) => {
      const entry: GridColumnState = { id: column.id };
      entry.visible = column.visible !== false;
      if (entry.visible) {
        entry.visibleIndex = visibleIndex;
        visibleIndex += 1;
      }
      if (column.width !== undefined) {
        entry.width = column.width;
      }
      entry.pinned = column.pinned ?? false;
      return entry;
    });
  }

  /**
   * Applies layout entries. Entries referencing unknown columns are ignored
   * and reported back.
   */
  applyLayoutState(entries: readonly GridColumnState[]): string[] {
    const defs = this.defsSig();
    const known = new Set(defs.map((def) => def.id));
    const dropped: string[] = [];
    const visibility = new Map(this.visibilitySig());
    const widths = new Map(this.widthsSig());
    const pins = new Map(this.pinsSig());
    const positions = new Map<string, number>();
    for (const entry of entries) {
      if (!known.has(entry.id)) {
        dropped.push(entry.id);
        continue;
      }
      if (entry.visible !== undefined) {
        visibility.set(entry.id, entry.visible);
      }
      if (entry.width !== undefined) {
        widths.set(entry.id, entry.width);
      }
      if (entry.pinned !== undefined) {
        pins.set(entry.id, entry.pinned);
      }
      if (entry.visibleIndex !== undefined) {
        positions.set(entry.id, entry.visibleIndex);
      }
    }
    this.visibilitySig.set(visibility);
    this.widthsSig.set(widths);
    this.pinsSig.set(pins);
    if (positions.size > 0) {
      const base = this.orderSig() ?? defaultOrder(defs);
      const withKeys = base.map((id, index) => ({ id, key: positions.get(id) ?? index }));
      withKeys.sort((a, b) => a.key - b.key);
      // An arrangement saved before a band existed can interleave its leaves.
      // Writing it through the band rule restores what it can and leaves the
      // header consistent, rather than reporting the whole state as unusable.
      this.writeOrder(withKeys.map((entry) => entry.id));
    }
    return dropped;
  }
}

/**
 * Drops overrides for columns that no longer exist. Returns the original map
 * when nothing was dropped: a fresh identity would invalidate every computed
 * that reads it, on every column update.
 */
function prune<TValue>(
  map: ReadonlyMap<string, TValue>,
  ids: ReadonlySet<string>,
): ReadonlyMap<string, TValue> {
  let dropped = false;
  const next = new Map<string, TValue>();
  for (const [id, value] of map) {
    if (ids.has(id)) {
      next.set(id, value);
    } else {
      dropped = true;
    }
  }
  return dropped ? next : map;
}

/** Whether two visibility maps say the same thing, so identity can be kept. */
function sameVisibility(a: ReadonlyMap<string, boolean>, b: ReadonlyMap<string, boolean>): boolean {
  return a.size === b.size && [...a].every(([id, visible]) => b.get(id) === visible);
}

function withEntry<TValue>(
  map: ReadonlyMap<string, TValue>,
  id: string,
  value: TValue,
): ReadonlyMap<string, TValue> {
  const next = new Map(map);
  next.set(id, value);
  return next;
}

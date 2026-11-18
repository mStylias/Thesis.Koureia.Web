import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import {
  isImplementedToolbarItem,
  pendingToolbarItemMilestone,
  sortToolbarEntries,
  splitToolbarOverflow,
  toolbarHeadroom,
  toolbarItemVisible,
  toolbarRegion,
} from './toolbar';
import { applyToolbarOverrides, builtInToolbarEntry, hostToolbarEntry } from './toolbar-entries';
import type { ToolbarEntryDeps } from './toolbar-entries.types';
import type { ToolbarEntry, ToolbarLocation, ToolbarOverflowPolicy } from './toolbar.types';

function entry(id: string, overrides: Partial<ToolbarEntry> = {}): ToolbarEntry {
  return {
    id,
    location: 'start',
    order: 0,
    overflow: 'auto',
    elastic: false,
    kind: 'button',
    label: id,
    labelKey: '',
    shortLabel: '',
    shortLabelKey: '',
    tooltip: '',
    icon: null,
    variant: 'secondary',
    iconOnly: false,
    busy: false,
    disabled: false,
    badge: '',
    command: null,
    items: [],
    template: null,
    component: null,
    ...overrides,
  };
}

function split(
  items: readonly (readonly [string, ToolbarOverflowPolicy, number])[],
  available: number,
  triggerWidth = 40,
): { inline: readonly string[]; collapsed: readonly string[] } {
  return splitToolbarOverflow({
    entries: items.map(([id, overflow]) => ({ id, overflow })),
    widths: new Map(items.map(([id, , width]) => [id, width])),
    available,
    triggerWidth,
  });
}

function headroom(
  items: readonly (readonly [string, boolean, number])[],
  available: number,
  triggerWidth = 40,
): number {
  return toolbarHeadroom({
    entries: items.map(([id, elastic]) => ({ id, elastic })),
    widths: new Map(items.map(([id, , width]) => [id, width])),
    available,
    triggerWidth,
  });
}

describe('toolbarHeadroom', () => {
  it('reports what is left once the rigid entries have taken theirs', () => {
    expect(
      headroom(
        [
          ['a', false, 100],
          ['b', false, 100],
        ],
        400,
      ),
    ).toBe(160);
  });

  it('leaves an elastic entry out, whatever it currently measures', () => {
    const rigid = headroom([['a', false, 100]], 400);

    expect(
      headroom(
        [
          ['a', false, 100],
          ['views', true, 300],
        ],
        400,
      ),
    ).toBe(rigid);
    // The same bar, with the elastic entry now in its narrow form. An answer
    // that moved here would send it straight back to the wide one.
    expect(
      headroom(
        [
          ['a', false, 100],
          ['views', true, 120],
        ],
        400,
      ),
    ).toBe(rigid);
  });

  it('takes the trigger off whether or not one is drawn, so the answer comes first', () => {
    expect(headroom([['a', false, 100]], 400, 40)).toBe(260);
    expect(headroom([['a', false, 100]], 400, 0)).toBe(300);
  });

  it('is unbounded before the bar has been measured', () => {
    expect(headroom([['a', false, 100]], 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('goes negative once the rigid entries have overrun the bar', () => {
    expect(
      headroom(
        [
          ['a', false, 300],
          ['b', false, 300],
        ],
        400,
      ),
    ).toBeLessThan(0);
  });

  it('counts an entry it has never measured as nothing, not as a guess', () => {
    expect(
      toolbarHeadroom({
        entries: [{ id: 'a', elastic: false }],
        widths: new Map(),
        available: 400,
        triggerWidth: 40,
      }),
    ).toBe(360);
  });
});

describe('built-in item registry', () => {
  it('recognizes the items this milestone implements', () => {
    expect(isImplementedToolbarItem('columnChooser')).toBe(true);
    expect(isImplementedToolbarItem('refresh')).toBe(true);
  });

  it('recognizes the export item the export milestone shipped', () => {
    expect(isImplementedToolbarItem('export')).toBe(true);
    expect(pendingToolbarItemMilestone('export')).toBeNull();
  });

  it('answers null for a name that is not a built-in at all', () => {
    expect(pendingToolbarItemMilestone('nonsense')).toBeNull();
  });
});

describe('visibility predicates', () => {
  it('shows an item that declares nothing', () => {
    expect(toolbarItemVisible({ id: 'a' })).toBe(true);
  });

  it('reads a boolean', () => {
    expect(toolbarItemVisible({ id: 'a', visible: false })).toBe(false);
  });

  it('calls a predicate, so a host gates on its own rules', () => {
    expect(toolbarItemVisible({ id: 'a', visible: () => false })).toBe(false);
    expect(toolbarItemVisible({ id: 'a', visible: () => true })).toBe(true);
  });
});

describe('ordering', () => {
  it('sorts by order and keeps declaration order within one value', () => {
    const sorted = sortToolbarEntries([
      entry('a', { order: 2 }),
      entry('b'),
      entry('c'),
      entry('d', { order: -1 }),
    ]);
    expect(sorted.map((held) => held.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('splits into regions without reordering', () => {
    const entries = [entry('a', { location: 'end' }), entry('b'), entry('c', { location: 'end' })];
    const locations: readonly ToolbarLocation[] = ['start', 'end'];
    expect(locations.map((location) => toolbarRegion(entries, location).map((e) => e.id))).toEqual([
      ['b'],
      ['a', 'c'],
    ]);
  });
});

describe('overflow', () => {
  it('keeps everything inline before the bar has been measured', () => {
    const result = split(
      [
        ['a', 'auto', 100],
        ['b', 'auto', 100],
      ],
      0,
    );
    expect(result.collapsed).toEqual([]);
  });

  it('keeps everything inline when it fits', () => {
    const result = split(
      [
        ['a', 'auto', 100],
        ['b', 'auto', 100],
      ],
      300,
    );
    expect(result.inline).toEqual(['a', 'b']);
    expect(result.collapsed).toEqual([]);
  });

  it('collapses from the end, so the bar loses its trailing items', () => {
    const result = split(
      [
        ['a', 'auto', 100],
        ['b', 'auto', 100],
        ['c', 'auto', 100],
      ],
      220,
    );
    expect(result.inline).toEqual(['a']);
    expect(result.collapsed).toEqual(['b', 'c']);
  });

  it('reserves the trigger width, so the bar does not overflow by exactly it', () => {
    // Two 100px entries fit 210px, but not once a 40px trigger is drawn.
    const result = split(
      [
        ['a', 'auto', 100],
        ['b', 'auto', 100],
        ['c', 'auto', 100],
      ],
      210,
    );
    expect(result.inline).toEqual(['a']);
  });

  it('never collapses an item the host declared uncollapsible', () => {
    const result = split(
      [
        ['a', 'never', 200],
        ['b', 'auto', 200],
      ],
      100,
    );
    expect(result.inline).toEqual(['a']);
    expect(result.collapsed).toEqual(['b']);
  });

  it('collapses an "always" item however much room there is', () => {
    const result = split(
      [
        ['a', 'always', 40],
        ['b', 'auto', 40],
      ],
      1000,
    );
    expect(result.inline).toEqual(['b']);
    expect(result.collapsed).toEqual(['a']);
  });

  it('reports both halves in draw order', () => {
    const result = split(
      [
        ['a', 'auto', 100],
        ['b', 'always', 100],
        ['c', 'auto', 100],
      ],
      1000,
    );
    expect(result.inline).toEqual(['a', 'c']);
    expect(result.collapsed).toEqual(['b']);
  });
});

describe('placement overrides', () => {
  it('moves an entry to the region and the order the host asked for', () => {
    const placed = applyToolbarOverrides(entry('export', { location: 'start' }), {
      location: 'end',
      order: 3,
      overflow: 'never',
    });
    expect(placed.location).toBe('end');
    expect(placed.order).toBe(3);
    expect(placed.overflow).toBe('never');
  });

  it('keeps what the host left unsaid', () => {
    const placed = applyToolbarOverrides(entry('export', { location: 'end', order: 2 }), {});
    expect(placed.location).toBe('end');
    expect(placed.order).toBe(2);
  });

  it('draws an entry icon-only once it has an icon to draw', () => {
    const icon = {} as ToolbarEntry['icon'];
    expect(applyToolbarOverrides(entry('a', { icon }), { iconOnly: true }).iconOnly).toBe(true);
  });

  it('refuses icon-only on an entry with no icon, which would draw a blank', () => {
    expect(applyToolbarOverrides(entry('a'), { iconOnly: true }).iconOnly).toBe(false);
  });
});

describe('host item appearance', () => {
  const icon = {} as NonNullable<ToolbarEntry['icon']>;

  it('follows the bar-wide icon-only rule', () => {
    expect(
      hostToolbarEntry({ id: 'a', label: 'A', icon }, undefined, { iconOnly: true })?.iconOnly,
    ).toBe(true);
  });

  it('lets one item refuse the bar-wide rule', () => {
    expect(
      hostToolbarEntry({ id: 'a', label: 'A', icon, iconOnly: false }, undefined, {
        iconOnly: true,
      })?.iconOnly,
    ).toBe(false);
  });

  it('is busy while the grid reloads when it asks to follow the reloads', () => {
    const item = { id: 'a', label: 'A', icon, busy: 'reload' as const };
    expect(hostToolbarEntry(item, undefined, {})?.busy).toBe(false);
    const reloading = hostToolbarEntry(item, undefined, { loading: true, refreshing: true });
    expect(reloading?.busy).toBe(true);
    expect(reloading?.disabled).toBe(true);
  });

  // Regression: the refresh icon spun through the first load, which nobody asked for.
  it('stays still, but blocked, through the first load', () => {
    const item = { id: 'a', label: 'A', icon, busy: 'reload' as const };
    const first = hostToolbarEntry(item, undefined, { loading: true, refreshing: false });
    expect(first?.busy).toBe(false);
    expect(first?.disabled).toBe(true);
  });

  it('ignores the grid load unless the item asks to follow it', () => {
    expect(
      hostToolbarEntry({ id: 'a', label: 'A', icon }, undefined, {
        loading: true,
        refreshing: true,
      })?.busy,
    ).toBe(false);
    expect(hostToolbarEntry({ id: 'a', label: 'A', icon, busy: true }, undefined)?.busy).toBe(true);
  });

  it('keeps the caption of an item that has no icon', () => {
    expect(hostToolbarEntry({ id: 'a', label: 'A' }, undefined, { iconOnly: true })?.iconOnly).toBe(
      false,
    );
  });
});

/**
 * A neutral set of deps: every capability granted, every surface absent. Each
 * test turns on the one thing its item reads, so what an item depends on is
 * visible in the test rather than buried in a fixture.
 */
function deps(overrides: Partial<ToolbarEntryDeps> = {}): ToolbarEntryDeps {
  return {
    allows: () => true,
    loading: signal(false),
    refreshing: signal(false),
    selectionMode: signal('none'),
    selectedCount: signal(0),
    hasSelection: signal(false),
    hasFilterRow: signal(false),
    filterRowShown: signal(true),
    groupPanelShown: signal(true),
    canExport: signal(false),
    exportFormats: signal([]),
    exportBusy: signal(false),
    autoRefresh: signal(false),
    autoRefreshInterval: signal(30_000),
    refreshIntervals: signal([]),
    refreshSuspended: signal(false),
    reload: () => undefined,
    toggleAutoRefresh: () => undefined,
    resetArrangement: () => undefined,
    clearSelection: () => undefined,
    exportGrid: () => undefined,
    sortColumns: signal([]),
    hasSort: signal(false),
    cycleSort: () => undefined,
    clearSort: () => undefined,
    hasFilterBuilder: signal(false),
    openFilterBuilder: () => undefined,
    view: signal('table'),
    setView: () => undefined,
    viewsRenderer: signal(null),
    ...overrides,
  };
}

describe('the refresh item', () => {
  // Regression: the icon spun through the first load, which nobody asked for.
  it('stays still, but blocked, through the first load', () => {
    const resolved = builtInToolbarEntry('refresh', deps({ loading: signal(true) }));
    expect(resolved?.busy).toBe(false);
    expect(resolved?.disabled).toBe(true);
  });

  it('spins through a reload', () => {
    const resolved = builtInToolbarEntry(
      'refresh',
      deps({ loading: signal(true), refreshing: signal(true) }),
    );
    expect(resolved?.busy).toBe(true);
  });
});

describe('the filter builder item', () => {
  it('resolves when the grid offers the editor', () => {
    const resolved = builtInToolbarEntry('filterBuilder', deps({ hasFilterBuilder: signal(true) }));

    expect(resolved?.labelKey).toBe('datagrid.filterBuilder.open');
  });

  it('resolves to nothing when there is no editor to open', () => {
    expect(builtInToolbarEntry('filterBuilder', deps())).toBeNull();
  });

  it('resolves to nothing when filtering is withheld', () => {
    const resolved = builtInToolbarEntry(
      'filterBuilder',
      deps({ hasFilterBuilder: signal(true), allows: () => false }),
    );

    expect(resolved).toBeNull();
  });

  it('hands the press on to the editor, which anchors on it', () => {
    const open = vi.fn();
    const resolved = builtInToolbarEntry(
      'filterBuilder',
      deps({ hasFilterBuilder: signal(true), openFilterBuilder: open }),
    );
    const press = new MouseEvent('click');
    resolved?.command?.(press);

    expect(open).toHaveBeenCalledWith(press);
  });
});

describe('the sort menu item', () => {
  it('is withheld in the table, where the header sorts', () => {
    const resolved = builtInToolbarEntry(
      'sortMenu',
      deps({ sortColumns: signal([{ id: 'name', caption: 'Name', direction: null }]) }),
    );

    expect(resolved).toBeNull();
  });

  it('resolves in the card view, where there is no header', () => {
    const resolved = builtInToolbarEntry(
      'sortMenu',
      deps({
        view: signal('cards'),
        sortColumns: signal([{ id: 'name', caption: 'Name', direction: null }]),
      }),
    );

    expect(resolved?.kind).toBe('menu');
    expect(resolved?.items).toHaveLength(1);
  });

  it('offers a way back to unsorted only while something is sorted', () => {
    const columns = signal([{ id: 'name', caption: 'Name', direction: 'asc' as const }]);
    const resolved = builtInToolbarEntry(
      'sortMenu',
      deps({ view: signal('cards'), sortColumns: columns, hasSort: signal(true) }),
    );

    expect(resolved?.items.map((item) => item.id)).toEqual(['name', 'clear']);
  });
});

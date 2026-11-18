/**
 * Turns what the host declared into the entries the bar draws.
 *
 * A built-in name becomes a label, an icon and a command here rather than in
 * the bar: the bar draws entries and knows nothing of the grid's own actions.
 * A host item becomes an entry without reading grid state at all.
 */
import { isDevMode } from '@angular/core';
import {
  LucideArrowDownUp,
  LucideArrowDownAZ,
  LucideArrowUpZA,
  LucideColumns3,
  LucideDownload,
  LucideFunnel,
  LucideGroup,
  LucideLayoutGrid,
  LucideListChecks,
  LucideListFilter,
  LucideRefreshCw,
  LucideTable,
  LucideUndo2,
  LucideTimer,
} from '@lucide/angular';
import { TOOLBAR_ENTRY_BASE, NO_INPUTS } from '../datagrid.constants';
import { resolveRenderer } from './renderer-ref';
import {
  isImplementedToolbarItem,
  pendingToolbarItemMilestone,
  toolbarItemVisible,
} from './toolbar';
import type { ToolbarEntry, ToolbarSubItem } from './toolbar.types';
import type {
  SortMenuColumn,
  ToolbarEntryDeps,
  ToolbarEntryOverrides,
} from './toolbar-entries.types';
import type { RendererRef } from './types/column.types';
import type { BuiltInToolbarItem, ToolbarItem } from './types/config.types';
import type { ExportScope } from './types/export.types';

/**
 * One built-in item, or `null` when this grid does not offer it.
 *
 * An item resolves to nothing when its capability is withheld or its surface
 * is absent: §3.3 asks for the affordance to be withheld rather than drawn
 * inert, and a refresh button on a grid whose data never reloads is the same
 * mistake in a different place.
 */
export function builtInToolbarEntry(
  name: BuiltInToolbarItem,
  deps: ToolbarEntryDeps,
  overrides: ToolbarEntryOverrides = {},
): ToolbarEntry | null {
  const entry = resolveBuiltIn(name, deps);
  return entry == null ? null : applyToolbarOverrides(entry, overrides);
}

/**
 * Draws an entry as its icon alone, where it has one.
 *
 * The last word on icon-only, applied after an entry is built: the card view
 * imposes it on host items too, which state their own preference and normally
 * win. A button with neither icon nor caption is a blank, so an entry with no
 * icon is returned untouched.
 */
export function withIconOnly(entry: ToolbarEntry): ToolbarEntry {
  return entry.icon == null || entry.iconOnly ? entry : { ...entry, iconOnly: true };
}

/**
 * Places an entry the way the host asked, over the placement the grid chose.
 *
 * Applied to built-in and host entries alike, so the bar-wide `iconOnly` and a
 * per-item one reach both through one path.
 */
export function applyToolbarOverrides(
  entry: ToolbarEntry,
  overrides: ToolbarEntryOverrides,
): ToolbarEntry {
  return {
    ...entry,
    location: overrides.location ?? entry.location,
    order: overrides.order ?? entry.order,
    overflow: overrides.overflow ?? entry.overflow,
    // An entry with no icon keeps its caption: a button with neither is blank.
    iconOnly: (overrides.iconOnly ?? entry.iconOnly) && entry.icon != null,
  };
}

function resolveBuiltIn(name: BuiltInToolbarItem, deps: ToolbarEntryDeps): ToolbarEntry | null {
  if (!isImplementedToolbarItem(name)) {
    // The type says every built-in name resolves, so the guard narrows it to
    // `never`. It stays because the runtime disagrees: a typo and an older
    // build both arrive here, and this warning is all that tells the host.
    const unresolved: string = name;
    const milestone = pendingToolbarItemMilestone(unresolved);
    if (isDevMode()) {
      console.warn(
        milestone == null
          ? `datagrid: "${unresolved}" is not a toolbar item this grid knows`
          : `datagrid: the "${unresolved}" toolbar item ships with ${milestone}`,
      );
    }
    return null;
  }
  const base = { ...TOOLBAR_ENTRY_BASE, id: name };
  switch (name) {
    case 'columnChooser':
      // The chooser draws its own trigger. The icon is named here so the
      // icon-only rule reads the same on this entry as on every other.
      return deps.allows('hiding')
        ? {
            ...base,
            kind: 'columnChooser',
            labelKey: 'datagrid.chooser.title',
            icon: LucideColumns3,
          }
        : null;
    case 'search':
      return deps.allows('filtering')
        ? { ...base, kind: 'search', location: 'start', labelKey: 'datagrid.search.label' }
        : null;
    case 'export': {
      if (!deps.canExport()) {
        return null;
      }
      const menu = exportMenuEntries(deps);
      return {
        ...base,
        // One format and nothing selected is one action, so it is a button.
        // Anything more is a choice, and a choice is a menu.
        kind: menu.length > 1 ? 'menu' : 'button',
        location: 'end',
        labelKey: 'datagrid.export.label',
        icon: LucideDownload,
        disabled: deps.exportBusy(),
        command:
          menu.length > 1
            ? null
            : (): void => {
                deps.exportGrid(deps.exportFormats()[0]);
              },
        items: menu.length > 1 ? menu : [],
      };
    }
    case 'refresh':
      return {
        ...base,
        location: 'end',
        labelKey: 'datagrid.refresh.now',
        icon: LucideRefreshCw,
        // The whole of the feedback for a refresh whose rows come back
        // unchanged. The grid holds the load open long enough to read it. The
        // first load has the skeleton, and nobody pressed this button.
        busy: deps.refreshing(),
        disabled: deps.loading(),
        command: () => {
          deps.reload();
        },
      };
    case 'autoRefresh':
      return {
        ...base,
        kind: 'menu',
        location: 'end',
        labelKey: autoRefreshLabelKey(deps),
        icon: LucideTimer,
        items: autoRefreshMenuEntries(deps),
      };
    case 'clearSelection': {
      if (!deps.allows('selection') || deps.selectionMode() === 'none') {
        return null;
      }
      const count = deps.selectedCount();
      return {
        ...base,
        labelKey: 'datagrid.selection.clear',
        icon: LucideListChecks,
        disabled: count === 0,
        badge: Number.isFinite(count) && count > 0 ? count.toString() : '',
        command: () => {
          deps.clearSelection();
        },
      };
    }
    case 'resetArrangement':
      return deps.allows('stateChange')
        ? {
            ...base,
            location: 'end',
            labelKey: 'datagrid.toolbarItem.resetLayout',
            // The full caption names the whole of what it restores, which is
            // right on a button standing alone and long in a list of rows.
            shortLabelKey: 'datagrid.toolbarItem.resetLayoutShort',
            icon: LucideUndo2,
            command: () => {
              deps.resetArrangement();
            },
          }
        : null;
    case 'filterToggle':
      return deps.allows('filtering') && deps.hasFilterRow()
        ? {
            ...base,
            labelKey: deps.filterRowShown()
              ? 'datagrid.toolbarItem.hideFilterRow'
              : 'datagrid.toolbarItem.showFilterRow',
            icon: LucideFunnel,
            command: () => {
              deps.filterRowShown.update((shown) => !shown);
            },
          }
        : null;
    case 'sortMenu': {
      // The card view's only sort affordance, and only its own: the table
      // sorts from its header, where the control sits on the thing it sorts.
      // A second one in the bar would be the same action said twice.
      //
      // Withheld rather than drawn empty for the rest: a menu of no columns
      // opens onto nothing, which §3.3 asks the grid not to render.
      if (deps.view() !== 'cards' || !deps.allows('sorting') || deps.sortColumns().length === 0) {
        return null;
      }
      return {
        ...base,
        kind: 'menu',
        location: 'end',
        labelKey: 'datagrid.sort.menu',
        icon: LucideArrowDownUp,
        items: sortMenuEntries(deps),
      };
    }
    case 'filterBuilder':
      // The editor's own bar is a full row spent on one trigger. Naming this
      // item moves the trigger into the bar, and the grid drops the row.
      return deps.allows('filtering') && deps.hasFilterBuilder()
        ? {
            ...base,
            location: 'end',
            labelKey: 'datagrid.filterBuilder.open',
            icon: LucideListFilter,
            command: (event) => {
              deps.openFilterBuilder(event);
            },
          }
        : null;
    case 'viewSwitch': {
      const cards = deps.view() === 'cards';
      return {
        ...base,
        location: 'end',
        // Names the presentation it moves to, not the one in force: the button
        // is an action, and a toggle labelled by its own state reads as a
        // report of where the user already is.
        labelKey: cards ? 'datagrid.view.showTable' : 'datagrid.view.showCards',
        icon: cards ? LucideTable : LucideLayoutGrid,
        command: () => {
          deps.setView(cards ? 'table' : 'cards');
        },
      };
    }
    case 'views': {
      const renderer = deps.viewsRenderer();
      return renderer == null
        ? null
        : {
            ...base,
            location: 'start',
            // Never collapsed: the overflow surface is a stacked list of rows,
            // and a scrolling strip of draggable tabs is not a row. It answers
            // the squeeze by changing shape instead, which is what makes it
            // elastic — its own width is therefore not part of the bar's sum.
            overflow: 'never',
            elastic: true,
            kind: 'component',
            labelKey: 'datagrid.views.label',
            component: renderer,
          };
    }
    case 'groupPanel':
      return deps.allows('grouping')
        ? {
            ...base,
            labelKey: deps.groupPanelShown()
              ? 'datagrid.toolbarItem.hideGroupPanel'
              : 'datagrid.toolbarItem.showGroupPanel',
            icon: LucideGroup,
            command: () => {
              deps.groupPanelShown.update((shown) => !shown);
            },
          }
        : null;
  }
}

/** One host item. `null` when its own visibility predicate refuses it. */
export function hostToolbarEntry(
  item: ToolbarItem,
  slot: RendererRef | undefined,
  overrides: ToolbarEntryOverrides = {},
): ToolbarEntry | null {
  if (!toolbarItemVisible(item)) {
    return null;
  }
  const renderer = resolveRenderer<unknown>(slot ?? item.renderer);
  if (renderer.template != null || renderer.component != null) {
    return {
      ...TOOLBAR_ENTRY_BASE,
      id: item.id,
      location: item.location ?? overrides.location ?? 'start',
      order: item.order ?? overrides.order ?? 0,
      overflow: item.overflow ?? overrides.overflow ?? 'auto',
      kind: renderer.template == null ? 'component' : 'template',
      template: renderer.template,
      component:
        renderer.component == null ? null : { type: renderer.component, inputs: NO_INPUTS },
    };
  }
  const items = (item.items ?? []).filter(toolbarItemVisible).map((child): ToolbarSubItem => ({
    id: child.id,
    label: child.label ?? child.id,
    labelKey: '',
    labelParams: null,
    icon: child.icon ?? null,
    disabled: child.disabled === true,
    checked: child.checked ?? null,
    command: () => {
      child.onClick?.();
    },
  }));
  const follows = item.busy === 'reload';
  const busy = follows ? overrides.refreshing === true : item.busy === true;
  return {
    ...TOOLBAR_ENTRY_BASE,
    id: item.id,
    location: item.location ?? overrides.location ?? 'start',
    order: item.order ?? overrides.order ?? 0,
    overflow: item.overflow ?? overrides.overflow ?? 'auto',
    // `items` alone is a menu; `items` with a handler is a split button, whose
    // primary half runs the handler.
    kind: items.length === 0 ? 'button' : item.onClick == null ? 'menu' : 'split',
    label: item.label ?? item.id,
    shortLabel: item.shortLabel ?? '',
    tooltip: item.tooltip ?? '',
    icon: item.icon ?? null,
    variant: item.variant ?? 'secondary',
    // An item with no icon keeps its caption: a button with neither is blank.
    iconOnly: (item.iconOnly ?? overrides.iconOnly ?? false) && item.icon != null,
    busy,
    disabled: item.disabled === true || busy || (follows && overrides.loading === true),
    badge: item.badge == null ? '' : String(item.badge),
    command: item.onClick == null ? null : (): void => item.onClick?.(),
    items,
  };
}

/**
 * The export item's menu: one entry per format, and a second per format for
 * the selected rows while something is selected.
 *
 * The selected-rows entries appear only when they would do something. An entry
 * that is always there and usually disabled announces as unavailable and stays
 * in the keyboard walk, which §3.3 asks the grid not to do.
 */
export function exportMenuEntries(deps: ToolbarEntryDeps): readonly ToolbarSubItem[] {
  const formats = deps.exportFormats();
  const entry = (format: string, scope: ExportScope): ToolbarSubItem => ({
    id: `${format}:${scope}`,
    label: '',
    labelKey: scope === 'selected' ? 'datagrid.export.formatSelected' : 'datagrid.export.format',
    labelParams: { format: format.toUpperCase() },
    icon: null,
    disabled: deps.exportBusy(),
    checked: null,
    command: () => {
      deps.exportGrid(format, { scope });
    },
  });
  const entries: ToolbarSubItem[] = formats.map((format) => entry(format, 'all'));
  if (deps.hasSelection()) {
    entries.push(...formats.map((format) => entry(format, 'selected')));
  }
  return entries;
}

/**
 * The sort menu's entries: one per sortable column, then a way back to none.
 *
 * One sort key at a time. The header expresses multi-sort through a
 * `Shift`-click, which a menu has no equivalent of, and a menu row carrying a
 * position badge and a direction is a control the user has to be taught. A
 * grid that needs several keys in this presentation binds `sort` itself.
 *
 * Pressing the column in force advances it — ascending, descending, then
 * unsorted — so one row is the whole cycle and the menu never grows a second
 * entry per column.
 */
export function sortMenuEntries(deps: ToolbarEntryDeps): readonly ToolbarSubItem[] {
  const entries: ToolbarSubItem[] = deps.sortColumns().map((column: SortMenuColumn) => ({
    id: column.id,
    label: column.caption,
    labelKey: '',
    labelParams: null,
    icon:
      column.direction === 'asc'
        ? LucideArrowDownAZ
        : column.direction === 'desc'
          ? LucideArrowUpZA
          : null,
    disabled: false,
    // Marked rather than disabled: the entry in force is the one that
    // advances the cycle, so it has to stay pressable.
    checked: column.direction != null,
    command: () => {
      deps.cycleSort(column.id);
    },
  }));
  if (deps.hasSort()) {
    entries.push({
      id: 'clear',
      label: '',
      labelKey: 'datagrid.sort.clear',
      labelParams: null,
      icon: null,
      disabled: false,
      checked: null,
      command: () => {
        deps.clearSort();
      },
    });
  }
  return entries;
}

/** The auto-refresh item's caption: what it is doing, not what it will do. */
export function autoRefreshLabelKey(deps: ToolbarEntryDeps): string {
  if (!deps.autoRefresh()) {
    return 'datagrid.refresh.off';
  }
  return deps.refreshSuspended() ? 'datagrid.refresh.paused' : 'datagrid.refresh.on';
}

/** The auto-refresh item's menu: refresh now, pause or resume, then the periods. */
export function autoRefreshMenuEntries(deps: ToolbarEntryDeps): readonly ToolbarSubItem[] {
  const running = deps.autoRefresh();
  const entries: ToolbarSubItem[] = [
    {
      id: 'now',
      label: '',
      labelKey: 'datagrid.refresh.now',
      labelParams: null,
      icon: LucideRefreshCw,
      disabled: deps.loading(),
      checked: null,
      command: () => {
        deps.reload();
      },
    },
    {
      id: 'toggle',
      label: '',
      labelKey: running ? 'datagrid.refresh.pause' : 'datagrid.refresh.resume',
      labelParams: null,
      icon: null,
      disabled: false,
      checked: null,
      command: () => {
        deps.toggleAutoRefresh();
      },
    },
  ];
  for (const interval of deps.refreshIntervals()) {
    entries.push({
      id: `interval:${interval.toString()}`,
      label: '',
      labelKey: 'datagrid.refresh.every',
      labelParams: { seconds: Math.round(interval / 1000) },
      icon: null,
      disabled: false,
      // Marked rather than disabled: a disabled row announces as unavailable
      // and drops out of the keyboard walk.
      checked: deps.autoRefreshInterval() === interval,
      // Choosing an interval starts the refresh: picking one while it is off
      // otherwise sets a number nothing acts on.
      command: () => {
        deps.autoRefreshInterval.set(interval);
        deps.autoRefresh.set(true);
      },
    });
  }
  return entries;
}

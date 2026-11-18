import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  type Type,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UiCopyPipe, injectUiCopy } from '@util/ui-copy';
import { LucideDynamicIcon, LucideEllipsis } from '@lucide/angular';
import { Button, type ButtonSeverity, type ButtonVariant } from '@ui/button';
import { ContextMenu, type MenuItem } from '@ui/context-menu';
import { FloatingPanel, FloatingPanelContent } from '@ui/floating-panel';
import { PopoverTrigger } from '@ui/popover';
import { Spin } from '@ui/spin';
import { Tooltip } from '@ui/tooltip';
import { splitToolbarOverflow, toolbarHeadroom, toolbarRegion } from '../core/toolbar';
import { SAVED_VIEWS_HEADROOM } from '@ui/saved-views/core';
import { DATAGRID_TOOLBAR_HEADROOM } from '../core/toolbar-headroom';
import type { ToolbarEntry, ToolbarLocation } from '../core/toolbar.types';
import { DATAGRID_TRANSLOCO_SCOPE } from '../datagrid.i18n';
import { DatagridColumnChooser } from '../column-chooser/datagrid-column-chooser';
import {
  ColumnPanel,
  injectColumnChooserPresentation,
  injectColumnPanelInsetTop,
} from '../column-chooser/column-chooser-presentation';
import { DatagridColumnList } from '../column-list/datagrid-column-list';
import { DatagridSearch } from '../search/datagrid-search';
import type { ColumnDef } from '../core/types/column.types';
import type { ToolbarRegionView } from './datagrid-toolbar.types';
const LOCATIONS: readonly ToolbarLocation[] = ['start', 'center', 'end'];

/**
 * The composable toolbar (§13).
 *
 * Draws resolved entries into three regions and collapses what does not fit
 * into an overflow surface. It holds no knowledge of the grid's own actions:
 * the grid turns a built-in name into a label, an icon and a command before
 * this component sees it, so a host item and a built-in one draw through the
 * same path.
 *
 * The bar is `role="group"`, not `role="toolbar"`. A toolbar widget owns a
 * roving tabindex over its controls, and this bar holds a text field and
 * arbitrary host renderers — content that pattern does not fit. A group has no
 * keyboard contract, so every control is an ordinary tab stop, which is what
 * §16.2 asks of every region except the body.
 */
@Component({
  selector: 'lib-datagrid-toolbar',
  templateUrl: './datagrid-toolbar.html',
  styleUrl: './datagrid-toolbar.scss',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    ContextMenu,
    PopoverTrigger,
    Spin,
    Tooltip,
    LucideDynamicIcon,
    LucideEllipsis,
    DatagridColumnChooser,
    DatagridColumnList,
    DatagridSearch,
    FloatingPanel,
    FloatingPanelContent,
  ],
  providers: [
    DATAGRID_TRANSLOCO_SCOPE,
    ColumnPanel,
    // One per bar, not one per application: two grids on a page are two
    // different widths.
    {
      provide: DATAGRID_TOOLBAR_HEADROOM,
      useFactory: () => signal(Number.POSITIVE_INFINITY),
    },
    // The views strip reads the same number under its own name.
    { provide: SAVED_VIEWS_HEADROOM, useExisting: DATAGRID_TOOLBAR_HEADROOM },
  ],
  host: { class: 'dg-toolbar-host' },
})
export class DatagridToolbar<TRow = unknown> {
  private readonly transloco = inject(TranslocoService);
  private readonly copy = injectUiCopy();

  /** Every entry, already ordered by the grid. */
  readonly entries = input<readonly ToolbarEntry[]>([]);

  /** Accessible name of the bar. */
  readonly ariaLabel = input('');

  /** Columns the built-in chooser lists. */
  readonly columns = input<readonly ColumnDef<TRow>[]>([]);

  /** Ids of the hidden columns, shared with the grid's own model. */
  readonly hiddenColumns = model<readonly string[]>([]);

  /** The grid's search term, shared with its own model. */
  readonly search = model<string | null>(null);

  /** The floating column panel, shared by every chooser this bar draws. */
  protected readonly columnPanel = inject(ColumnPanel);
  protected readonly chooserPresentation = injectColumnChooserPresentation(signal(null));
  protected readonly columnPanelInsetTop = injectColumnPanelInsetTop();

  /** The panel exists only while a chooser can open it. */
  protected readonly hostsColumnPanel = computed(
    () =>
      this.chooserPresentation() === 'panel' &&
      this.entries().some((entry) => entry.kind === 'columnChooser'),
  );

  private readonly barRef = viewChild.required<ElementRef<HTMLElement>>('bar');
  private readonly menuRef = viewChild<ContextMenu>('entryMenu');
  // `read: ElementRef` is not optional: a template reference on a component
  // element resolves to the component instance, and this one is measured.
  private readonly triggerRef = viewChild<unknown, ElementRef<HTMLElement>>('overflowTrigger', {
    read: ElementRef,
  });

  /** Items of the menu currently open, built at open time. */
  protected readonly menuItems = signal<readonly MenuItem[]>([]);

  /** Width the bar has for entries, from the one observer this bar owns. */
  private readonly available = signal(0);

  /** Ids collapsed into the overflow surface. */
  private readonly collapsedIds = signal<readonly string[]>([]);

  /** What is left for the elastic entries, published for them to read. */
  private readonly headroom = inject(DATAGRID_TOOLBAR_HEADROOM);

  /**
   * Outer width of each entry, measured while it was in the bar. A collapsed
   * entry has left the bar and cannot be measured there, so the cache is what
   * lets it come back when the bar widens.
   */
  private readonly widths = new Map<string, number>();

  private gap = 0;

  private readonly collapsedSet = computed(() => new Set(this.collapsedIds()));

  private readonly inlineEntries = computed(() => {
    const collapsed = this.collapsedSet();
    return this.entries().filter((entry) => !collapsed.has(entry.id));
  });

  /**
   * Entries in the overflow surface, which always carry their caption.
   *
   * Icon-only is a rule about a bar with no room for text; the surface is a
   * stacked list that has nothing but room, and an icon alone there gives a
   * column of unlabelled glyphs. It is also what keeps the buttons the right
   * shape: a surface item stretches to the panel width, and `libButton`'s
   * `aspect-ratio: 1` turns a stretched icon-only button into a square as tall
   * as the panel is wide.
   */
  protected readonly collapsed = computed(() => {
    const collapsed = this.collapsedSet();
    return this.entries()
      .filter((entry) => collapsed.has(entry.id))
      .map((entry) => ({
        ...entry,
        iconOnly: false,
        // A row in a list is read beside its neighbours, so an entry whose
        // caption is a whole sentence in the bar states the short form here.
        label: entry.shortLabel || entry.label,
        labelKey: entry.shortLabel ? '' : entry.shortLabelKey || entry.labelKey,
      }));
  });

  protected readonly regions = computed<readonly ToolbarRegionView[]>(() => {
    const inline = this.inlineEntries();
    return LOCATIONS.map((location) => ({
      location,
      entries: toolbarRegion(inline, location),
    }));
  });

  constructor() {
    // A panel left open while its chooser went away, or the viewport shrank, must not come back
    // on its own.
    effect(() => {
      if (!this.hostsColumnPanel()) {
        this.columnPanel.open.set(false);
      }
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const bar = this.barRef().nativeElement;
      this.available.set(Math.floor(bar.clientWidth));
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver((records) => {
        this.available.set(Math.floor(records[0]?.contentRect.width ?? 0));
      });
      observer.observe(bar);
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
    // Measure, then decide. The measurement is untracked: the widths live in a
    // plain map, so re-reading them cannot make this effect its own trigger.
    afterRenderEffect(() => {
      this.entries();
      this.available();
      untracked(() => {
        this.measure(this.barRef().nativeElement);
        this.applySplit();
      });
    });
  }

  /** Reads the width of every entry still in the bar, plus the gap it sits in. */
  private measure(bar: HTMLElement): void {
    const region = bar.querySelector('.dg-toolbar-region');
    if (region != null) {
      const columnGap = Number.parseFloat(getComputedStyle(region).columnGap);
      this.gap = Number.isFinite(columnGap) ? columnGap : 0;
    }
    for (const element of bar.querySelectorAll<HTMLElement>('[data-toolbar-item]')) {
      const id = element.dataset['toolbarItem'];
      if (id != null && element.offsetWidth > 0) {
        this.widths.set(id, element.offsetWidth + this.gap);
      }
    }
  }

  private applySplit(): void {
    const trigger = this.triggerRef()?.nativeElement.offsetWidth ?? 0;
    // Before the trigger exists its width is unknown, so the budget reserves a
    // square button of the bar's own height rather than nothing — which would
    // collapse one entry too few and overflow by exactly the trigger.
    const triggerWidth =
      (trigger > 0 ? trigger : this.barRef().nativeElement.clientHeight) + this.gap;
    const available = this.available();
    this.headroom.set(
      toolbarHeadroom({ entries: this.entries(), widths: this.widths, available, triggerWidth }),
    );
    const split = splitToolbarOverflow({
      entries: this.entries(),
      widths: this.widths,
      available,
      triggerWidth,
    });
    const current = this.collapsedIds();
    const changed =
      split.collapsed.length !== current.length ||
      split.collapsed.some((id, index) => id !== current[index]);
    if (changed) {
      this.collapsedIds.set(split.collapsed);
    }
  }

  /** A component entry's type, narrowed for `NgComponentOutlet`. */
  protected componentType(entry: ToolbarEntry): Type<unknown> | null {
    return (entry.component?.type as Type<unknown> | undefined) ?? null;
  }

  protected componentInputs(entry: ToolbarEntry): Readonly<Record<string, unknown>> {
    return entry.component?.inputs ?? {};
  }

  /** `'ghost'` is a text button in the accent-free severity, not a third colour. */
  protected severityOf(entry: ToolbarEntry): ButtonSeverity {
    return entry.variant === 'primary' ? 'primary' : 'secondary';
  }

  protected variantOf(entry: ToolbarEntry): ButtonVariant {
    if (entry.variant === 'primary') {
      return 'filled';
    }
    return entry.variant === 'ghost' ? 'text' : 'outlined';
  }

  /** The press travels with the command: an entry that opens an overlay
   * anchors it on the button that was pressed. */
  protected onCommand(entry: ToolbarEntry, event: MouseEvent): void {
    entry.command?.(event);
  }

  /**
   * Builds the menu at open time, which is what makes the imperative
   * translation safe: opening is a user action, and the lazy scope has long
   * since arrived by then.
   */
  protected openMenu(entry: ToolbarEntry, event: MouseEvent): void {
    this.menuItems.set(
      entry.items.map((item) => ({
        label:
          item.labelKey === ''
            ? item.label
            : this.transloco.translate(this.copy(item.labelKey), item.labelParams ?? undefined),
        icon: item.icon ?? undefined,
        disabled: item.disabled,
        // Marked, not disabled: a disabled row announces as unavailable and
        // drops out of the keyboard walk.
        ...(item.checked == null
          ? {}
          : { checked: item.checked, checkedRole: 'checkbox' as const }),
        command: item.command,
      })),
    );
    this.menuRef()?.showAt(event.currentTarget as HTMLElement, event, { focusFirstItem: true });
  }
}

import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideSearch } from '@lucide/angular';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { IconField, InputIcon, InputText } from '@ui/input-text';
import { Tree, TreeModel, TreeNode, TreeNodeTemplate } from '@ui/tree';
import { selectAllState } from '../core/selection-range';
import type { DatagridHeaderFilterEntry } from '../datagrid.types';

/**
 * The per-column value list (§7.2).
 *
 * Rendered inside a popover the grid opens; the panel itself knows nothing
 * about anchoring. Selection is held here and reported once, on apply — a
 * value list is a set the user assembles, and re-querying per checkbox would
 * make assembling one cost a request per click.
 */
@Component({
  selector: 'lib-datagrid-header-filter',
  templateUrl: './datagrid-header-filter.html',
  styleUrl: './datagrid-header-filter.scss',
  imports: [
    TranslocoPipe,
    UiCopyPipe,
    Button,
    Checkbox,
    IconField,
    InputIcon,
    InputText,
    LucideSearch,
    Tree,
    TreeNodeTemplate,
  ],
  // Its own surface, because `PopoverService` is headless — it positions and
  // dismisses, and the panel is the consumer's. `PopoverTrigger` would supply
  // one, but it needs a focusable trigger element, and a header cell may hold
  // no interactive control but itself.
  host: {
    role: 'dialog',
    tabindex: '-1',
    '[attr.aria-label]': 'dialogLabel()',
  },
})
export class DatagridHeaderFilter {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Caption of the column, for the panel's own heading. */
  readonly caption = input('');

  /**
   * Accessible name of the dialog. Supplied by the grid, which owns the
   * Transloco scope and resolves it in response to the opening — a user
   * action, so the scope has loaded.
   */
  readonly dialogLabel = input('');

  /** Current flat page or date-tree roots. */
  readonly entries = input<readonly DatagridHeaderFilterEntry[]>([]);

  /** Keys checked when the panel opened. */
  readonly selected = input<readonly string[]>([]);

  /** Entries shown before the list offers "show more". */
  /** Entries requested per flat-list page. */
  readonly pageSize = input(50);

  /** Whether another value-domain page exists. */
  readonly hasMore = input(false);

  /** True while the grid resolves the initial page or a search. */
  readonly loading = input(false);

  /** The source could expose only rows already loaded by the grid. */
  readonly partial = input(false);

  /** The date tree is a complete generated calendar without counts. */
  readonly generated = input(false);

  /** Offers "Select all". Off for a paged source, where "all" is not something it can tick. */
  readonly selectAll = input(true);

  /**
   * Narrows the entries by label as the search is typed. Off when the source searches: it
   * matches fields the label does not show, and folds case and accents.
   */
  readonly localSearch = input(true);

  /** Checked keys committed by the Apply action. */
  readonly applied = output<readonly string[]>();

  /** Requests that the owning overlay close without applying. */
  readonly canceled = output();

  /** Requests a fresh search or the next page from the grid. */
  readonly loadRequested = output<{ search: string; skip: number }>();

  protected readonly search = signal('');

  private readonly checked = signal<ReadonlySet<string>>(new Set());
  protected readonly treeChecked = signal<readonly string[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // The panel opens under the pointer or from the column menu, so focus has
    // to travel into it either way; the search field is where a user looking
    // for one value among many starts.
    afterNextRender(() => {
      this.hostRef.nativeElement.querySelector<HTMLElement>('input')?.focus();
    });
    // The panel is created fresh on every opening, so seeding from the inputs
    // is the whole of its lifecycle. Written untracked: the writes are the
    // effect's own output, not a dependency of it.
    effect(() => {
      const keys = this.selected();
      untracked(() => {
        this.checked.update((current) => new Set([...current, ...keys]));
        this.treeChecked.update((current) => [...new Set([...current, ...keys])]);
      });
    });
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer != null) {
        clearTimeout(this.searchTimer);
      }
    });
  }

  protected readonly matching = computed<readonly DatagridHeaderFilterEntry[]>(() => {
    const needle = this.search().trim().toLocaleLowerCase();
    const entries = this.flatMode() ? this.entries() : [];
    if (needle === '' || !this.localSearch()) {
      return entries;
    }
    return entries.filter((entry) => entry.label.toLocaleLowerCase().includes(needle));
  });

  protected readonly visible = computed(() => this.matching());

  protected readonly flatMode = computed(
    () => !this.entries().some((entry) => entry.children != null),
  );

  protected readonly treeModel = computed(() => {
    const needle = this.search().trim().toLocaleLowerCase();
    const entries = this.entries()
      .map((entry) => filterTreeEntry(entry, needle))
      .filter((entry): entry is DatagridHeaderFilterEntry => entry != null);
    // Tree construction initializes its own signals. Leave this computed's
    // reactive consumer before creating the model.
    return untracked(() => new TreeModel(entries.map(toTreeNode)));
  });

  protected readonly empty = computed(() =>
    this.flatMode() ? this.matching().length === 0 : this.treeModel().size() === 0,
  );

  /**
   * Tri-state over the entries the search left visible, so "select all" says
   * what it will actually do rather than reporting a set the user cannot see.
   */
  protected readonly allState = computed(() =>
    selectAllState(
      this.matching().map((entry) => entry.key),
      (key) => this.checked().has(String(key)),
    ),
  );

  protected isChecked(key: string): boolean {
    return this.checked().has(key);
  }

  protected onToggle(key: string, value: boolean): void {
    const next = new Set(this.checked());
    if (value) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.checked.set(next);
  }

  protected onToggleAll(value: boolean): void {
    const next = new Set(this.checked());
    for (const entry of this.matching()) {
      if (value) {
        next.add(entry.key);
      } else {
        next.delete(entry.key);
      }
    }
    this.checked.set(next);
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    if (!this.flatMode()) {
      return;
    }
    if (this.searchTimer != null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.loadRequested.emit({ search: value, skip: 0 });
    }, 250);
  }

  protected onShowMore(): void {
    this.loadRequested.emit({ search: this.search(), skip: this.entries().length });
  }

  protected onApply(): void {
    this.applied.emit(this.flatMode() ? [...this.checked()] : this.treeChecked());
  }

  protected onCancel(): void {
    this.canceled.emit();
  }
}

function toTreeNode(entry: DatagridHeaderFilterEntry): TreeNode<DatagridHeaderFilterEntry> {
  return new TreeNode({
    key: entry.key,
    data: entry,
    label: entry.label,
    expanded: false,
    children: entry.children?.map(toTreeNode) ?? [],
  });
}

function filterTreeEntry(
  entry: DatagridHeaderFilterEntry,
  needle: string,
): DatagridHeaderFilterEntry | null {
  if (needle === '') {
    return entry;
  }
  const children = entry.children
    ?.map((child) => filterTreeEntry(child, needle))
    .filter((child): child is DatagridHeaderFilterEntry => child != null);
  if (entry.label.toLocaleLowerCase().includes(needle) || (children?.length ?? 0) > 0) {
    return { ...entry, children };
  }
  return null;
}

import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  ElementRef,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Tree as AriaTree, TreeItem, TreeItemGroup } from '@angular/aria/tree';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideCheck, LucideChevronRight, LucideLoaderCircle, LucideMinus } from '@lucide/angular';
import type { DataInput, KeySpec } from '@ui/data-source';
import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import { sanitizeTreeSelection, toggleTreeSubtree, treeSelectionState } from './tree-selection';
import { TreeNodeSource } from './tree-source';
import type { TreeLoadFailure, TreeParentSelector, TreeResolutionFailure } from './tree-source';
import { TreeEmptyTemplate, TreeNodeTemplate } from './tree-templates';
import { TREE_TRANSLOCO_SCOPE } from './tree.i18n';
import type {
  TreeFocusMode,
  TreeKey,
  TreeNodeContextMenuEvent,
  TreeNodeEvent,
  TreeNodeTemplateContext,
  TreeOrientation,
  TreeReadonlyIndicator,
  TreeSelectionBehavior,
  TreeSelectionMode,
  TreeSelectionState,
  TreeSize,
} from './tree.types';

let nextTreeId = 0;

/**
 * Accessible, signal-backed tree control built on `@angular/aria/tree`.
 * The supplied `TreeModel` owns structure and expansion; `value` owns selection.
 */
@Component({
  selector: 'lib-tree',
  templateUrl: './tree.html',
  styleUrl: './tree.scss',
  imports: [
    NgTemplateOutlet,
    AriaTree,
    TreeItem,
    TreeItemGroup,
    TranslocoPipe,
    UiCopyPipe,
    LucideCheck,
    LucideChevronRight,
    LucideLoaderCircle,
    LucideMinus,
  ],
  providers: [TREE_TRANSLOCO_SCOPE],
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-selection-mode]': 'selectionMode()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-guides]': 'showGuides() ? "" : null',
    '[attr.data-loading]': 'busy() ? "" : null',
    '[attr.data-unresolved]': 'unresolvedKeys().length ? "" : null',
  },
})
export class Tree<T, K extends TreeKey = string> implements FormValueControl<readonly K[]> {
  /** Signal-backed structural model. Wins over `source` when both are bound. */
  readonly tree = input<TreeModel<T, K> | undefined>(undefined);

  /**
   * Transport-neutral source of nodes, read while `tree` is unbound. A source
   * that implements `loadChildren` is read one level at a time, as branches
   * expand. A source with only `load`, and a plain array, are read once and
   * nested through `parentKey`.
   */
  readonly source = input<DataInput<T> | undefined>(undefined);

  /** Item identity. Required as soon as `source` is bound. */
  readonly key = input<KeySpec<T> | undefined>(undefined);

  /** Row text for a source item. Falls back to `String(item)`. */
  readonly displayWith = input<((item: T) => string) | undefined>(undefined);

  /**
   * Whether a source item is a branch. A lazy source without it treats every row
   * as expandable until an empty level proves it a leaf.
   */
  readonly hasChildren = input<((item: T) => boolean) | undefined>(undefined);

  /** Parent identity of a flat source item: a field path, or a function. */
  readonly parentKey = input<TreeParentSelector<T> | undefined>(undefined);

  /** Per-item disabled rule for a source item. */
  readonly nodeDisabled = input<((item: T) => boolean) | undefined>(undefined);

  /** Selected node keys in tree order. */
  readonly value = model<readonly K[]>([]);

  /** Single, additive multiple, or cascading checkbox selection. */
  readonly selectionMode = input<TreeSelectionMode>('single');

  /** Control density. */
  readonly size = input<TreeSize>('md');

  /** Shows hierarchy guide lines. */
  readonly showGuides = input(false, { transform: booleanAttribute });

  /** Disables navigation, expansion, and selection. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Keeps navigation and expansion available while withholding selection edits. */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** Visual used for readonly checkbox trees. */
  readonly readonlyIndicator = input<TreeReadonlyIndicator>('status');

  /** Invalid styling and `aria-invalid` state. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Signal Forms touched state. */
  readonly touched = input(false, { transform: booleanAttribute });

  /** Exposed as `aria-required`; validation remains application-owned. */
  readonly required = input(false, { transform: booleanAttribute });

  /** Signal Forms validation errors. The tree intentionally renders no error copy. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Optional DOM id for the inner element carrying `role="tree"`. */
  readonly inputId = input('');

  /** Accessible name. Falls back to the translated tree label. */
  readonly ariaLabel = input('');

  /** Ids of elements that label the tree; takes precedence over `ariaLabel`. */
  readonly ariaLabelledby = input('');

  /** Ids of consumer-supplied hints or errors. */
  readonly ariaDescribedby = input('');

  /** Empty-state copy. Falls back to the translated message. */
  readonly emptyMessage = input('');

  /** Root-load error copy. Falls back to the translated message. */
  readonly loadErrorMessage = input('');

  /** Child-level error copy. Falls back to the translated message. */
  readonly childrenErrorMessage = input('');

  /** Copy for selected keys the source cannot display. Falls back to the translation. */
  readonly unavailableMessage = input('');

  /** Angular Aria focus strategy. */
  readonly focusMode = input<TreeFocusMode>('roving');

  /** Angular Aria selection strategy. Readonly always behaves explicitly. */
  readonly selectionBehavior = input<TreeSelectionBehavior>('explicit');

  /** Angular Aria orientation. */
  readonly orientation = input<TreeOrientation>('vertical');

  /** Whether arrow-key navigation wraps at either end. */
  readonly wrap = input(false, { transform: booleanAttribute });

  /** Whether disabled items remain reachable by keyboard navigation. */
  readonly softDisabled = input(true, { transform: booleanAttribute });

  /** Typeahead reset delay in milliseconds. */
  readonly typeaheadDelay = input(500, { transform: numberAttribute });

  /** Marks the Signal Forms field touched once focus leaves the composite. */
  readonly touch = output();

  /** Emitted for pointer, Enter, and Space activation. */
  readonly nodeActivated = output<TreeNodeEvent<T, K>>();

  /** Emitted after a node expands through this control or its public API. */
  readonly nodeExpanded = output<TreeNodeEvent<T, K>>();

  /** Emitted after a node collapses through this control or its public API. */
  readonly nodeCollapsed = output<TreeNodeEvent<T, K>>();

  /** Native context-menu signal; default browser behavior is not suppressed. */
  readonly nodeContextMenu = output<TreeNodeContextMenuEvent<T, K>>();

  /** Selected keys the source kept but could not turn into visible rows. */
  readonly resolutionFailed = output<TreeResolutionFailure<K>>();

  /** A level the source refused to load. `parent` is `null` for the root level. */
  readonly loadFailed = output<TreeLoadFailure<T, K>>();

  readonly nodeTemplate = contentChild<TreeNodeTemplate<T, K>>(TreeNodeTemplate);
  readonly emptyTemplate = contentChild(TreeEmptyTemplate);

  readonly generatedTreeId = `lib-tree-${nextTreeId++}`;
  readonly fallbackLabelId = `${this.generatedTreeId}-label`;
  readonly unresolvedNoteId = `${this.generatedTreeId}-unavailable`;

  /** The source, once it is the one in charge. `tree` wins when both are bound. */
  private readonly boundSource = computed(() => (this.tree() ? undefined : this.source()));

  private readonly loader = new TreeNodeSource<T, K>({
    source: () => this.boundSource(),
    key: () => this.key(),
    displayWith: () => this.displayWith(),
    hasChildren: () => this.hasChildren(),
    parentKey: () => this.parentKey(),
    nodeDisabled: () => this.nodeDisabled(),
    keys: () => this.value(),
    onFailure: (failure) => {
      this.resolutionFailed.emit(failure);
    },
    onLoadError: (failure) => {
      this.loadFailed.emit(failure);
    },
  });

  /** The rendered model: the bound `tree`, or the one the source builds. */
  readonly treeModel = computed(() => this.tree() ?? this.loader.model());

  readonly selectedSet = computed(() => new Set(this.value()));

  readonly ariaValue = computed<K[]>(() => {
    const values = sanitizeTreeSelection(this.treeModel(), this.value());
    return this.selectionMode() === 'single' ? values.slice(0, 1) : [...values];
  });

  /** A root load or a selected-key lookup is in flight. */
  protected readonly busy = computed(() => this.loader.loading() || this.loader.resolving());

  /** The root level is loading and has nothing to show yet. */
  protected readonly rootLoading = computed(() => this.loader.loading());

  /** The root level rejected. */
  protected readonly rootLoadFailed = computed(() => this.loader.error() !== null);

  /**
   * Selected keys with no row to display. Keyed off the reported failure, not
   * off the missing node, so a lookup still in flight does not flash the note.
   */
  protected readonly unresolvedKeys = computed<readonly K[]>(() => {
    const failure = this.loader.failure();
    if (failure === null) {
      return [];
    }
    const model = this.treeModel();
    const selected = this.selectedSet();
    return failure.keys.filter((key) => selected.has(key) && !model.has(key));
  });

  readonly effectiveSelectionBehavior = computed<TreeSelectionBehavior>(() =>
    this.readonly() ? 'explicit' : this.selectionBehavior(),
  );

  readonly safeTypeaheadDelay = computed(() => {
    const delay = this.typeaheadDelay();
    return Number.isFinite(delay) && delay >= 0 ? delay : 500;
  });

  readonly effectiveAriaLabel = computed(() =>
    this.ariaLabelledby() ? null : this.ariaLabel() || null,
  );

  readonly effectiveAriaLabelledby = computed(
    () => this.ariaLabelledby() || (this.ariaLabel() ? null : this.fallbackLabelId),
  );

  /** Consumer description ids plus the note the control renders itself. */
  readonly effectiveAriaDescribedby = computed(() => {
    const ids = this.ariaDescribedby() ? [this.ariaDescribedby()] : [];
    if (this.unresolvedKeys().length > 0) {
      ids.push(this.unresolvedNoteId);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  });

  private readonly treeRoot = viewChild<ElementRef<HTMLElement>>('treeRoot');
  private readonly ariaTree = viewChild<AriaTree<K>>(AriaTree);
  protected readonly pointerMotionKeys = signal<ReadonlySet<K>>(new Set());
  protected readonly disclosureMotionKeys = signal<ReadonlySet<K>>(new Set());

  constructor() {
    // The pattern owns `aria-selected`, but checkbox trees use ARIA's alternative
    // `aria-checked` contract — re-state it after the headless host bindings have run.
    afterRenderEffect({
      mixedReadWrite: () => {
        const checkbox = this.selectionMode() === 'checkbox';
        this.value();
        for (const node of this.treeModel().traverse()) {
          node.expanded();
        }
        if (!checkbox) {
          return;
        }
        this.treeRoot()
          ?.nativeElement.querySelectorAll('[role="treeitem"]')
          .forEach((item) => {
            item.removeAttribute('aria-selected');
          });
      },
    });
  }

  /** Whether the level below a node is in flight. */
  protected isLoadingChildren(node: TreeNode<T, K>): boolean {
    return this.loader.isLoadingChildren(node.key);
  }

  /** Whether the last load of the level below a node rejected. */
  protected hasChildrenError(node: TreeNode<T, K>): boolean {
    return this.loader.hasChildrenError(node.key);
  }

  /** Whether a row can be selected by Angular Aria. */
  itemSelectable(node: TreeNode<T, K>): boolean {
    return node.selectable();
  }

  /** Whether a key is present in the externally controlled value. */
  isSelected(node: TreeNode<T, K>): boolean {
    return this.selectedSet().has(node.key);
  }

  /** Checkbox state for the node and its eligible descendants. */
  selectionState(node: TreeNode<T, K>): TreeSelectionState {
    return treeSelectionState(node, this.selectedSet());
  }

  isPartiallySelected(node: TreeNode<T, K>): boolean {
    return this.selectionMode() === 'checkbox' && this.selectionState(node) === 'partial';
  }

  ariaChecked(node: TreeNode<T, K>): 'true' | 'mixed' | 'false' {
    const state = this.selectionState(node);
    return state === 'selected' ? 'true' : state === 'partial' ? 'mixed' : 'false';
  }

  nodeContext(node: TreeNode<T, K>, active: boolean, level: number): TreeNodeTemplateContext<T, K> {
    const state = this.selectionState(node);
    return {
      $implicit: node,
      node,
      selected: this.isSelected(node),
      partiallySelected: this.selectionMode() === 'checkbox' && state === 'partial',
      selectionState: state,
      expanded: node.expanded(),
      active,
      level,
      disabled: this.disabled() || node.disabled(),
      readonly: this.readonly(),
    };
  }

  onAriaValueChange(values: readonly K[]): void {
    if (this.disabled() || this.readonly()) {
      // Reset the pattern's internal model after a readonly activation; a fresh array is
      // what guarantees the input is written back.
      this.value.set([...this.value()]);
      return;
    }

    const model = this.treeModel();
    const retained = this.retainedKeys(model);
    if (this.selectionMode() !== 'checkbox') {
      const sanitized = sanitizeTreeSelection(model, values);
      this.value.set(
        this.selectionMode() === 'single' ? sanitized.slice(0, 1) : [...sanitized, ...retained],
      );
      return;
    }

    const previous = new Set(sanitizeTreeSelection(model, this.value()));
    const next = new Set(sanitizeTreeSelection(model, values));
    const added = Array.from(next).find((key) => !previous.has(key));
    const removed = Array.from(previous).find((key) => !next.has(key));
    const changedKey = added ?? removed;
    const changedNode = changedKey === undefined ? undefined : model.get(changedKey);
    if (changedNode === undefined) {
      this.value.set([...next, ...retained]);
      return;
    }

    this.value.set([
      ...toggleTreeSubtree(model, this.value(), changedNode, added !== undefined),
      ...retained,
    ]);
  }

  /**
   * Selected keys the model does not hold while a source is bound. Angular Aria
   * models only the rendered rows, so a key inside a level that has not loaded
   * has to be carried across a user edit or the form silently loses it. A
   * host-supplied model has no unloaded levels, so an unknown key there stays
   * what it has always been: dropped.
   */
  private retainedKeys(model: TreeModel<T, K>): readonly K[] {
    if (this.tree() !== undefined || this.selectionMode() === 'single') {
      return [];
    }
    return this.value().filter((key) => !model.has(key));
  }

  onExpandedChange(node: TreeNode<T, K>, expanded: boolean): void {
    if (this.disabled() || node.disabled() || node.expanded() === expanded) {
      return;
    }
    this.clearMotion();
    if (
      expanded &&
      !this.awaitChildren(node, () => {
        node.expanded.set(true);
        this.nodeExpanded.emit({ node });
      })
    ) {
      return;
    }
    node.expanded.set(expanded);
    (expanded ? this.nodeExpanded : this.nodeCollapsed).emit({ node });
  }

  onNodeExpansionClick(node: TreeNode<T, K>, ariaItem: TreeItem<K>, event: MouseEvent): void {
    if (this.disabled()) {
      return;
    }
    this.focusAriaItem(ariaItem);
    if (node.disabled()) {
      return;
    }
    this.nodeActivated.emit({ node, originalEvent: event });
    if (node.leaf()) {
      return;
    }
    const expanded = !node.expanded();
    if (
      expanded &&
      !this.awaitChildren(node, () => {
        this.startPointerMotion(node, true);
        node.expanded.set(true);
        this.nodeExpanded.emit({ node, originalEvent: event });
      })
    ) {
      return;
    }
    this.startPointerMotion(node, expanded);
    node.expanded.set(expanded);
    (expanded ? this.nodeExpanded : this.nodeCollapsed).emit({ node, originalEvent: event });
  }

  onNodeSelectionClick(node: TreeNode<T, K>, ariaItem: TreeItem<K>, event: MouseEvent): void {
    if (this.disabled()) {
      return;
    }
    this.focusAriaItem(ariaItem);
    if (node.disabled()) {
      return;
    }
    this.nodeActivated.emit({ node, originalEvent: event });
    if (this.readonly() || !node.selectable()) {
      return;
    }
    const behavior = this.ariaTree()?._pattern.treeBehavior;
    if (!behavior) {
      return;
    }
    behavior.goto(
      ariaItem._pattern,
      this.selectionMode() === 'single' ? { selectOne: true } : { toggle: true },
    );
  }

  onNodeClick(node: TreeNode<T, K>, ariaItem: TreeItem<K>, event: MouseEvent): void {
    if (!this.isDirectItemEvent(event)) {
      return;
    }
    event.stopPropagation();
    // A leaf has no disclosure competing for the row, so all of it selects.
    // Splitting it there leaves most of the row dead: the text is a fraction of
    // the width, and every click beside it would do nothing at all.
    if (this.isSelectionHit(event) || node.leaf()) {
      this.onNodeSelectionClick(node, ariaItem, event);
    } else {
      this.onNodeExpansionClick(node, ariaItem, event);
    }
  }

  onNodeKeydown(node: TreeNode<T, K>, event: KeyboardEvent): void {
    this.clearMotion();
    if (
      !this.isDirectItemEvent(event) ||
      this.disabled() ||
      node.disabled() ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return;
    }
    this.nodeActivated.emit({ node, originalEvent: event });
  }

  onNodeContextMenu(node: TreeNode<T, K>, event: MouseEvent): void {
    if (!this.isDirectItemEvent(event)) {
      return;
    }
    this.nodeContextMenu.emit({ node, originalEvent: event });
  }

  onFocusout(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!(event.currentTarget as HTMLElement).contains(next)) {
      this.touch.emit();
    }
  }

  /** Focuses the current roving item, or the tree in activedescendant mode. */
  focus(options?: FocusOptions): void {
    const root = this.treeRoot()?.nativeElement;
    if (!root) {
      return;
    }
    const target =
      this.focusMode() === 'roving'
        ? (root.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]') ?? root)
        : root;
    target.focus(options);
  }

  /** Delegates scrolling of the active item to Angular Aria. */
  scrollActiveItemIntoView(options?: ScrollIntoViewOptions): void {
    this.ariaTree()?.scrollActiveItemIntoView(options);
  }

  /**
   * Expands every loaded branch and emits one event for each changed node. A
   * branch whose level has still to load is skipped rather than fetched, so one
   * call cannot turn into a request per branch.
   */
  expandAll(): void {
    this.clearMotion();
    for (const node of this.treeModel().traverse()) {
      if (!node.leaf() && !node.expanded() && !this.loader.needsChildren(node)) {
        node.expanded.set(true);
        this.nodeExpanded.emit({ node });
      }
    }
  }

  /** Collapses every branch and emits one event for each changed node. */
  collapseAll(): void {
    this.clearMotion();
    for (const node of this.treeModel().traverse()) {
      if (!node.leaf() && node.expanded()) {
        node.expanded.set(false);
        this.nodeCollapsed.emit({ node });
      }
    }
  }

  /** Toggles one branch by node or key. Leaves are a no-op. */
  toggle(target: TreeNode<T, K> | K): void {
    this.clearMotion();
    const node = target instanceof TreeNode ? target : this.treeModel().get(target);
    if (node === undefined || node.leaf()) {
      return;
    }
    const expanded = !node.expanded();
    if (
      expanded &&
      !this.awaitChildren(node, () => {
        node.expanded.set(true);
        this.nodeExpanded.emit({ node });
      })
    ) {
      return;
    }
    node.expanded.set(expanded);
    (expanded ? this.nodeExpanded : this.nodeCollapsed).emit({ node });
  }

  /** Re-runs the root source load. A no-op while `tree` is bound. */
  reload(): void {
    this.loader.reload();
  }

  /**
   * Whether the level below a node is available now. A lazy level starts loading
   * instead, and runs `whenReady` once it arrives, so a row awaits its own
   * expansion rather than opening onto nothing.
   */
  private awaitChildren(node: TreeNode<T, K>, whenReady: () => void): boolean {
    const ready = this.loader.ensureChildren(node);
    if (ready === true) {
      return true;
    }
    void ready.then((loaded) => {
      if (loaded && !node.expanded()) {
        whenReady();
      }
    });
    return false;
  }

  protected hasPointerMotion(node: TreeNode<T, K>): boolean {
    return this.pointerMotionKeys().has(node.key);
  }

  protected hasDisclosureMotion(node: TreeNode<T, K>): boolean {
    return this.disclosureMotionKeys().has(node.key);
  }

  protected onChevronTransitionEnd(node: TreeNode<T, K>, event: TransitionEvent): void {
    if (event.propertyName !== 'transform') {
      return;
    }
    this.finishPointerMotion(node.key);
  }

  private startPointerMotion(node: TreeNode<T, K>, expanded: boolean): void {
    this.pointerMotionKeys.update((keys) => new Set(keys).add(node.key));
    if (expanded && this.visibleDescendantCount(node) <= 20) {
      this.disclosureMotionKeys.update((keys) => new Set(keys).add(node.key));
    } else {
      this.disclosureMotionKeys.update((keys) => this.withoutKey(keys, node.key));
    }
  }

  private focusAriaItem(ariaItem: TreeItem<K>): void {
    // The pattern's root click couples focus, selection and expansion. Use the exposed
    // operation to keep its focus management while routing the other two ourselves.
    this.ariaTree()?._pattern.treeBehavior.goto(ariaItem._pattern);
  }

  private finishPointerMotion(key: K): void {
    this.pointerMotionKeys.update((keys) => this.withoutKey(keys, key));
    this.disclosureMotionKeys.update((keys) => this.withoutKey(keys, key));
  }

  private clearMotion(): void {
    if (this.pointerMotionKeys().size > 0) {
      this.pointerMotionKeys.set(new Set());
    }
    if (this.disclosureMotionKeys().size > 0) {
      this.disclosureMotionKeys.set(new Set());
    }
  }

  private withoutKey(keys: ReadonlySet<K>, key: K): ReadonlySet<K> {
    if (!keys.has(key)) {
      return keys;
    }
    const next = new Set(keys);
    next.delete(key);
    return next;
  }

  private visibleDescendantCount(node: TreeNode<T, K>, limit = 20): number {
    let count = 0;
    for (const child of node.children()) {
      count += 1;
      if (count > limit) {
        return count;
      }
      if (child.expanded()) {
        count += this.visibleDescendantCount(child, limit - count);
        if (count > limit) {
          return count;
        }
      }
    }
    return count;
  }

  private isDirectItemEvent(event: Event): boolean {
    const target = event.target;
    return target instanceof Element && target.closest('[role="treeitem"]') === event.currentTarget;
  }

  private isSelectionHit(event: Event): boolean {
    const target = event.target;
    if (!(target instanceof Element)) {
      return false;
    }
    const hit = target.closest('[data-tree-selection-hit]');
    return hit !== null && hit.closest('[role="treeitem"]') === event.currentTarget;
  }
}

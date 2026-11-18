import type { TreeNode } from './tree-node';

/** Keys supported by the tree model. */
export type TreeKey = string | number;

/** Supported traversal strategies. */
export type TreeTraversalOrder = 'preorder' | 'postorder' | 'breadth-first';

/** Selection behavior exposed by the rendered tree control. */
export type TreeSelectionMode = 'single' | 'multiple' | 'checkbox';

/** Presentation used for a non-editable checkbox tree. */
export type TreeReadonlyIndicator = 'status' | 'checkbox';

/** Density presets shared with the rest of the form-control library. */
export type TreeSize = 'sm' | 'md' | 'lg';

/** Angular Aria focus strategies. */
export type TreeFocusMode = 'roving' | 'activedescendant';

/** Angular Aria selection strategies. */
export type TreeSelectionBehavior = 'explicit' | 'follow';

/** Angular Aria tree orientations. */
export type TreeOrientation = 'vertical' | 'horizontal';

/** Three-state selection exposed to node templates. */
export type TreeSelectionState = 'selected' | 'partial' | 'unselected';

/** Payload emitted when a tree node is activated or its expansion changes. */
export interface TreeNodeEvent<T, K extends TreeKey = string> {
  node: TreeNode<T, K>;
  originalEvent?: Event;
}

/** Payload emitted for a node's native context-menu event. */
export interface TreeNodeContextMenuEvent<T, K extends TreeKey = string> {
  node: TreeNode<T, K>;
  originalEvent: MouseEvent;
}

/** Context provided by `libTreeNode` templates. */
export interface TreeNodeTemplateContext<T, K extends TreeKey = string> {
  $implicit: TreeNode<T, K>;
  node: TreeNode<T, K>;
  selected: boolean;
  partiallySelected: boolean;
  selectionState: TreeSelectionState;
  expanded: boolean;
  active: boolean;
  level: number;
  disabled: boolean;
  readonly: boolean;
}

/** Stable codes for structural invariant failures. */
export type TreeInvariantErrorCode =
  | 'already-attached'
  | 'cross-tree'
  | 'cycle'
  | 'duplicate-key'
  | 'invalid-parent'
  | 'invalid-snapshot';

/** Options used to construct a tree node. */
export interface TreeNodeOptions<T, K extends TreeKey = string> {
  /** Stable identity used by Angular Aria and `@for` tracking. */
  key: K;
  /** Application-owned value carried by the node. */
  data: T;
  /** Optional text used for display and typeahead. */
  label?: string;
  /** Whether the node starts expanded. */
  expanded?: boolean;
  /** Whether interaction with the node starts disabled. */
  disabled?: boolean;
  /** Whether the node can participate in selection. */
  selectable?: boolean;
  /** Whether the node is a branch whose children are not loaded. */
  expandable?: boolean;
  /** Detached child subtrees to attach during construction. */
  children?: readonly TreeNode<T, K>[];
}

/** Options for cloning a node or model. */
export interface TreeCloneOptions<T, K extends TreeKey = string> {
  /** Creates a new key for every cloned node. */
  key: (node: TreeNode<T, K>) => K;
  /** Optionally clones application data instead of retaining its reference. */
  data?: (data: T, node: TreeNode<T, K>) => T;
  /** Whether to preserve expanded, disabled, and selectable state. Defaults to true. */
  includeUiState?: boolean;
}

/** Options for serializing a tree. */
export interface TreeSerializeOptions {
  /** Whether to include expanded, disabled, and selectable state. Defaults to true. */
  includeUiState?: boolean;
}

/** Options for sorting child collections. */
export interface TreeSortOptions {
  /** Whether to sort every descendant collection too. */
  recursive?: boolean;
}

/** Serializable representation of a node and its descendants. */
export interface TreeNodeSnapshot<T, K extends TreeKey = string> {
  key: K;
  data: T;
  label?: string;
  expanded?: boolean;
  disabled?: boolean;
  selectable?: boolean;
  expandable?: boolean;
  children: readonly TreeNodeSnapshot<T, K>[];
}

/** Serializable representation of an Angular-Aria-style invisible tree root. */
export interface TreeModelSnapshot<T, K extends TreeKey = string> {
  children: readonly TreeNodeSnapshot<T, K>[];
}

/** Error raised when an operation would produce an invalid tree. */
export class TreeInvariantError extends Error {
  constructor(
    readonly code: TreeInvariantErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TreeInvariantError';
  }
}

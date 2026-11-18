/**
 * Marks the overlay panes belonging to one menu — the root pane plus
 * every submenu pane below it. Submenus render in detached sibling
 * panes, so DOM containment alone cannot tell "my submenu" from "some
 * other menu that happens to be open"; the shared id can.
 */
export const MENU_TREE_ATTRIBUTE = 'data-menu-tree';

let nextMenuTreeId = 0;

/** Mints an id for a new menu tree. */
export function createMenuTreeId(): string {
  return `lib-menu-tree-${nextMenuTreeId++}`;
}

/**
 * Stamps `pane` with the tree that `node` already belongs to, so a
 * submenu pane inherits its parent's identity. No-op when the node is
 * not (yet) inside a stamped pane.
 */
export function inheritMenuTree(node: Element, pane: HTMLElement): void {
  const treeId = node.closest(`[${MENU_TREE_ATTRIBUTE}]`)?.getAttribute(MENU_TREE_ATTRIBUTE);
  if (treeId) {
    pane.setAttribute(MENU_TREE_ATTRIBUTE, treeId);
  }
}

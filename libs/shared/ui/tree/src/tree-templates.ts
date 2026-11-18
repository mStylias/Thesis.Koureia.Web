import { Directive, inject, TemplateRef } from '@angular/core';
import type { TreeKey, TreeNodeTemplateContext } from './tree.types';

/** Custom renderer for a tree row's content. */
@Directive({
  selector: 'ng-template[libTreeNode]',
})
export class TreeNodeTemplate<T, K extends TreeKey = string> {
  readonly template = inject<TemplateRef<TreeNodeTemplateContext<T, K>>>(TemplateRef);

  static ngTemplateContextGuard<T, K extends TreeKey>(
    _directive: TreeNodeTemplate<T, K>,
    _context: unknown,
  ): _context is TreeNodeTemplateContext<T, K> {
    return true;
  }
}

/** Custom renderer used when the model has no visible roots. */
@Directive({
  selector: 'ng-template[libTreeEmpty]',
})
export class TreeEmptyTemplate {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

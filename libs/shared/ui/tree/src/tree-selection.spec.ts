import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import { sanitizeTreeSelection, toggleTreeSubtree, treeSelectionState } from './tree-selection';

function fixtureTree(): {
  model: TreeModel<string>;
  root: TreeNode<string>;
  branch: TreeNode<string>;
} {
  const branch = new TreeNode({
    key: 'branch',
    data: 'branch',
    children: [
      new TreeNode({ key: 'one', data: 'one' }),
      new TreeNode({ key: 'disabled', data: 'disabled', disabled: true }),
      new TreeNode({ key: 'two', data: 'two' }),
    ],
  });
  const root = new TreeNode({ key: 'root', data: 'root', children: [branch] });
  return { model: new TreeModel([root]), root, branch };
}

describe('tree checkbox selection', () => {
  it('selects an eligible subtree and derives selected ancestors', () => {
    const { model, root, branch } = fixtureTree();

    expect(toggleTreeSubtree(model, [], branch, true)).toEqual(['root', 'branch', 'one', 'two']);
    expect(treeSelectionState(root, new Set(['root', 'branch', 'one', 'two']))).toBe('selected');
  });

  it('leaves disabled values out of selection and ignores them for parent state', () => {
    const { model, branch } = fixtureTree();

    expect(toggleTreeSubtree(model, ['disabled'], branch, true)).toEqual([
      'root',
      'branch',
      'one',
      'two',
    ]);
  });

  it('removes ancestor keys when a descendant becomes unselected', () => {
    const { model, branch } = fixtureTree();
    const one = model.get('one');
    if (!one) {
      throw new Error('missing fixture node');
    }

    expect(toggleTreeSubtree(model, ['root', 'branch', 'one', 'two'], one, false)).toEqual(['two']);
    expect(treeSelectionState(branch, new Set(['two']))).toBe('partial');
  });

  it('sanitizes unknown, disabled, duplicate, and non-selectable keys in tree order', () => {
    const { model } = fixtureTree();
    model.get('two')?.selectable.set(false);

    expect(sanitizeTreeSelection(model, ['two', 'one', 'missing', 'one', 'disabled'])).toEqual([
      'one',
    ]);
  });
});

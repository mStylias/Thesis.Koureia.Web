import { and, not, or, where } from './filter-node';
import {
  builderCondition,
  builderConditionCount,
  builderGroup,
  builderTreeFromNode,
  builderTreeToNode,
  defaultBuilderCondition,
  insertBuilderItem,
  removeBuilderItem,
  updateBuilderItem,
} from './filter-builder-model';
import type { BuilderConditionItem, BuilderGroupItem } from './filter-builder-model.types';
import type { FilterNode } from '../types/filter.types';

/** The tree a node produces, read straight back out. */
function roundTrip(node: FilterNode | null): FilterNode | null {
  return builderTreeToNode(builderTreeFromNode(node));
}

function firstChild(root: BuilderGroupItem): BuilderConditionItem {
  const child = root.children.at(0);
  if (child?.kind !== 'condition') {
    throw new Error('first child is not a condition');
  }
  return child;
}

describe('builderTreeFromNode', () => {
  it('starts an absent filter on an empty and-group', () => {
    const root = builderTreeFromNode(null);
    expect(root.op).toBe('and');
    expect(root.negated).toBe(false);
    expect(root.children).toEqual([]);
  });

  it('wraps a bare condition in a group, so a second one can be added', () => {
    const root = builderTreeFromNode(where('name', 'contains', 'a'));
    expect(root.op).toBe('and');
    expect(builderConditionCount(root)).toBe(1);
    expect(firstChild(root).field).toBe('name');
  });

  it('reads a not over a group as that group negated', () => {
    const disjunction: FilterNode = { op: 'or', nodes: [where('a', 'eq', 1), where('b', 'eq', 2)] };
    const root = builderTreeFromNode(not(disjunction));
    expect(root.op).toBe('or');
    expect(root.negated).toBe(true);
    expect(root.children).toHaveLength(2);
  });

  it('reads a not over one condition as a negated group of one', () => {
    const root = builderTreeFromNode(not(where('a', 'eq', 1)));
    expect(root.negated).toBe(true);
    expect(root.children).toHaveLength(1);
  });

  it('splits a between into its two bounds, so either end edits alone', () => {
    const root = builderTreeFromNode(where('total', 'between', [10, 20]));
    const condition = firstChild(root);
    expect(condition.value).toBe(10);
    expect(condition.valueEnd).toBe(20);
  });

  it('gives every item its own id', () => {
    const root = builderTreeFromNode(and(where('a', 'eq', 1), where('b', 'eq', 2)));
    const ids = new Set([root.id, ...root.children.map((child) => child.id)]);
    expect(ids.size).toBe(3);
  });
});

describe('builderTreeToNode', () => {
  it('round-trips a nested expression unchanged', () => {
    const node = and(where('a', 'eq', 1), or(where('b', 'contains', 'x'), where('c', 'gt', 5)));
    expect(roundTrip(node)).toEqual(node);
  });

  it('round-trips a negation of one condition', () => {
    const node = not(where('a', 'eq', 1));
    expect(roundTrip(node)).toEqual(node);
  });

  it('round-trips a between', () => {
    const node = where('total', 'between', [10, 20]);
    expect(roundTrip(node)).toEqual(node);
  });

  it('round-trips an operator that takes no value, keeping the key absent', () => {
    const node = where('note', 'isNull');
    const result = roundTrip(node);
    expect(result).toEqual(node);
    expect(result != null && 'value' in result).toBe(false);
  });

  it('answers null for an expression with no usable condition', () => {
    const root = builderGroup('and', [builderCondition('name', 'contains', '')]);
    expect(builderTreeToNode(root)).toBeNull();
  });

  it('drops a group left with nothing rather than emitting an empty one', () => {
    const root = builderGroup('and', [
      builderCondition('a', 'eq', 1),
      builderGroup('or', [builderCondition('b', 'eq', '')]),
    ]);
    expect(builderTreeToNode(root)).toEqual(where('a', 'eq', 1));
  });

  it('negates nothing when the negated group has no usable child', () => {
    const root = builderGroup('and', [], true);
    expect(builderTreeToNode(root)).toBeNull();
  });

  it('routes every condition through the supplied builder', () => {
    const root = builderGroup('and', [builderCondition('a', 'eq', 1)]);
    const node = builderTreeToNode(root, (item) => where(item.field, 'ne', item.value));
    expect(node).toEqual(where('a', 'ne', 1));
  });
});

describe('defaultBuilderCondition', () => {
  it('refuses a row with no field chosen', () => {
    expect(defaultBuilderCondition(builderCondition('', 'eq', 1))).toBeNull();
  });

  it('keeps a range holding only one bound', () => {
    const node = defaultBuilderCondition(builderCondition('total', 'between', 10, null));
    expect(node).toEqual(where('total', 'between', [10, null]));
  });

  it('refuses a range holding neither bound', () => {
    expect(defaultBuilderCondition(builderCondition('total', 'between'))).toBeNull();
  });

  it('refuses an empty list but keeps a populated one', () => {
    expect(defaultBuilderCondition(builderCondition('tag', 'in', []))).toBeNull();
    expect(defaultBuilderCondition(builderCondition('tag', 'in', ['a']))).toEqual(
      where('tag', 'in', ['a']),
    );
  });
});

describe('tree edits', () => {
  it('appends to a nested group without disturbing its siblings', () => {
    const inner = builderGroup('or', [builderCondition('b', 'eq', 2)]);
    const root = builderGroup('and', [builderCondition('a', 'eq', 1), inner]);
    const next = insertBuilderItem(root, inner.id, builderCondition('c', 'eq', 3));
    expect(builderConditionCount(next)).toBe(3);
    expect(firstChild(next).field).toBe('a');
  });

  it('removes a nested item', () => {
    const target = builderCondition('b', 'eq', 2);
    const root = builderGroup('and', [
      builderCondition('a', 'eq', 1),
      builderGroup('or', [target]),
    ]);
    expect(builderConditionCount(removeBuilderItem(root, target.id))).toBe(1);
  });

  it('never removes the root, which is the expression itself', () => {
    const root = builderGroup('and', [builderCondition('a', 'eq', 1)]);
    expect(removeBuilderItem(root, root.id).children).toHaveLength(1);
  });

  it('updates one item and leaves the rest identical', () => {
    const target = builderCondition('a', 'eq', 1);
    const sibling = builderCondition('b', 'eq', 2);
    const root = builderGroup('and', [target, sibling]);
    const next = updateBuilderItem(root, target.id, (item) => ({ ...item, field: 'z' }));
    expect(firstChild(next).field).toBe('z');
    expect(next.children[1]).toBe(sibling);
  });

  it('refuses to replace a group with a condition', () => {
    const root = builderGroup('and', []);
    const next = updateBuilderItem(root, root.id, () => builderCondition('a', 'eq', 1));
    expect(next).toBe(root);
  });

  it('leaves the tree alone for an unknown id', () => {
    const root = builderGroup('and', [builderCondition('a', 'eq', 1)]);
    const next = updateBuilderItem(root, 'missing', (item) => ({ ...item, id: 'x' }));
    expect(builderTreeToNode(next)).toEqual(where('a', 'eq', 1));
  });
});

import { ExpansionStore } from './expansion.store';
import { GroupStore } from './group.store';

describe('GroupStore', () => {
  it('opens a group the user has not touched, by default', () => {
    expect(new GroupStore().isExpanded(['A'])).toBe(true);
  });

  it('follows a default of collapsed', () => {
    const store = new GroupStore();
    store.setDefaultExpanded(false);
    expect(store.isExpanded(['A'])).toBe(false);
  });

  it('records only the paths that depart from the default', () => {
    const store = new GroupStore();
    store.collapse(['A']);
    expect(store.exceptions().size).toBe(1);
    expect(store.isExpanded(['A'])).toBe(false);
    expect(store.isExpanded(['B'])).toBe(true);
  });

  it('drops the exception when a path returns to the default', () => {
    const store = new GroupStore();
    store.collapse(['A']);
    store.expand(['A']);
    expect(store.exceptions().size).toBe(0);
  });

  it('toggles', () => {
    const store = new GroupStore();
    store.toggle(['A']);
    expect(store.isExpanded(['A'])).toBe(false);
    store.toggle(['A']);
    expect(store.isExpanded(['A'])).toBe(true);
  });

  it('distinguishes nested paths', () => {
    const store = new GroupStore();
    store.collapse(['A', 'B']);
    expect(store.isExpanded(['A'])).toBe(true);
    expect(store.isExpanded(['A', 'B'])).toBe(false);
  });

  it('collapses everything, including groups it has never seen', () => {
    const store = new GroupStore();
    store.expand(['A']);
    store.collapseAll();
    expect(store.isExpanded(['A'])).toBe(false);
    expect(store.isExpanded(['never seen'])).toBe(false);
  });

  it('expands everything', () => {
    const store = new GroupStore();
    store.collapseAll();
    store.collapse(['A']);
    store.expandAll();
    expect(store.isExpanded(['A'])).toBe(true);
  });

  // The exceptions were written against the old default, so keeping them would
  // silently invert every group the user had touched.
  it('clears the exceptions when the default changes', () => {
    const store = new GroupStore();
    store.collapse(['A']);
    store.setDefaultExpanded(false);
    expect(store.isExpanded(['A'])).toBe(false);
    expect(store.exceptions().size).toBe(0);
  });

  it('returns every group to the default without changing it', () => {
    const store = new GroupStore();
    store.setDefaultExpanded(false);
    store.expand(['A']);
    store.reset();
    expect(store.isExpanded(['A'])).toBe(false);
    expect(store.defaultExpanded()).toBe(false);
  });
});

describe('ExpansionStore', () => {
  it('starts with nothing expanded', () => {
    expect(new ExpansionStore().expandedKeys()).toEqual([]);
  });

  it('expands and collapses by key', () => {
    const store = new ExpansionStore();
    store.expand(1);
    expect(store.isExpanded(1)).toBe(true);
    store.collapse(1);
    expect(store.isExpanded(1)).toBe(false);
  });

  it('keeps several open in multiple mode', () => {
    const store = new ExpansionStore();
    store.expand(1);
    store.expand(2);
    expect(store.expandedKeys()).toEqual([1, 2]);
  });

  it('keeps only the newest in single mode', () => {
    const store = new ExpansionStore();
    store.setMode('single');
    store.expand(1);
    store.expand(2);
    expect(store.expandedKeys()).toEqual([2]);
  });

  it('narrows an open set to one when the mode tightens', () => {
    const store = new ExpansionStore();
    store.expand(1);
    store.expand(2);
    store.setMode('single');
    expect(store.expandedKeys()).toEqual([2]);
  });

  it('refuses all but the last key of a set written in single mode', () => {
    const store = new ExpansionStore();
    store.setMode('single');
    store.set([1, 2, 3]);
    expect(store.expandedKeys()).toEqual([3]);
  });

  it('drops keys that vanished from the data', () => {
    const store = new ExpansionStore();
    store.set([1, 2, 3]);
    store.retainKeys(new Set([1, 3]));
    expect(store.expandedKeys()).toEqual([1, 3]);
  });

  it('keeps the same set identity when nothing was dropped', () => {
    const store = new ExpansionStore();
    store.set([1, 2]);
    const before = store.keys();
    store.retainKeys(new Set([1, 2]));
    expect(store.keys()).toBe(before);
  });
});

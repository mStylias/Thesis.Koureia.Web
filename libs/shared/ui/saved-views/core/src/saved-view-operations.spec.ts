/**
 * The view list as plain data (§14.4).
 *
 * Every rule the strip depends on is here rather than in a rendered fixture:
 * the ordering, the naming and the drop target are decisions, and a decision
 * tested through a DOM is tested through a second thing that can be wrong.
 */
import {
  SAVED_VIEWS_VERSION,
  addView,
  createViewId,
  duplicateView,
  insertViewAfter,
  isValidViewName,
  moveView,
  normalizeViewName,
  readSavedViewsDocument,
  removeView,
  setDefaultView,
  uniqueViewName,
  updateView,
  viewDropIndex,
  savedViewsDocument,
  savedViewsResourceKey,
  VIEW_NAME_MAX_LENGTH,
} from './saved-view-operations';
import type { SavedView } from './saved-views.types';

/** The host's state, as this lib sees it: any object it does not read. */
interface State {
  readonly column: string;
}

function state(column: string): State {
  return { column };
}

function view(id: string, name = id): SavedView<State> {
  return { id, name, state: state(id) };
}

const VIEWS: readonly SavedView<State>[] = [view('a'), view('b'), view('c')];
const ids = (list: readonly SavedView<unknown>[]): string[] => list.map((entry) => entry.id);

describe('savedViewsResourceKey', () => {
  it('appends the resource kind, so the convention cannot be spelled two ways', () => {
    expect(savedViewsResourceKey('roles_main_grid')).toBe('roles_main_grid_views');
  });
});

describe('createViewId', () => {
  it('answers something different every time, since ids outlive the session', () => {
    const generated = new Set(Array.from({ length: 50 }, () => createViewId()));

    expect(generated.size).toBe(50);
  });
});

describe('normalizeViewName', () => {
  it('trims, so a name of spaces is not a name', () => {
    expect(normalizeViewName('  Weekly  ')).toBe('Weekly');
    expect(isValidViewName('   ')).toBe(false);
  });

  it('caps the name, so a tab cannot be used as a description', () => {
    expect(normalizeViewName('x'.repeat(400))).toHaveLength(VIEW_NAME_MAX_LENGTH);
  });
});

describe('uniqueViewName', () => {
  it('leaves a free name alone', () => {
    expect(uniqueViewName(VIEWS, 'd')).toBe('d');
  });

  it('numbers from two, and keeps counting past a taken number', () => {
    const taken = [view('1', 'Weekly'), view('2', 'Weekly (2)')];

    expect(uniqueViewName(taken, 'Weekly')).toBe('Weekly (3)');
  });
});

describe('moveView', () => {
  it('moves a view and closes the gap behind it', () => {
    expect(ids(moveView(VIEWS, 'a', 2))).toEqual(['b', 'c', 'a']);
    expect(ids(moveView(VIEWS, 'c', 0))).toEqual(['c', 'a', 'b']);
  });

  it('clamps rather than refusing, because a drag past the last tab means the end', () => {
    expect(ids(moveView(VIEWS, 'a', 9))).toEqual(['b', 'c', 'a']);
    expect(ids(moveView(VIEWS, 'c', -4))).toEqual(['c', 'a', 'b']);
  });

  it('leaves an unknown id and a no-op move alone', () => {
    expect(ids(moveView(VIEWS, 'zz', 0))).toEqual(['a', 'b', 'c']);
    expect(ids(moveView(VIEWS, 'b', 1))).toEqual(['a', 'b', 'c']);
  });

  it('never mutates what it was given', () => {
    const source = [...VIEWS];
    moveView(source, 'a', 2);

    expect(ids(source)).toEqual(['a', 'b', 'c']);
  });
});

describe('setDefaultView', () => {
  it('is a move to the front, since the first view is what a fresh load applies', () => {
    expect(ids(setDefaultView(VIEWS, 'c'))).toEqual(['c', 'a', 'b']);
  });
});

describe('duplicateView', () => {
  it('puts the copy beside its original rather than at the end of the strip', () => {
    const next = duplicateView(VIEWS, 'a');

    expect(next).toHaveLength(4);
    expect(next[1]?.name).toBe('a (2)');
    expect(ids(next).slice(2)).toEqual(['b', 'c']);
  });

  it('gives the copy its own id and the same state', () => {
    const next = duplicateView(VIEWS, 'a');

    expect(next[1]?.id).not.toBe('a');
    expect(next[1]?.state).toEqual(state('a'));
  });

  it('leaves an unknown id alone', () => {
    expect(duplicateView(VIEWS, 'zz')).toHaveLength(3);
  });
});

describe('addView, removeView, updateView, insertViewAfter', () => {
  it('appends, removes and patches by id', () => {
    expect(ids(addView(VIEWS, view('d')))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(removeView(VIEWS, 'b'))).toEqual(['a', 'c']);
    expect(updateView(VIEWS, 'b', { name: 'Renamed' })[1]?.name).toBe('Renamed');
  });

  it('leaves the rest of a patched view alone', () => {
    const next = updateView(VIEWS, 'b', { name: 'Renamed' });

    expect(next[1]?.state).toEqual(state('b'));
  });

  it('appends when the anchor is gone, so a duplicate is never lost', () => {
    expect(ids(insertViewAfter(VIEWS, 'zz', view('d')))).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('viewDropIndex', () => {
  // Three tabs of 100px with no gap: centres at 50, 150 and 250.
  const centers = [50, 150, 250];
  /** The dragged tab's box, `width` wide, its left edge at `left`. */
  const at = (left: number, width = 100) => ({ start: left, end: left + width });

  it('holds while the tab has not covered half of the neighbour', () => {
    // Right edge at 140, short of the second tab's centre at 150.
    expect(viewDropIndex(centers, at(40), 0)).toBe(0);
    // Leading edge at 190, short of the second tab's centre going the other way.
    expect(viewDropIndex(centers, at(190), 2)).toBe(2);
  });

  it('swaps one place per crossing, in either direction', () => {
    expect(viewDropIndex(centers, at(80), 0)).toBe(1);
    expect(viewDropIndex(centers, at(120), 2)).toBe(1);
  });

  it('advances one place at a time, so a fast sweep does not jump the strip', () => {
    expect(viewDropIndex(centers, at(900), 0)).toBe(1);
  });

  it('stops at the ends', () => {
    expect(viewDropIndex(centers, at(-900), 0)).toBe(0);
    expect(viewDropIndex(centers, at(900), 2)).toBe(2);
  });

  it('tests only the neighbour it is travelling towards', () => {
    // A tab wide enough to cover both neighbours resolves to one of them, on
    // the side its own centre has moved to — never two ways at once.
    expect(viewDropIndex([50, 150, 250], { start: 60, end: 400 }, 1)).toBe(2);
    expect(viewDropIndex([50, 150, 250], { start: -100, end: 240 }, 1)).toBe(0);
  });

  it('lets a tab wider than the last one still reach the end', () => {
    // The regression: a 200px tab dragged to the right edge of a strip whose
    // last tab is 60px wide. Its centre can never pass that tab's centre, so a
    // centre test leaves the widest view unable to be made last.
    const narrowLast = [100, 260];
    expect(viewDropIndex(narrowLast, { start: 90, end: 290 }, 0)).toBe(1);
  });
});

describe('savedViewsDocument and readSavedViewsDocument', () => {
  it('round-trips', () => {
    const document = savedViewsDocument(VIEWS);

    expect(document.version).toBe(SAVED_VIEWS_VERSION);
    expect(readSavedViewsDocument(document)).toEqual([...VIEWS]);
  });

  it('discards another version rather than guessing at it', () => {
    expect(readSavedViewsDocument({ version: 99, views: [view('a')] })).toBeNull();
  });

  it('discards anything that is not a document', () => {
    expect(readSavedViewsDocument(null)).toBeNull();
    expect(readSavedViewsDocument('views')).toBeNull();
    expect(readSavedViewsDocument({ version: SAVED_VIEWS_VERSION })).toBeNull();
  });

  it('drops an entry that is not a view, and keeps the rest', () => {
    const read = readSavedViewsDocument({
      version: SAVED_VIEWS_VERSION,
      views: [view('a'), { id: 'b' }, { id: 'c', name: 'c', state: 'not an object' }],
    });

    expect(ids(read ?? [])).toEqual(['a']);
  });

  it('keeps a view whose state it cannot read, since only the host knows the shape', () => {
    const read = readSavedViewsDocument({
      version: SAVED_VIEWS_VERSION,
      views: [{ id: 'c', name: 'c', state: { anything: true } }],
    });

    expect(ids(read ?? [])).toEqual(['c']);
  });
});

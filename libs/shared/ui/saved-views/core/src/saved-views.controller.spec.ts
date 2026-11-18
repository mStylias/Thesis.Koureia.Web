/**
 * The temporary view: a view made for one visit, which the controller holds apart from the
 * stored list. Every test here is a way it could reach the list, the default or the store.
 */
import { signal } from '@angular/core';
import { SAVED_VIEWS_VERSION } from './saved-view-operations';
import { SavedViewsController } from './saved-views.controller';
import type {
  SavedViewsDocument,
  SavedViewsStorage,
  TemporarySavedView,
} from './saved-views.types';

interface Word {
  readonly text: string;
}

function isWord(value: unknown): value is Word {
  return typeof value === 'object' && value !== null && typeof (value as Word).text === 'string';
}

const KEY = 'words_views';

const STORED: SavedViewsDocument<Word> = {
  version: SAVED_VIEWS_VERSION,
  views: [
    { id: 'view-0', name: 'Alpha', state: { text: 'alpha' } },
    { id: 'view-1', name: 'Beta', state: { text: 'beta' } },
  ],
};

const TEMPORARY: TemporarySavedView<Word> = {
  id: 'temporary',
  name: 'Γιώργος',
  description: 'From the appointment',
  state: { text: 'customer' },
};

function setup(stored: SavedViewsDocument<Word> | null = STORED) {
  const saved: SavedViewsDocument<unknown>[] = [];
  const storage: SavedViewsStorage = {
    load: () => Promise.resolve(stored),
    save: (_key, document) => {
      saved.push(document);
      return Promise.resolve();
    },
  };
  const word = signal<Word>({ text: '' });
  const applied: Word[] = [];
  let resets = 0;
  const controller = new SavedViewsController<Word>({
    key: () => KEY,
    storage: () => storage,
    state: () => word(),
    apply: (state) => {
      applied.push(state);
      word.set(state);
    },
    isDestroyed: () => false,
    isState: isWord,
    statesEqual: (a, b) => a.text === b.text,
    reset: () => {
      resets += 1;
    },
  });
  return { controller, saved, word, applied, resets: () => resets };
}

/** Lets an optimistic write reach the store. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function storedIds(document: SavedViewsDocument<unknown> | undefined): string[] {
  return (document?.views ?? []).map((view) => view.id);
}

describe('a temporary view', () => {
  it('is what the first load answers, instead of the default', async () => {
    const { controller } = setup();
    const initial = await controller.load(KEY, { temporary: TEMPORARY });
    expect(initial).toEqual({ text: 'customer' });
    expect(controller.selectedId()).toBe('temporary');
    expect(controller.views().map((view) => view.id)).toEqual(['view-0', 'view-1']);
  });

  it('is still applied when there is no stored document, or the read fails', async () => {
    const empty = setup(null);
    expect(await empty.controller.load(KEY, { temporary: TEMPORARY })).toEqual({
      text: 'customer',
    });

    const failing = new SavedViewsController<Word>({
      key: () => KEY,
      storage: () => ({
        load: () => Promise.reject(new Error('offline')),
        save: () => Promise.resolve(),
      }),
      state: () => ({ text: '' }),
      apply: () => undefined,
      isDestroyed: () => false,
      isState: isWord,
      statesEqual: (a, b) => a.text === b.text,
    });
    expect(await failing.load(KEY, { temporary: TEMPORARY })).toEqual({ text: 'customer' });
    expect(failing.selectedId()).toBe('temporary');
  });

  // A view whose name needs a lookup must not add a round trip before the first query.
  it('waits for a pending view beside the document, and opens the default if it fails', async () => {
    const { controller } = setup();
    let resolveView: (view: TemporarySavedView<Word>) => void = () => undefined;
    const load = controller.load(KEY, {
      temporary: new Promise<TemporarySavedView<Word>>((resolve) => {
        resolveView = resolve;
      }),
    });
    resolveView(TEMPORARY);
    expect(await load).toEqual({ text: 'customer' });
    expect(controller.temporary()?.id).toBe('temporary');
    expect(controller.selectedId()).toBe('temporary');

    const rejected = setup();
    expect(
      await rejected.controller.load(KEY, { temporary: Promise.reject(new Error('gone')) }),
    ).toEqual({ text: 'alpha' });
    expect(rejected.controller.temporary()).toBeNull();
  });

  it('applies once when opened, and replaces an earlier one', async () => {
    const { controller, applied } = setup();
    await controller.load(KEY);
    controller.openTemporary(TEMPORARY);
    controller.openTemporary({ ...TEMPORARY, id: 'second', state: { text: 'other' } });
    expect(applied).toEqual([{ text: 'customer' }, { text: 'other' }]);
    expect(controller.temporary()?.id).toBe('second');
  });

  it('cannot be moved, made the default, dragged or saved over', async () => {
    const { controller, saved, word } = setup();
    await controller.load(KEY, { temporary: TEMPORARY });
    controller.move('temporary', 0);
    controller.previewMove('temporary', 0);
    controller.commitOrder();
    controller.setDefault('temporary');
    word.set({ text: 'edited' });
    controller.saveChanges();
    await flush();
    // `commitOrder` writes the unchanged order, and nothing else was written.
    expect(saved.map(storedIds)).toEqual([['view-0', 'view-1']]);
    expect(controller.views().at(0)?.id).toBe('view-0');
  });

  it('never reaches the store, whatever else is written', async () => {
    const { controller, saved } = setup();
    await controller.load(KEY, { temporary: TEMPORARY });
    controller.duplicate('view-1');
    controller.move('view-1', 0);
    controller.setDefault('view-0');
    await flush();
    expect(saved.length).toBeGreaterThan(0);
    for (const document of saved) {
      expect(storedIds(document)).not.toContain('temporary');
    }
  });

  it('duplicates to a stored view at the end, leaving the default alone', async () => {
    const { controller, saved, word } = setup();
    await controller.load(KEY, { temporary: TEMPORARY });
    word.set({ text: 'customer, sorted' });
    controller.duplicate('temporary');
    await flush();
    const ids = controller.views().map((view) => view.id);
    expect(ids.slice(0, 2)).toEqual(['view-0', 'view-1']);
    expect(ids).toHaveLength(3);
    expect(controller.views().at(2)?.state).toEqual({ text: 'customer, sorted' });
    expect(controller.selectedId()).toBe(ids[2]);
    expect(storedIds(saved.at(-1))).toEqual(ids);
  });

  it('applies the default when it closes while on screen', async () => {
    const { controller, applied } = setup();
    await controller.load(KEY, { temporary: TEMPORARY });
    controller.closeTemporary();
    expect(controller.temporary()).toBeNull();
    expect(controller.selectedId()).toBe('view-0');
    expect(applied.at(-1)).toEqual({ text: 'alpha' });
  });

  it('resets the host when it closes and no view is stored', async () => {
    const { controller, resets } = setup(null);
    await controller.load(KEY, { temporary: TEMPORARY });
    controller.closeTemporary();
    expect(controller.selectedId()).toBeNull();
    expect(resets()).toBe(1);
  });

  it('closes rather than deletes, and asks the store for nothing', async () => {
    const { controller, saved } = setup();
    await controller.load(KEY, { temporary: TEMPORARY });
    controller.remove('temporary');
    await flush();
    expect(controller.temporary()).toBeNull();
    expect(saved).toEqual([]);
  });

  it('leaves the host where it is when it closes off screen', async () => {
    const { controller, applied } = setup();
    await controller.load(KEY, { temporary: TEMPORARY });
    controller.select('view-1');
    applied.length = 0;
    controller.closeTemporary();
    expect(applied).toEqual([]);
    expect(controller.selectedId()).toBe('view-1');
  });
});

describe("a temporary view's leave hook", () => {
  it('runs once when another view is selected, and not again on close', async () => {
    const { controller } = setup();
    let left = 0;
    await controller.load(KEY, {
      temporary: {
        ...TEMPORARY,
        onLeave: () => {
          left += 1;
        },
      },
    });
    controller.select('view-1');
    controller.closeTemporary();
    expect(left).toBe(1);
  });

  it('runs when it closes on screen', async () => {
    const { controller } = setup();
    let left = 0;
    await controller.load(KEY, {
      temporary: {
        ...TEMPORARY,
        onLeave: () => {
          left += 1;
        },
      },
    });
    controller.closeTemporary();
    expect(left).toBe(1);
  });
});

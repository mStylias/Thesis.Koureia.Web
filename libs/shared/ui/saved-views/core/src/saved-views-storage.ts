/**
 * Where named views are kept.
 *
 * An adapter, never built in: this library speaks no transport. The default
 * is that nothing is stored, and the strip says so.
 *
 * ```ts
 * providers: [provideSavedViewsStorage(myStorage)]
 * ```
 */
import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import type { SavedViewsDocument, SavedViewsStorage } from './saved-views.types';

/** Application-wide views storage, resolved when the host binds no adapter. */
export const SAVED_VIEWS_STORAGE = new InjectionToken<SavedViewsStorage>('SAVED_VIEWS_STORAGE');

/**
 * Registers a views store for every host beneath the injector. A host still
 * has to say which document is its own through its key.
 */
export function provideSavedViewsStorage(adapter: SavedViewsStorage): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SAVED_VIEWS_STORAGE, useValue: adapter }]);
}

/**
 * Keeps one document per key in memory, for a story or a spec.
 *
 * Deliberately not a local-storage adapter: views are a per-user record the
 * product keeps on a server, and shipping a convenience that silently makes
 * them per-browser would be the wrong default to reach for.
 */
export function memorySavedViewsStorage(
  seed?: Readonly<Record<string, SavedViewsDocument<unknown>>>,
): SavedViewsStorage {
  const store = new Map<string, SavedViewsDocument<unknown>>(Object.entries(seed ?? {}));
  return {
    load: (key) => Promise.resolve(store.get(key) ?? null),
    save: (key, document) => {
      store.set(key, document);
      return Promise.resolve();
    },
  };
}

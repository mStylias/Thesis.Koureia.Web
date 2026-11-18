import { inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserResourcesApi } from '@api/user-resources';
import {
  SAVED_VIEWS_STORAGE,
  readSavedViewsDocument,
  savedViewsDocument,
  type SavedViewsDocument,
  type SavedViewsStorage,
} from '@ui/saved-views/core';

/**
 * Keeps a host's named views in a user resource.
 *
 * This lives in a feature library rather than beside either half it joins:
 * `@ui/saved-views` may speak no transport and `@api/user-resources` may not
 * depend on a ui library, so the one file that knows about both belongs where
 * the dependency rules allow it to.
 *
 * One resource per host, named by the host's key plus the library's `_views`
 * suffix — `roles_main_grid_views`. The whole document, order included, is the
 * resource's `value`, so a create, a rename and a reorder are each one request
 * rather than one for the views and one for their order.
 */
export function userResourceSavedViewsStorage(api: UserResourcesApi): SavedViewsStorage {
  /**
   * The id of the resource holding each key, learned on the first read.
   *
   * Every write addresses that id, and looking it up again per save would
   * double the requests. `undefined` means "not looked up yet"; `null` means
   * "looked up, nothing stored under this name".
   */
  const ids = new Map<string, string | null>();

  const findId = async (key: string): Promise<string | null> => {
    const known = ids.get(key);
    if (known !== undefined) {
      return known;
    }
    const found = await firstValueFrom(api.findByName(key));
    const id = found?.id ?? null;
    ids.set(key, id);
    return id;
  };

  return {
    load: async (key) => {
      const found = await firstValueFrom(api.findByName(key));
      ids.set(key, found?.id ?? null);
      if (found == null) {
        return null;
      }
      // A document this version cannot read is discarded, not guessed at:
      // half-applying somebody's saved arrangement is worse than none.
      const views = readSavedViewsDocument(found.value);
      return views == null ? null : savedViewsDocument(views);
    },
    save: async (key, document: SavedViewsDocument<unknown>) => {
      const id = await findId(key);
      if (id == null) {
        const created = await firstValueFrom(
          api.create<SavedViewsDocument<unknown>>({ name: key, value: document }),
        );
        ids.set(key, created.id);
        return;
      }
      // `value` is replaced whole — the endpoint does no deep merge — which is
      // what a document holding the entire list wants.
      await firstValueFrom(api.patch<SavedViewsDocument<unknown>>(id, { value: document }));
    },
  };
}

/**
 * Registers {@link userResourceSavedViewsStorage} for every host in the application.
 *
 * ```ts
 * providers: [provideUserResourceSavedViews()]
 * ```
 *
 * A factory rather than a value: the adapter needs `UserResourcesApi`, and it
 * is built once per injector, so the id cache outlives the hosts that read it.
 */
export function provideUserResourceSavedViews(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SAVED_VIEWS_STORAGE,
      useFactory: () => userResourceSavedViewsStorage(inject(UserResourcesApi)),
    },
  ]);
}

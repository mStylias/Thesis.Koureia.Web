import { of } from 'rxjs';
import type { UserResourcesApi, UserResourceResponse } from '@api/user-resources';
import { SAVED_VIEWS_VERSION, type SavedViewsDocument } from '@ui/saved-views/core';
import { userResourceSavedViewsStorage } from './user-resource-saved-views-storage';

const DOCUMENT: SavedViewsDocument<unknown> = {
  version: SAVED_VIEWS_VERSION,
  views: [{ id: 'a', name: 'Busy', state: { any: 'shape' } }],
};

function resource(value: unknown, id = 'res-1'): UserResourceResponse {
  return {
    id,
    userId: 'u',
    name: 'grid_views',
    description: null,
    value,
    isShared: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
  };
}

/** Records the calls, so a save is measured as one request rather than two. */
function fakeApi(stored: UserResourceResponse | null): {
  api: UserResourcesApi;
  calls: string[];
} {
  const calls: string[] = [];
  const api = {
    findByName: () => {
      calls.push('find');
      return of(stored);
    },
    create: (body: { name: string; value: unknown }) => {
      calls.push('create');
      return of(resource(body.value, 'created'));
    },
    patch: (id: string, body: { value?: unknown }) => {
      calls.push(`patch:${id}`);
      return of(resource(body.value, id));
    },
  } as unknown as UserResourcesApi;
  return { api, calls };
}

describe('userResourceSavedViewsStorage', () => {
  it('answers the stored document and hands its states on unread', async () => {
    const { api } = fakeApi(resource(DOCUMENT));

    await expect(userResourceSavedViewsStorage(api).load('grid_views')).resolves.toEqual(DOCUMENT);
  });

  it('answers null for nothing stored and for a document it cannot read', async () => {
    await expect(userResourceSavedViewsStorage(fakeApi(null).api).load('k')).resolves.toBeNull();
    await expect(
      userResourceSavedViewsStorage(fakeApi(resource({ version: 99, views: [] })).api).load('k'),
    ).resolves.toBeNull();
  });

  it('creates on the first save of a new key and patches the id it learned afterwards', async () => {
    const { api, calls } = fakeApi(null);
    const storage = userResourceSavedViewsStorage(api);

    await storage.save('grid_views', DOCUMENT);
    await storage.save('grid_views', DOCUMENT);

    expect(calls).toEqual(['find', 'create', 'patch:created']);
  });

  it('patches the id a load learned, without looking it up again', async () => {
    const { api, calls } = fakeApi(resource(DOCUMENT));
    const storage = userResourceSavedViewsStorage(api);

    await storage.load('grid_views');
    await storage.save('grid_views', DOCUMENT);

    expect(calls).toEqual(['find', 'patch:res-1']);
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserResourcesApi, type UserResourceResponse } from '@api/user-resources';
import { ThemeService, type ThemePreference } from '@util/brand';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ThemePreferenceSync, UI_PREFERENCES_RESOURCE } from './theme-preference-sync';

function resource(value: unknown, id = 'r1'): UserResourceResponse {
  return {
    id,
    userId: 'u1',
    name: UI_PREFERENCES_RESOURCE,
    description: null,
    value,
    isShared: false,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: null,
  };
}

const api = {
  findByName: vi.fn<(name: string) => Observable<UserResourceResponse | null>>(),
  create: vi.fn<(body: unknown) => Observable<UserResourceResponse>>(),
  patch: vi.fn<(id: string, body: unknown) => Observable<UserResourceResponse>>(),
};

const preference = signal<ThemePreference>('system');
const theme = {
  preference,
  set: vi.fn((value: ThemePreference) => {
    preference.set(value);
  }),
};

function setUp(): ThemePreferenceSync {
  TestBed.configureTestingModule({
    providers: [
      ThemePreferenceSync,
      { provide: UserResourcesApi, useValue: api },
      { provide: ThemeService, useValue: theme },
    ],
  });
  return TestBed.inject(ThemePreferenceSync);
}

describe('ThemePreferenceSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preference.set('system');
  });

  describe('sync', () => {
    it('applies the account theme when it differs', async () => {
      api.findByName.mockReturnValue(of(resource({ theme: 'dark' })));

      await setUp().sync();

      expect(api.findByName).toHaveBeenCalledWith('ui_preferences');
      expect(theme.set).toHaveBeenCalledWith('dark');
    });

    it('changes nothing when the account theme is the one showing', async () => {
      preference.set('dark');
      api.findByName.mockReturnValue(of(resource({ theme: 'dark' })));

      await setUp().sync();

      expect(theme.set).not.toHaveBeenCalled();
    });

    it('changes and writes nothing when the account has no resource', async () => {
      api.findByName.mockReturnValue(of(null));

      await setUp().sync();

      expect(theme.set).not.toHaveBeenCalled();
      expect(api.create).not.toHaveBeenCalled();
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('ignores a value it does not know', async () => {
      api.findByName.mockReturnValue(of(resource({ theme: 'sepia' })));

      await setUp().sync();

      expect(theme.set).not.toHaveBeenCalled();
    });

    it('changes nothing when the read fails', async () => {
      api.findByName.mockReturnValue(throwError(() => new Error('down')));

      await expect(setUp().sync()).resolves.toBeUndefined();
      expect(theme.set).not.toHaveBeenCalled();
    });

    it('does not undo a choice made while the read was in flight', async () => {
      const answer = new Subject<UserResourceResponse | null>();
      api.findByName.mockReturnValueOnce(answer).mockReturnValue(of(null));
      api.create.mockReturnValue(of(resource({ theme: 'light' })));
      const sync = setUp();

      const syncing = sync.sync();
      await sync.save('light');
      answer.next(resource({ theme: 'dark' }));
      answer.complete();
      await syncing;

      expect(theme.set).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('creates the resource when the account has none', async () => {
      api.findByName.mockReturnValue(of(null));
      api.create.mockReturnValue(of(resource({ theme: 'dark' })));

      expect(await setUp().save('dark')).toBe(true);

      expect(api.create).toHaveBeenCalledWith({
        name: 'ui_preferences',
        value: { theme: 'dark' },
      });
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('patches the whole value of the oldest resource and keeps its other members', async () => {
      api.findByName.mockReturnValue(of(resource({ theme: 'light', density: 'compact' }, 'r7')));
      api.patch.mockReturnValue(of(resource({ theme: 'dark' }, 'r7')));

      expect(await setUp().save('dark')).toBe(true);

      expect(api.patch).toHaveBeenCalledWith('r7', {
        value: { theme: 'dark', density: 'compact' },
      });
      expect(api.create).not.toHaveBeenCalled();
    });

    it('resolves false when the write fails', async () => {
      api.findByName.mockReturnValue(of(null));
      api.create.mockReturnValue(throwError(() => new Error('down')));

      expect(await setUp().save('dark')).toBe(false);
    });

    it('runs two quick saves one after the other, so only one resource is created', async () => {
      let stored: UserResourceResponse | null = null;
      api.findByName.mockImplementation(() => of(stored));
      api.create.mockImplementation((body) => {
        stored = resource((body as { value: unknown }).value);
        return of(stored);
      });
      api.patch.mockImplementation((_id, body) => of(resource((body as { value: unknown }).value)));
      const sync = setUp();

      await Promise.all([sync.save('dark'), sync.save('light')]);

      expect(api.create).toHaveBeenCalledOnce();
      expect(api.patch).toHaveBeenCalledWith('r1', { value: { theme: 'light' } });
    });
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { StaffApi, type StaffMemberCardResponse } from '@api/staff';
import { Result } from '@synax/client/core';
import { of } from 'rxjs';

import { SKELETON_MIN_DURATION, StaffStore } from './staff.store';

const FAILURE = Result.Fail({ errorCode: 'HTTP_500', httpCode: 500, validationErrors: [] });

describe('StaffStore', () => {
  const list = signal<Result<StaffMemberCardResponse[]>>(Result.Ok([]));
  const options = signal<Result<unknown>>(Result.Ok({ timezone: 'Europe/Athens' }));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StaffStore,
        provideTransloco({ config: { availableLangs: ['el'], defaultLang: 'el' } }),
        { provide: StaffApi, useValue: { list: () => of(list()), options: () => of(options()) } },
      ],
    });
  });

  it('keeps the cards on screen when a later read fails, and says it failed', async () => {
    const store = TestBed.inject(StaffStore);
    const card = { id: 'm1' } as StaffMemberCardResponse;
    list.set(Result.Ok([card]));
    await store.reload();

    list.set(FAILURE);
    await store.reload();

    expect(store.members()).toEqual([card]);
    expect(store.membersFailed()).toBe(true);
    expect(store.membersLoading()).toBe(false);
  });

  it('holds the first read until the skeleton has been up its minimum, and only the first', async () => {
    vi.useFakeTimers();
    try {
      const store = TestBed.inject(StaffStore);
      const card = { id: 'm1' } as StaffMemberCardResponse;
      list.set(Result.Ok([card]));

      const first = store.reload();
      await vi.advanceTimersByTimeAsync(SKELETON_MIN_DURATION - 1);
      expect(store.members()).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      await first;
      expect(store.members()).toEqual([card]);

      list.set(Result.Ok([]));
      await store.reload();
      expect(store.members()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps no options after a failed read, and falls back to the browser zone', async () => {
    options.set(FAILURE);
    const store = TestBed.inject(StaffStore);

    await store.loadOptions();

    expect(store.options()).toBeNull();
    expect(store.optionsFailed()).toBe(true);
    expect(store.timezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("uses the shop's zone once the options land", async () => {
    options.set(Result.Ok({ timezone: 'Europe/Athens' }));
    const store = TestBed.inject(StaffStore);
    await store.loadOptions();
    expect(store.timezone()).toBe('Europe/Athens');
  });
});

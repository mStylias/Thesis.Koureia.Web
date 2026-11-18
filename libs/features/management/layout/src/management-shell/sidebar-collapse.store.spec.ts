import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SidebarCollapseStore } from './sidebar-collapse.store';

const COLLAPSED_KEY = 'management.sidebar-collapsed';

function store(): SidebarCollapseStore {
  return TestBed.inject(SidebarCollapseStore);
}

describe('SidebarCollapseStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens expanded when nothing is stored', () => {
    expect(store().collapsed()).toBe(false);
  });

  it('restores the rail a previous visit left collapsed', () => {
    localStorage.setItem(COLLAPSED_KEY, '1');

    expect(store().collapsed()).toBe(true);
  });

  it('ignores a stored value it did not write', () => {
    localStorage.setItem(COLLAPSED_KEY, 'yes');

    expect(store().collapsed()).toBe(false);
  });

  it('stores the rail and clears the key when it opens again', () => {
    const sidebar = store();

    sidebar.collapsed.set(true);
    TestBed.tick();
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('1');

    sidebar.collapsed.set(false);
    TestBed.tick();
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
  });

  it('writes nothing for a visitor who never worked the toggle', () => {
    store();
    TestBed.tick();

    expect(localStorage.length).toBe(0);
  });

  it('keeps working when storage refuses the write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const sidebar = store();

    sidebar.collapsed.set(true);

    expect(() => {
      TestBed.tick();
    }).not.toThrow();
    expect(sidebar.collapsed()).toBe(true);
    setItem.mockRestore();
  });

  it('reads nothing on the server, so no render carries one visitor rail', () => {
    localStorage.setItem(COLLAPSED_KEY, '1');
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });

    expect(store().collapsed()).toBe(false);
  });
});

import { localStorageStatePersistence } from './state-persistence';
import { GRID_STATE_VERSION } from './state';
import type { GridState } from './types/state.types';

/** A `Storage` that can be told to refuse, which is what private mode does. */
class FakeStorage implements Storage {
  private readonly entries = new Map<string, string>();
  refuse = false;

  get length(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
  }
  getItem(key: string): string | null {
    if (this.refuse) {
      throw new Error('storage unavailable');
    }
    return this.entries.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.entries.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.refuse) {
      throw new Error('quota exceeded');
    }
    this.entries.set(key, value);
  }
}

const STATE: GridState = {
  version: GRID_STATE_VERSION,
  columns: [{ id: 'name', visible: true, visibleIndex: 0, width: 200, pinned: false }],
  search: 'nic',
};

describe('localStorageStatePersistence', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('round-trips a state under the prefixed id', () => {
    const adapter = localStorageStatePersistence({ storage, prefix: 'grid.' });
    void adapter.save('bookings', STATE);
    expect(storage.getItem('grid.bookings')).not.toBeNull();
    expect(adapter.load('bookings')).toEqual(STATE);
  });

  it('answers null for an id that was never saved', () => {
    expect(localStorageStatePersistence({ storage }).load('missing')).toBeNull();
  });

  it('answers null for stored text that is not a state', () => {
    storage.setItem('datagrid.state.bookings', '{"nope":true}');
    expect(localStorageStatePersistence({ storage }).load('bookings')).toBeNull();
  });

  it('answers null rather than throwing on unparsable text', () => {
    storage.setItem('datagrid.state.bookings', 'not json');
    expect(localStorageStatePersistence({ storage }).load('bookings')).toBeNull();
  });

  it('survives a store that refuses: the arrangement is lost, the grid is not', () => {
    const adapter = localStorageStatePersistence({ storage });
    storage.refuse = true;
    expect(() => {
      void adapter.save('bookings', STATE);
    }).not.toThrow();
    expect(adapter.load('bookings')).toBeNull();
  });

  it('clears an id', () => {
    const adapter = localStorageStatePersistence({ storage });
    void adapter.save('bookings', STATE);
    void adapter.clear?.('bookings');
    expect(adapter.load('bookings')).toBeNull();
  });
});

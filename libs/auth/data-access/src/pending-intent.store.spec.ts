import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { PendingIntentStore } from './pending-intent.store';

const INTENT_KEY = 'koureia.intent.v1';

function createStore(platform: 'browser' | 'server' = 'browser'): PendingIntentStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [PendingIntentStore, { provide: PLATFORM_ID, useValue: platform }],
  });
  return TestBed.inject(PendingIntentStore);
}

describe('PendingIntentStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns a recorded payload intact', () => {
    const store = createStore();
    const payload = { shopId: 'shop-1', services: ['cut', 'beard'], slot: '2026-08-10T09:30:00Z' };

    store.record({ kind: 'booking', payload });

    expect(store.peek()).toEqual({ kind: 'booking', payload });
  });

  it('survives a new store over the same storage, which is what a redirect looks like', () => {
    createStore().record({ kind: 'booking', payload: { slot: 'noon' } });

    // A round trip to Keycloak is a full page load: same tab, same `sessionStorage`, an
    // entirely new application instance. Nothing may be carried in memory across it.
    expect(createStore().peek()).toEqual({ kind: 'booking', payload: { slot: 'noon' } });
  });

  it('keeps the intent on peek and drops it on consume', () => {
    const store = createStore();
    store.record({ kind: 'booking', payload: 1 });

    expect(store.peek()).not.toBeNull();
    expect(store.peek()).not.toBeNull();

    expect(store.consume()).toEqual({ kind: 'booking', payload: 1 });
    expect(store.peek()).toBeNull();
    expect(store.consume()).toBeNull();
  });

  it('replaces rather than accumulates: one tab, one thing in flight', () => {
    const store = createStore();

    store.record({ kind: 'booking', payload: 'first' });
    store.record({ kind: 'booking', payload: 'second' });

    expect(store.peek()?.payload).toBe('second');
  });

  it('discards an entry written by an older shape instead of reading it', () => {
    sessionStorage.setItem(
      INTENT_KEY,
      JSON.stringify({ version: 0, kind: 'booking', payload: { shopId: 'shop-1' } }),
    );

    // A tab left open across a deploy holds the old shape. Invalid, never half-understood.
    expect(createStore().peek()).toBeNull();
    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
  });

  it.each([
    ['unparseable', 'not json at all'],
    ['an array', '[1,2,3]'],
    ['a bare value', '"booking"'],
    ['a missing kind', JSON.stringify({ version: 1, payload: {} })],
    ['an empty kind', JSON.stringify({ version: 1, kind: '', payload: {} })],
  ])('discards %s', (_label, raw) => {
    sessionStorage.setItem(INTENT_KEY, raw);

    expect(createStore().peek()).toBeNull();
    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
  });

  it('drops the previous intent when the new one will not serialise', () => {
    const store = createStore();
    store.record({ kind: 'booking', payload: 'the old selection' });

    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    store.record({ kind: 'booking', payload: cyclic });

    // Resuming the *previous* selection would be worse than resuming nothing.
    expect(store.peek()).toBeNull();
  });

  it('writes nothing on the server', () => {
    const store = createStore('server');

    // Spec rule 7: a prerendered or server-rendered page never carries one visitor's intent.
    store.record({ kind: 'booking', payload: { shopId: 'shop-1' } });

    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(store.peek()).toBeNull();
  });

  it('reads nothing on the server even when the storage holds an entry', () => {
    sessionStorage.setItem(
      INTENT_KEY,
      JSON.stringify({ version: 1, kind: 'booking', payload: 'x' }),
    );

    expect(createStore('server').peek()).toBeNull();
  });
});

import { TestBed } from '@angular/core/testing';
import { Event, NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { ManagementEntryStore } from './management-entry.store';

describe('ManagementEntryStore', () => {
  let events: Subject<Event>;
  let store: ManagementEntryStore;

  beforeEach(() => {
    events = new Subject<Event>();

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });

    store = TestBed.inject(ManagementEntryStore);
    store.start();
  });

  const start = (url: string) => {
    events.next(new NavigationStart(1, url));
  };

  const end = (url: string, after = url) => {
    events.next(new NavigationEnd(1, url, after));
  };

  it('stays down for a navigation outside the workspace', () => {
    start('/el/barbershops');
    expect(store.entering()).toBe(false);
  });

  it('stays down for an address that only begins like the workspace', () => {
    start('/management-guide');
    expect(store.entering()).toBe(false);
  });

  it('rises on the way into the workspace and falls on arrival', () => {
    start('/management/roles?tab=1');
    expect(store.entering()).toBe(true);

    end('/management/roles?tab=1');
    expect(store.entering()).toBe(false);
  });

  it('stays down for every later page inside the workspace', () => {
    start('/management');
    end('/management', '/management/roles');

    start('/management/services');
    expect(store.entering()).toBe(false);
  });

  it('rises again when the first attempt never arrived', () => {
    start('/management');
    events.next(new NavigationCancel(1, '/management', 'redirected'));
    expect(store.entering()).toBe(false);

    start('/management');
    expect(store.entering()).toBe(true);
  });

  it('adopts a splash the document already painted', () => {
    // A fresh module: the cold path is decided in `start()`, and the shared one already ran it.
    TestBed.resetTestingModule();
    const node = document.createElement('div');
    node.id = 'app-splash';
    document.body.appendChild(node);

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events: new Subject<Event>() } }],
    });
    const cold = TestBed.inject(ManagementEntryStore);
    cold.start();

    // Raised before the first render, so the component draws the splash in the same paint.
    expect(cold.entering()).toBe(true);
    expect(cold.adoptedDocumentSplash()).toBe(true);
    // What is left of the floor, never a fresh one on top of a bootstrap that already outlasted it.
    expect(cold.floorMs()).toBeLessThanOrEqual(500);

    cold.dismissDocumentSplash();
    expect(document.getElementById('app-splash')).toBeNull();
  });

  it('counts an arrival a redirect landed on', () => {
    start('/management');
    // A redirect out of the workspace is not an arrival in it.
    end('/management', '/el/sign-in');

    start('/management');
    expect(store.entering()).toBe(true);
  });
});

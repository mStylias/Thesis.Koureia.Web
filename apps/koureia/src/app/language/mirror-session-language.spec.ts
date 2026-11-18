import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '@auth/data-access';
import { computed, signal } from '@angular/core';
import { vi } from 'vitest';

import { LANGUAGE_COOKIE, UI_LANGUAGE_COOKIE } from '../../language-cookie';
import { MirrorSessionLanguage } from './mirror-session-language';

describe('MirrorSessionLanguage', () => {
  const signedIn = signal(true);
  const claims = signal<{ locale?: string } | null>(null);
  const reload = vi.fn();
  let cookie = '';
  let pathname = '/management';

  function start(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionStore,
          useValue: { isSignedIn: computed(() => signedIn()), claims: claims.asReadonly() },
        },
        {
          provide: DOCUMENT,
          useValue: {
            get cookie(): string {
              return cookie;
            },
            // A browser merges a write into the jar. One entry is enough for these.
            set cookie(value: string) {
              cookie = value.split(';')[0];
            },
            location: {
              protocol: 'https:',
              get pathname(): string {
                return pathname;
              },
              reload,
            },
          },
        },
      ],
    });

    TestBed.inject(MirrorSessionLanguage).start();
    TestBed.tick();
  }

  beforeEach(() => {
    signedIn.set(true);
    claims.set(null);
    cookie = '';
    pathname = '/management';
    reload.mockClear();
  });

  it('writes the account language when the browser has never been told', () => {
    claims.set({ locale: 'en' });
    start();

    expect(cookie).toBe(`${UI_LANGUAGE_COOKIE}=en`);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('leaves a cookie that already agrees alone, so no page reloads for nothing', () => {
    cookie = `${UI_LANGUAGE_COOKIE}=en`;
    claims.set({ locale: 'en' });
    start();

    expect(reload).not.toHaveBeenCalled();
  });

  // The claim is the language the anonymous choice is about to replace.
  it('stands back while an anonymous choice is still being carried to the account', () => {
    cookie = `${LANGUAGE_COOKIE}=en`;
    claims.set({ locale: 'el' });
    start();

    expect(cookie).toBe(`${LANGUAGE_COOKIE}=en`);
    expect(reload).not.toHaveBeenCalled();
  });

  // A language in the path is a statement, and correcting it would undo a followed link.
  it('corrects the cookie but does not reload an address that names its language', () => {
    pathname = '/el/barbershops';
    claims.set({ locale: 'en' });
    start();

    expect(cookie).toBe(`${UI_LANGUAGE_COOKIE}=en`);
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits for the real claims — the sign-in hint carries none', () => {
    start();

    expect(cookie).toBe('');
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing while signed out', () => {
    signedIn.set(false);
    claims.set({ locale: 'en' });
    start();

    expect(cookie).toBe('');
  });
});

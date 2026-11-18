import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import {
  TranslocoService,
  Translation,
  TranslocoLoader,
  provideTransloco,
} from '@jsverse/transloco';
import { ActiveLanguage } from '@util/language';

import { UI_LANGUAGE_COOKIE } from '../../language-cookie';
import { activateBrowserLanguage } from './activate-browser-language';

class SilentTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

describe('activateBrowserLanguage', () => {
  function resolve(cookie: string): string {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: SilentTranslocoLoader,
        }),
        { provide: DOCUMENT, useValue: { cookie } },
      ],
    });

    return TestBed.runInInjectionContext(
      () =>
        activateBrowserLanguage({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as string,
    );
  }

  it('renders the language the account settled on, not the default', () => {
    expect(resolve(`${UI_LANGUAGE_COOKIE}=en`)).toBe('en');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en');
  });

  // The shell's own resolver reads `ActiveLanguage` to build its addresses.
  it('publishes the language it chose', () => {
    resolve(`${UI_LANGUAGE_COOKIE}=en`);

    expect(TestBed.inject(ActiveLanguage).value()).toBe('en');
  });

  it('falls back to Greek when nothing has settled the question', () => {
    expect(resolve('')).toBe('el');
  });

  it('ignores a language the site does not publish', () => {
    expect(resolve(`${UI_LANGUAGE_COOKIE}=fr`)).toBe('el');
  });
});

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  PartialMatchRouteSnapshot,
  RouterStateSnapshot,
  UrlSegment,
  convertToParamMap,
} from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { isObservable, of } from 'rxjs';

import { ActiveLanguage, activateLanguage, languageMatches } from './active-language';

function segments(...paths: readonly string[]): UrlSegment[] {
  return paths.map((path) => new UrlSegment(path, {}));
}

describe('languageMatches', () => {
  /** The guard reads the segments only, so the snapshot is never touched. */
  function matches(...paths: readonly string[]): unknown {
    return TestBed.runInInjectionContext(() =>
      languageMatches({}, segments(...paths), {} as PartialMatchRouteSnapshot),
    );
  }

  it.each(['el', 'en'])('matches %s as a first segment', (language) => {
    expect(matches(language)).toBe(true);
  });

  it('refuses an unknown first segment, so the wildcard can answer it', () => {
    expect(matches('foo')).toBe(false);
  });

  it('refuses a region subtag: `el-GR` is not a published address', () => {
    expect(matches('el-GR')).toBe(false);
  });

  it('refuses the empty URL', () => {
    expect(matches()).toBe(false);
  });

  it('does not look past the first segment', () => {
    expect(matches('barbershops', 'el')).toBe(false);
  });
});

describe('activateLanguage', () => {
  function run(lang: string | null): { active: ActiveLanguage; transloco: TranslocoStub } {
    const transloco = new TranslocoStub();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslocoService, useValue: transloco }],
    });

    const active = TestBed.inject(ActiveLanguage);
    const route = {
      paramMap: convertToParamMap(lang === null ? {} : { lang }),
    } as unknown as ActivatedRouteSnapshot;

    const resolved = TestBed.runInInjectionContext(() =>
      activateLanguage(route, {} as RouterStateSnapshot),
    );
    // The router subscribes, so this test must subscribe too. Without it, a resolver that
    // works only on subscribe passes without running.
    if (isObservable(resolved)) resolved.subscribe();

    return { active, transloco };
  }

  it('sets the language Transloco renders in from the URL segment', () => {
    expect(run('en').transloco.activeLang).toBe('en');
  });

  it('publishes the same language to ActiveLanguage, so links agree with the URL', () => {
    expect(run('en').active.value()).toBe('en');
  });

  it('loads the root dictionary, which the title and the description are read from', () => {
    expect(run('el').transloco.loaded).toEqual(['el']);
  });

  it('sets the language before it loads, so a child resolver cannot read the previous one', () => {
    const { transloco } = run('en');
    expect(transloco.calls).toEqual(['setActiveLang:en', 'load:en']);
  });

  it('falls back to Greek if the parameter is somehow absent', () => {
    expect(run(null).active.value()).toBe('el');
  });
});

class TranslocoStub {
  activeLang = 'el';
  readonly loaded: string[] = [];
  readonly calls: string[] = [];

  setActiveLang(lang: string): void {
    this.activeLang = lang;
    this.calls.push(`setActiveLang:${lang}`);
  }

  load(lang: string) {
    this.loaded.push(lang);
    this.calls.push(`load:${lang}`);
    return of({});
  }
}

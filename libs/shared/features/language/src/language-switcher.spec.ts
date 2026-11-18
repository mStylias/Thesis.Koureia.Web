import { DOCUMENT } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { ActiveLanguage, AppLanguage } from '@util/language';
import { Observable, of } from 'rxjs';

import { LANGUAGE_PREFERENCE, LanguagePreference } from './language-preference';
import { LanguageSwitcher } from './language-switcher';

class StubLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({
  imports: [LanguageSwitcher],
  template: `<lib-language-switcher
    size="sm"
    [reloadUrl]="reloadUrl()"
    [ariaDescribedby]="describedBy()"
    [beforeSwitch]="beforeSwitch()"
  />`,
})
class Host {
  readonly reloadUrl = signal<string | null>(null);
  readonly describedBy = signal('');
  readonly beforeSwitch = signal<(() => Promise<boolean>) | null>(null);
}

/** Records the writes the switcher asks for, and lets a test make one fail or hang. */
class RecordingPreference implements LanguagePreference {
  readonly persisted: AppLanguage[] = [];
  mode: 'resolve' | 'reject' | 'pending' = 'resolve';
  private release?: () => void;

  persist(language: AppLanguage): Promise<void> {
    this.persisted.push(language);
    if (this.mode === 'reject') return Promise.reject(new Error('storage refused'));
    if (this.mode === 'pending') {
      return new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    return Promise.resolve();
  }

  finish(): void {
    this.release?.();
  }
}

describe('LanguageSwitcher', () => {
  let fixture: ComponentFixture<Host>;
  let preference: RecordingPreference;
  let navigations: string[];

  /**
   * A `Proxy` and not a replacement `DOCUMENT`. Angular's renderer injects the same token, so
   * a stub breaks rendering. Every function rebinds to the real document, and only `location`
   * is intercepted.
   */
  function documentWithRecordedNavigation(target: Document, into: string[]): Document {
    // Listed and not spread. `Location` is a class instance, and a spread drops its prototype
    // together with the accessors this stub stands in for.
    const location = {
      href: target.location.href,
      protocol: target.location.protocol,
      pathname: target.location.pathname,
      assign: (url: string) => {
        into.push(url);
      },
      reload: () => {
        into.push('reload');
      },
    };

    return new Proxy(target, {
      get(document, property, receiver) {
        if (property === 'location') return location;

        const value: unknown = Reflect.get(document, property, receiver);
        return typeof value === 'function'
          ? (value as (...args: never[]) => unknown).bind(document)
          : value;
      },
    });
  }

  async function render(
    at: string,
    language: AppLanguage,
    reloadUrl: string | null = null,
  ): Promise<void> {
    navigations = [];
    preference = new RecordingPreference();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: StubLoader,
        }),
        { provide: LANGUAGE_PREFERENCE, useValue: preference },
        {
          provide: DOCUMENT,
          useFactory: () => documentWithRecordedNavigation(document, navigations),
        },
      ],
    });

    TestBed.inject(ActiveLanguage).set(language);
    await TestBed.inject(Router).navigateByUrl(at);

    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.reloadUrl.set(reloadUrl);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function trigger(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="combobox"]',
    );
    if (found === null) throw new Error('trigger not rendered');
    return found;
  }

  /** Drives the select the way the listbox does, because the trigger is a combobox. */
  function choose(language: AppLanguage): void {
    const select = fixture.debugElement.children[0].children[0];
    (select.componentInstance as { value: { set: (v: AppLanguage) => void } }).value.set(language);
  }

  it('shows the language of the page it is on', async () => {
    await render('/en/barbershops', 'en');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('English');
  });

  it('names each language in itself, so it is recognisable to whoever wants it', async () => {
    await render('/el', 'el');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ελληνικά');
  });

  it('swaps the language segment and keeps the page', async () => {
    await render('/el/how-it-works', 'el');

    choose('en');
    await settle();
    await Promise.resolve();

    expect(navigations).toEqual(['/en/how-it-works']);
  });

  it('records the choice before it navigates, not after', async () => {
    await render('/el/how-it-works', 'el');
    preference.mode = 'pending';

    choose('en');
    await settle();
    await Promise.resolve();

    // The write is still in flight, so nothing must navigate yet. Unloading the page here
    // abandons the request.
    expect(preference.persisted).toEqual(['en']);
    expect(navigations).toEqual([]);

    preference.finish();
    await settle();
    await Promise.resolve();

    expect(navigations).toEqual(['/en/how-it-works']);
  });

  it('still switches when the choice cannot be stored', async () => {
    await render('/el', 'el');
    preference.mode = 'reject';

    choose('en');
    await settle();
    await Promise.resolve();

    expect(navigations).toEqual(['/en']);
  });

  it('does nothing when the chosen language is the one already showing', async () => {
    await render('/el/barbershops', 'el');

    choose('el');
    await settle();
    await Promise.resolve();

    expect(preference.persisted).toEqual([]);
    expect(navigations).toEqual([]);
  });

  it('is a full document navigation, because LOCALE_ID cannot follow a router hop', async () => {
    await render('/el', 'el');
    const before = TestBed.inject(Router).url;

    choose('en');
    await settle();
    await Promise.resolve();

    // The router never moved. The document did.
    expect(TestBed.inject(Router).url).toBe(before);
    expect(navigations).toEqual(['/en']);
  });

  it('draws a flag for the selected language', async () => {
    await render('/el', 'el');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('lib-language-flag'),
    ).not.toBeNull();
  });

  it('hides the flag from assistive tech — a flag is a country, not a language', async () => {
    await render('/el', 'el');

    const svg = (fixture.nativeElement as HTMLElement).querySelector('lib-language-flag svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives the trigger no description by default', async () => {
    await render('/el', 'el');

    expect(trigger().hasAttribute('aria-describedby')).toBe(false);
  });

  it('points the trigger at the text that describes it', async () => {
    await render('/el', 'el');
    fixture.componentInstance.describedBy.set('language-hint');
    await settle();

    expect(trigger().getAttribute('aria-describedby')).toBe('language-hint');
  });

  describe('with a check before the switch', () => {
    it('stores and navigates once the check agrees', async () => {
      await render('/el', 'el');
      const check = vi.fn(() => Promise.resolve(true));
      fixture.componentInstance.beforeSwitch.set(check);
      await settle();

      choose('en');
      await settle();
      await Promise.resolve();
      await Promise.resolve();

      expect(check).toHaveBeenCalledOnce();
      expect(preference.persisted).toEqual(['en']);
      expect(navigations).toEqual(['/en']);
    });

    it('stores nothing and keeps the language when the check refuses', async () => {
      await render('/el', 'el');
      fixture.componentInstance.beforeSwitch.set(() => Promise.resolve(false));
      await settle();

      choose('en');
      await settle();
      await Promise.resolve();
      await settle();

      expect(preference.persisted).toEqual([]);
      expect(navigations).toEqual([]);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ελληνικά');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('English');
    });

    it('treats a check that fails as a refusal', async () => {
      await render('/el', 'el');
      fixture.componentInstance.beforeSwitch.set(() => Promise.reject(new Error('closed')));
      await settle();

      choose('en');
      await settle();
      await Promise.resolve();
      await settle();

      expect(preference.persisted).toEqual([]);
      expect(navigations).toEqual([]);
    });
  });

  describe('with a reload address', () => {
    beforeEach(() => {
      // Into the same list as the reload, so a test sees the order of the two.
      vi.spyOn(window.history, 'replaceState').mockImplementation(
        (_state: unknown, _title: string, url?: string | URL | null) => {
          navigations.push(`replace:${String(url)}`);
        },
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('replaces the address, then reloads, instead of swapping the segment', async () => {
      await render('/management/profile', 'el', '/management/profile#preferences');

      choose('en');
      await settle();
      await Promise.resolve();

      expect(preference.persisted).toEqual(['en']);
      expect(navigations).toEqual(['replace:/management/profile#preferences', 'reload']);
    });

    it('reloads only after the choice is stored', async () => {
      await render('/management/profile', 'el', '/management/profile#preferences');
      preference.mode = 'pending';

      choose('en');
      await settle();
      await Promise.resolve();

      expect(navigations).toEqual([]);

      preference.finish();
      await settle();
      await Promise.resolve();

      expect(navigations).toEqual(['replace:/management/profile#preferences', 'reload']);
    });
  });
});

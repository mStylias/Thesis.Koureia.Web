import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Translation,
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { ThemeService, provideBrand } from '@util/brand';
import { provideUiCopy } from '@util/ui-copy';
import { Observable, firstValueFrom, of } from 'rxjs';

import { ThemeToggle } from './theme-toggle';

/**
 * Serves the root dictionary, which this component has no keys in — its own copy arrives
 * through the `themeToggle` scope loader in the component's providers.
 */
class StubLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({
  imports: [ThemeToggle],
  template: `<lib-theme-toggle [ariaLabel]="label()" />`,
})
class Host {
  readonly label = signal('');
}

describe('ThemeToggle', () => {
  let fixture: ComponentFixture<Host>;
  let theme: ThemeService;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * Loads the lib's lazy scope. Order matters: a `TranslocoPipe` has to transform first (it
   * supplies the inline loader `load()` needs), or the service caches an empty translation
   * under the key forever.
   */
  async function loadScope(): Promise<void> {
    await firstValueFrom(TestBed.inject(TranslocoService).load('themeToggle/en'));
    await settle();
  }

  function button(): HTMLButtonElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('button');
    if (!element) throw new Error('toggle button not rendered');
    return element;
  }

  beforeEach(async () => {
    // jsdom does not implement `matchMedia` here, and `ThemeService` reads it to resolve
    // `system`. Reporting "no dark preference" keeps these tests about the control rather
    // than about the OS.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });

    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideBrand({
          id: 'test-brand',
          name: 'Test Brand',
          wordmark: 'test',
          logo: '/logo.png',
          heroImage: '/hero.webp',
          defaultTheme: 'light',
        }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en' },
          loader: StubLoader,
        }),
      ],
    });

    theme = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reports the current theme through aria-pressed, not through its name', async () => {
    expect(button().getAttribute('aria-pressed')).toBe('false');

    theme.set('dark');
    await settle();

    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the same accessible name in both states', async () => {
    const nameWhileLight = button().getAttribute('aria-label');

    theme.set('dark');
    await settle();

    expect(button().getAttribute('aria-label')).toBe(nameWhileLight);
  });

  it('switches the theme when pressed', async () => {
    button().click();
    await settle();

    expect(theme.resolved()).toBe('dark');
  });

  it('switches back, so it is a toggle and not a one-way trip', async () => {
    button().click();
    await settle();
    button().click();
    await settle();

    expect(theme.resolved()).toBe('light');
  });

  it('records a real preference rather than leaving it on `system`', async () => {
    button().click();
    await settle();

    expect(theme.preference()).toBe('dark');
  });

  it('swaps the icon, which is the affordance the name is not', async () => {
    expect(button().querySelector('[lucidesun]')).not.toBeNull();

    theme.set('dark');
    await settle();

    expect(button().querySelector('[lucidemoon]')).not.toBeNull();
  });

  it('lets a consumer override the accessible name', async () => {
    fixture.componentInstance.label.set('Εναλλαγή θέματος');
    await settle();

    expect(button().getAttribute('aria-label')).toBe('Εναλλαγή θέματος');
  });

  it('falls back to the translation when the override is empty', async () => {
    await loadScope();

    expect(button().getAttribute('aria-label')).toBe('Dark theme');
  });
});

describe('ThemeToggle copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    TestBed.configureTestingModule({
      providers: [
        provideBrand({
          id: 'test-brand',
          name: 'Test Brand',
          wordmark: 'test',
          logo: '/logo.png',
          heroImage: '/hero.webp',
          defaultTheme: 'light',
        }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en' },
          loader: StubLoader,
        }),
        provideUiCopy({ 'themeToggle.label': 'customer.themeLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { themeLabel: 'Night mode' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('themeToggle/en'));
    fixture.detectChanges();
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Night mode');
    localStorage.clear();
  });
});

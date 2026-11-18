import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BRAND, BrandConfig } from './brand';
import { ThemeService, THEME_STORAGE_KEY } from './theme';

const BRAND_FIXTURE: BrandConfig = {
  id: 'test',
  name: 'Test',
  wordmark: 'test',
  logo: '/brand/test.png',
  heroImage: '/images/test.webp',
  defaultTheme: 'system',
};

/** Lets a test drive `prefers-color-scheme` and fire changes at listeners. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: prefersDark,
    addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
  };
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  return {
    emit(matches: boolean) {
      query.matches = matches;
      listeners.forEach((cb) => {
        cb({ matches } as MediaQueryListEvent);
      });
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function configure(brand: Partial<BrandConfig> = {}) {
  TestBed.configureTestingModule({
    providers: [{ provide: BRAND, useValue: { ...BRAND_FIXTURE, ...brand } }],
  });
}

function root(): HTMLElement {
  return TestBed.inject(DOCUMENT).documentElement;
}

describe('ThemeService', () => {
  let media: ReturnType<typeof stubMatchMedia>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    media = stubMatchMedia(false);
  });

  it('falls back to the brand default when nothing is stored', () => {
    configure({ defaultTheme: 'dark' });
    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('dark');
  });

  it('prefers a stored choice over the brand default', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    configure({ defaultTheme: 'dark' });

    expect(TestBed.inject(ThemeService).preference()).toBe('light');
  });

  it('ignores a stored value that is not a preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    configure({ defaultTheme: 'light' });

    expect(TestBed.inject(ThemeService).preference()).toBe('light');
  });

  it('writes data-theme for an explicit choice and persists it', () => {
    configure();
    const theme = TestBed.inject(ThemeService);

    theme.set('dark');
    TestBed.tick();

    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('REMOVES data-theme for `system`, handing control to the OS', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    configure();
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(root().getAttribute('data-theme')).toBe('dark');

    theme.set('system');
    TestBed.tick();

    // Absent, and not `data-theme="system"`. The CSS fallback needs it absent.
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('resolves `system` against the OS preference', () => {
    media = stubMatchMedia(true);
    configure({ defaultTheme: 'system' });
    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('system');
    expect(theme.resolved()).toBe('dark');
  });

  it('tracks OS changes while on `system`', () => {
    configure({ defaultTheme: 'system' });
    const theme = TestBed.inject(ThemeService);
    expect(theme.resolved()).toBe('light');

    media.emit(true);

    expect(theme.resolved()).toBe('dark');
  });

  it('stops tracking the OS once an explicit choice is made', () => {
    media = stubMatchMedia(true);
    configure({ defaultTheme: 'system' });
    const theme = TestBed.inject(ThemeService);

    theme.set('light');
    media.emit(true);

    expect(theme.resolved()).toBe('light');
  });

  it('toggles from whatever is currently showing', () => {
    media = stubMatchMedia(true);
    configure({ defaultTheme: 'system' });
    const theme = TestBed.inject(ThemeService);

    // The operating system shows dark, so the first toggle must go to light.
    theme.toggle();
    expect(theme.preference()).toBe('light');

    theme.toggle();
    expect(theme.preference()).toBe('dark');
  });

  it('survives localStorage throwing, as it does in private browsing', () => {
    const denied = () => {
      throw new DOMException('denied');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);

    configure({ defaultTheme: 'light' });
    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('light');
    expect(() => {
      theme.set('dark');
    }).not.toThrow();
    TestBed.tick();
    expect(root().getAttribute('data-theme')).toBe('dark');

    vi.restoreAllMocks();
  });

  it('releases its OS listener on destroy', () => {
    configure();
    TestBed.inject(ThemeService);
    expect(media.listenerCount).toBe(1);

    TestBed.resetTestingModule();

    expect(media.listenerCount).toBe(0);
  });
});

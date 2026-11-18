import { computed, DestroyRef, DOCUMENT, effect, inject, Service, signal } from '@angular/core';
import { BRAND } from './brand';

/** What the visitor asked for. `system` means follow the operating system. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** What the preference resolves to now. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * The localStorage key that holds the visitor's choice.
 *
 * CAUTION: Each app's `index.html` repeats this key in the pre-paint script that prevents a
 * flash of the wrong theme. That script runs before the bundle loads and cannot import from
 * here. Change one and change the other.
 */
export const THEME_STORAGE_KEY = 'ui-theme';

/**
 * Reads and writes the visitor's light/dark choice.
 *
 * The CSS half works without this service. `themes/_dark.scss` keys off `data-theme` on
 * `<html>` and falls back to `prefers-color-scheme` when the attribute is absent, and the
 * Tailwind `dark:` variant mirrors it. This service owns the attribute and remembers the
 * choice.
 *
 * ```ts
 * private readonly theme = inject(ThemeService);
 * this.theme.set('dark');
 * this.theme.resolved();     // 'dark'
 * ```
 *
 * The service is SSR-safe. DOM access goes through `DOCUMENT`, and `localStorage` and
 * `matchMedia` go through `document.defaultView`. A server render has a `defaultView` and
 * carries neither API on it, so `matchDarkScheme` and `readStorage` each guard the API and not
 * the view. On the server the initial value is the brand's `defaultTheme`, because a stored
 * preference is unknowable there.
 */
@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * One field, not the whole `BrandConfig`. A config held in a root singleton hands one
   * request's brand to the next when one deployment serves many domains. A resolved
   * `'light' | 'dark' | 'system'` cannot do that.
   */
  private readonly defaultTheme = inject(BRAND).defaultTheme;

  private readonly window = this.document.defaultView;

  /** The visitor's choice, or the brand default when they made none. */
  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  /** `preference()` with `system` resolved against the OS. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    this.watchSystemPreference();

    // Remove the attribute for `system`. An absent attribute hands control back to
    // `prefers-color-scheme`.
    effect(() => {
      const preference = this.preference();
      const root = this.document.documentElement;
      if (preference === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', preference);
      }
    });
  }

  /** Records a choice and persists it. */
  set(preference: ThemePreference): void {
    this.preference.set(preference);
    this.persist(preference);
  }

  /** Flips between light and dark, starting from what shows now. */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private watchSystemPreference(): void {
    const query = this.matchDarkScheme();
    if (!query) {
      return;
    }
    const onChange = (event: MediaQueryListEvent): void => {
      this.systemPrefersDark.set(event.matches);
    };
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => {
      query.removeEventListener('change', onChange);
    });
  }

  private readStoredPreference(): ThemePreference {
    const stored = this.readStorage();
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return this.defaultTheme;
  }

  private readSystemPrefersDark(): boolean {
    return this.matchDarkScheme()?.matches ?? false;
  }

  /**
   * Test `matchMedia` itself, not only the window it hangs off.
   *
   * The DOM emulation gives a server render a `defaultView` with no media queries on it, so
   * `this.window?.matchMedia(…)` guards the wrong thing and throws during prerendering as soon
   * as anything injects this service.
   */
  private matchDarkScheme(): MediaQueryList | null {
    const view = this.window;
    if (!view || typeof view.matchMedia !== 'function') {
      return null;
    }
    return view.matchMedia('(prefers-color-scheme: dark)');
  }

  /** `localStorage` is a getter that throws in some privacy modes, so guard the access. */
  private readStorage(): string | null {
    try {
      return this.window?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persist(preference: ThemePreference): void {
    try {
      this.window?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private browsing, or storage is full. The choice holds for this page, not a reload.
    }
  }
}

import { DestroyRef, DOCUMENT, inject, Service, signal } from '@angular/core';

import type { ChartTokenName, ChartTokens } from './chart-theme.types';

/** The custom property behind each single-value token. Semantic tokens only. */
const TOKEN_PROPERTIES: Readonly<Record<ChartTokenName, string>> = {
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  border: '--border',
  borderSubtle: '--border-subtle',
  borderStrong: '--border-strong',
  surface: '--surface',
  surfaceOverlay: '--surface-overlay',
  surfaceSunken: '--surface-sunken',
  accent: '--accent',
  success: '--success',
  info: '--info',
  warning: '--warning',
  error: '--error',
  fontSans: '--font-sans',
  fontMono: '--font-mono',
};

const SWATCH_COUNT = 6;

/**
 * The design tokens a chart draws with, as one signal.
 *
 * ```ts
 * import { ChartTheme } from '@ui/chart';
 *
 * private readonly tokens = inject(ChartTheme).tokens;
 * protected readonly option = computed(() => revenueOption(this.data(), this.tokens()));
 * ```
 *
 * It reads the tokens with `getComputedStyle(document.documentElement)` and reads them again
 * when `data-theme` on `<html>` changes or the operating system changes its color scheme. These
 * are the two things that `ThemeService.resolved()` follows. The attribute is watched and not
 * the signal, because the signal changes one effect before `ThemeService` writes the attribute,
 * and a read at that time gets the old colors.
 */
@Service()
export class ChartTheme {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<ChartTokens>(this.read(), { equal: sameTokens });

  /** The tokens now. A new object only when a value changed. */
  readonly tokens = this.state.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    const destroyRef = inject(DestroyRef);
    const refresh = (): void => {
      this.refresh();
    };

    if (view && typeof view.MutationObserver === 'function') {
      const observer = new view.MutationObserver(refresh);
      observer.observe(this.document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    }

    // `system` sets no attribute, so an operating system change shows only here.
    if (view && typeof view.matchMedia === 'function') {
      const query = view.matchMedia('(prefers-color-scheme: dark)');
      query.addEventListener('change', refresh);
      destroyRef.onDestroy(() => {
        query.removeEventListener('change', refresh);
      });
    }
  }

  /** Reads the tokens again. For a change the service cannot see, such as a late stylesheet. */
  refresh(): void {
    this.state.set(this.read());
  }

  private read(): ChartTokens {
    const view = this.document.defaultView;
    // The server has no styles to read. Management renders in the browser only.
    const style =
      view && typeof view.getComputedStyle === 'function'
        ? view.getComputedStyle(this.document.documentElement)
        : null;
    const value = (property: string): string => style?.getPropertyValue(property).trim() ?? '';

    const single = Object.fromEntries(
      Object.entries(TOKEN_PROPERTIES).map(([name, property]) => [name, value(property)]),
    ) as Record<ChartTokenName, string>;

    return {
      ...single,
      scheme: value('color-scheme').includes('dark') ? 'dark' : 'light',
      swatches: Array.from({ length: SWATCH_COUNT }, (_, index) => value(`--swatch-${index + 1}`)),
      durationBase: parseDuration(value('--dur-base')),
    };
  }
}

/** `180ms` or `0.18s` in milliseconds. `0` for anything else. */
function parseDuration(text: string): number {
  const match = /^([\d.]+)(ms|s)$/.exec(text);
  if (!match) {
    return 0;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return match[2] === 's' ? amount * 1000 : amount;
}

function sameTokens(a: ChartTokens, b: ChartTokens): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

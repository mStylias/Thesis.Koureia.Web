import { TestBed } from '@angular/core/testing';

import { ChartTheme } from './chart-theme';
import type { ChartTokens } from './chart-theme.types';
import { chartInkOn, chartSwatch } from './core/chart-colors';
import { buildChartTheme, frameChartOption } from './core/chart-theme-option';

const TOKENS: ChartTokens = {
  scheme: 'light',
  textPrimary: 'rgb(28, 24, 20)',
  textSecondary: 'rgb(90, 80, 70)',
  textMuted: 'rgb(120, 110, 100)',
  border: 'rgb(230, 222, 206)',
  borderSubtle: 'rgb(236, 229, 216)',
  borderStrong: 'rgb(216, 205, 184)',
  surface: 'rgb(255, 255, 255)',
  surfaceOverlay: 'rgb(255, 255, 255)',
  surfaceSunken: 'rgb(243, 238, 228)',
  accent: 'rgb(158, 95, 40)',
  swatches: ['s1', 's2', 's3', 's4', 's5', 's6'],
  success: 'rgb(79, 122, 82)',
  info: 'rgb(70, 112, 140)',
  warning: 'rgb(138, 104, 24)',
  error: 'rgb(178, 59, 54)',
  fontSans: 'Sans',
  fontMono: 'Mono',
  durationBase: 180,
};

const root = document.documentElement;

describe('ChartTheme', () => {
  beforeEach(() => {
    root.removeAttribute('style');
    root.removeAttribute('data-theme');
  });

  it('reads the semantic tokens from the root element', () => {
    root.style.setProperty('--text-primary', 'rgb(10, 10, 10)');
    root.style.setProperty('--surface-sunken', 'rgb(20, 20, 20)');
    root.style.setProperty('--swatch-3', 'rgb(30, 30, 30)');
    root.style.setProperty('--font-sans', 'Alegreya Sans, sans-serif');
    root.style.setProperty('--dur-base', '0.2s');

    const tokens = TestBed.inject(ChartTheme).tokens();

    expect(tokens.textPrimary).toBe('rgb(10, 10, 10)');
    expect(tokens.surfaceSunken).toBe('rgb(20, 20, 20)');
    expect(tokens.swatches).toHaveLength(6);
    expect(tokens.swatches[2]).toBe('rgb(30, 30, 30)');
    expect(tokens.fontSans).toBe('Alegreya Sans, sans-serif');
    expect(tokens.durationBase).toBe(200);
  });

  it('reads again when data-theme changes', async () => {
    root.style.setProperty('--accent', 'rgb(1, 1, 1)');
    const theme = TestBed.inject(ChartTheme);
    expect(theme.tokens().accent).toBe('rgb(1, 1, 1)');

    root.style.setProperty('--accent', 'rgb(2, 2, 2)');
    root.setAttribute('data-theme', 'dark');

    await vi.waitFor(() => {
      expect(theme.tokens().accent).toBe('rgb(2, 2, 2)');
    });
  });

  it('keeps the same object when no token changed', () => {
    const theme = TestBed.inject(ChartTheme);
    const before = theme.tokens();

    theme.refresh();

    expect(theme.tokens()).toBe(before);
  });

  it('gives 0 for a duration it cannot read', () => {
    root.style.setProperty('--dur-base', 'fast');

    expect(TestBed.inject(ChartTheme).tokens().durationBase).toBe(0);
  });
});

describe('chartSwatch', () => {
  it('gives the swatches in order and repeats after the sixth', () => {
    expect(chartSwatch(TOKENS, 0)).toBe('s1');
    expect(chartSwatch(TOKENS, 5)).toBe('s6');
    expect(chartSwatch(TOKENS, 6)).toBe('s1');
    expect(chartSwatch(TOKENS, 13)).toBe('s2');
  });

  it('wraps a negative index and falls back to the accent with no swatches', () => {
    expect(chartSwatch(TOKENS, -1)).toBe('s6');
    expect(chartSwatch({ ...TOKENS, swatches: [] }, 2)).toBe(TOKENS.accent);
  });
});

describe('chartInkOn', () => {
  it('picks the ink with more contrast on the fill', () => {
    expect(chartInkOn(TOKENS, 'rgb(250, 248, 240)')).toBe(TOKENS.textPrimary);
    expect(chartInkOn(TOKENS, 'rgb(40, 50, 60)')).toBe(TOKENS.surface);
  });

  it('works the other way round in a dark theme', () => {
    const dark = { ...TOKENS, textPrimary: 'rgb(244, 238, 226)', surface: 'rgb(31, 26, 20)' };

    expect(chartInkOn(dark, 'rgb(250, 248, 240)')).toBe(dark.surface);
    expect(chartInkOn(dark, 'rgb(40, 50, 60)')).toBe(dark.textPrimary);
  });

  it('falls back to the primary text for a color it cannot parse', () => {
    expect(chartInkOn(TOKENS, 'color-mix(in srgb, red, blue)')).toBe(TOKENS.textPrimary);
  });
});

describe('buildChartTheme', () => {
  it('paints series with the swatches and the tooltip with the surface tokens', () => {
    const theme = buildChartTheme(TOKENS);

    expect(theme['color']).toEqual(TOKENS.swatches);
    expect(theme['tooltip']).toMatchObject({
      backgroundColor: TOKENS.surfaceOverlay,
      borderColor: TOKENS.border,
      textStyle: { color: TOKENS.textPrimary, fontFamily: TOKENS.fontSans },
    });
    expect(theme['darkMode']).toBe(false);
    expect(buildChartTheme({ ...TOKENS, scheme: 'dark' })['darkMode']).toBe(true);
  });

  it('sizes the tooltip text and padding with tokens, so the text follows the browser font size', () => {
    const tooltip = buildChartTheme(TOKENS)['tooltip'] as {
      padding?: unknown;
      textStyle: Record<string, unknown>;
      extraCssText: string;
    };

    expect(tooltip.padding).toBeUndefined();
    expect(tooltip.textStyle['fontSize']).toBeUndefined();
    expect(tooltip.extraCssText).toContain('padding: var(--space-2) var(--space-3)');
    expect(tooltip.extraCssText).toContain('font-size: var(--text-sm)');
    expect(tooltip.extraCssText).toContain('line-height: var(--leading-snug)');
  });

  it('keeps the grid tight: the top holds a y-axis label, not a legend row', () => {
    expect(buildChartTheme(TOKENS)['grid']).toEqual({ left: 4, right: 12, top: 12, bottom: 4 });
  });
});

describe('frameChartOption', () => {
  const frame = { ariaLabel: 'Revenue', durationBase: 180, reducedMotion: false };

  it('lets the consumer set its own duration', () => {
    const option = frameChartOption({ animationDuration: 400 }, frame);

    expect(option.animationDuration).toBe(400);
    expect(option.animationEasing).toBe('cubicOut');
  });

  it('keeps the animation off under reduced motion, whatever the option says', () => {
    const option = frameChartOption({ animation: true }, { ...frame, reducedMotion: true });

    expect(option.animation).toBe(false);
  });

  it('keeps the consumer aria settings and replaces the description', () => {
    const option = frameChartOption(
      { aria: { decal: { show: true }, label: { description: 'Old' } } },
      frame,
    );

    expect(option['aria']).toEqual({
      decal: { show: true },
      enabled: true,
      label: { description: 'Revenue' },
    });
  });
});

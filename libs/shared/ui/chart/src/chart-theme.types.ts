/**
 * The design tokens a chart draws with, read from the page and resolved to values ECharts can
 * paint. ECharts writes SVG attributes, and an SVG attribute cannot read `var(--…)`.
 *
 * A plain object, so a pure option builder can take it as an argument and a spec can build one
 * without a DOM.
 */
export interface ChartTokens {
  /** The theme that shows now. It sets ECharts' `darkMode`. */
  readonly scheme: 'light' | 'dark';
  /** `--text-primary`. Values and tooltip text. */
  readonly textPrimary: string;
  /** `--text-secondary`. Axis labels and the legend. */
  readonly textSecondary: string;
  /** `--text-muted`. A legend entry that is off, and the neutral status. */
  readonly textMuted: string;
  /** `--border`. The tooltip edge. */
  readonly border: string;
  /** `--border-subtle`. Gridlines. */
  readonly borderSubtle: string;
  /** `--border-strong`. Axis lines and the axis pointer. */
  readonly borderStrong: string;
  /** `--surface`. The ground of a card, and the gap between touching marks. */
  readonly surface: string;
  /** `--surface-overlay`. The tooltip ground. */
  readonly surfaceOverlay: string;
  /** `--surface-sunken`. The low end of a sequential ramp. */
  readonly surfaceSunken: string;
  /** `--accent`. The high end of a sequential ramp, and a single series. */
  readonly accent: string;
  /** `--swatch-1` to `--swatch-6`, in order. Series that must be told apart and are no state. */
  readonly swatches: readonly string[];
  /** `--success`. */
  readonly success: string;
  /** `--info`. */
  readonly info: string;
  /** `--warning`. */
  readonly warning: string;
  /** `--error`. */
  readonly error: string;
  /** `--font-sans`. Every chart text. */
  readonly fontSans: string;
  /** `--font-mono`. Tabular figures, when a consumer wants them. */
  readonly fontMono: string;
  /** `--dur-base` in milliseconds. The length of the entrance. `0` when the token is absent. */
  readonly durationBase: number;
}

/** A `ChartTokens` field that holds one color or font, read from one custom property. */
export type ChartTokenName = Exclude<keyof ChartTokens, 'scheme' | 'swatches' | 'durationBase'>;

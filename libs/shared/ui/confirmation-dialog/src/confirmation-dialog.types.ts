/**
 * Semantic color. Mirrors the design system's button severities and
 * drives both the icon badge and the confirm button.
 */
export type ConfirmationSeverity =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

/**
 * How the dialog was closed:
 * - `confirmed` — the confirm button
 * - `cancelled` — the cancel button
 * - `dismissed` — the × button, Escape, or a backdrop click
 *   (only possible when `dismissible: true`)
 */
export type ConfirmationResult = 'confirmed' | 'cancelled' | 'dismissed';

export interface ConfirmationConfig {
  /** Defaults to a translated "Confirm action"; `''` drops the heading. */
  title?: string;
  /** Defaults to a translated confirmation question; `''` drops it. */
  message?: string;
  /** Colors the icon and the confirm button. Defaults to `warning`. */
  severity?: ConfirmationSeverity;
  /** Whether to show the severity icon badge. */
  showIcon?: boolean;
  /** Defaults to a translated "Confirm". */
  confirmLabel?: string;
  /** Defaults to a translated "Cancel". */
  cancelLabel?: string;
  /** Hide to get an acknowledge-only dialog with a single button. */
  showCancel?: boolean;
  /** When `true`, shows a × button and allows Escape / backdrop-click close. */
  dismissible?: boolean;
}

/**
 * Config with every *behavioral* field filled in from the defaults. The
 * copy stays optional — the dialog falls back to its own translations, so
 * the defaults never have to hardcode a language.
 */
export type ResolvedConfirmationConfig = ConfirmationConfig &
  Required<Pick<ConfirmationConfig, 'severity' | 'showIcon' | 'showCancel' | 'dismissible'>>;

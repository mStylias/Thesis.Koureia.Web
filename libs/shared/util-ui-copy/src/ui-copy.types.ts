/**
 * Replacement keys for a shared control's own copy, keyed by the control's key.
 *
 * ```ts
 * { 'timePicker.placeholder': 'uiCopy.timePicker.placeholder' }
 * ```
 *
 * A value is a translation key, not text, so one override serves every language.
 */
export type UiCopyOverrides = Readonly<Record<string, string>>;

/** Maps a control's own key to the key the consumer wants read in its place. */
export type UiCopyResolver = (key: string) => string;

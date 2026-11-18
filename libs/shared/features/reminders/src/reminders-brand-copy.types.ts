/**
 * The reminders copy that names the brand. This library does not own it.
 *
 * Greek needs the article and the case of the name, so a `{{brand}}` placeholder cannot work. The
 * app keeps these strings in its root dictionary under `brand.reminders.*`, in every language.
 *
 * ```ts
 * // apps/<app>/src/app/i18n/el.ts
 * const reminders: RemindersBrandCopy = { iphoneLine: '…', openFromHomeScreen: '…' };
 * const el: Translation = { brand: { landing, reminders } };
 * ```
 */
export interface RemindersBrandCopy {
  /** Push on an iPhone needs the Home Screen app. The card and Settings show it. */
  readonly iphoneLine: string;
  /** The guide's third iPhone step: open the app from its Home Screen icon. */
  readonly openFromHomeScreen: string;
}

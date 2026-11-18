import type { ThemePreference } from '@util/brand';

/**
 * The value of the `ui_preferences` user resource. The API never reads inside it, so every member
 * is this app's own contract. Later preferences join the same object.
 */
export interface UiPreferencesValue {
  readonly theme?: ThemePreference;
}

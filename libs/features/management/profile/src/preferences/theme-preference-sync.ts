import { inject, Service } from '@angular/core';
import { UserResourcesApi } from '@api/user-resources';
import { ThemeService, type ThemePreference } from '@util/brand';
import { firstValueFrom } from 'rxjs';

import type { UiPreferencesValue } from './theme-preference-sync.types';

/** The user resource that holds the account's interface preferences. */
export const UI_PREFERENCES_RESOURCE = 'ui_preferences';

/**
 * Keeps the theme on the account, so every device where the person opens management shows it.
 *
 * `ManagementShell` provides it and calls {@link sync} once. The Preferences card injects the same
 * instance and calls {@link save}. The theme itself stays in `ThemeService`, which writes
 * `localStorage`, so the public pages of this browser follow it too.
 */
@Service({ autoProvided: false })
export class ThemePreferenceSync {
  private readonly api = inject(UserResourcesApi);
  private readonly theme = inject(ThemeService);

  /** Set by the first {@link save}. A sync answer that arrives after it must not undo it. */
  private chosen = false;

  /** Saves run one after another, so two quick choices cannot create two resources. */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Applies the account's theme when it differs from this browser's. The account wins. No stored
   * value changes nothing and writes nothing. A failed read changes nothing and shows nothing.
   */
  async sync(): Promise<void> {
    let stored: ThemePreference | null;
    try {
      const found = await firstValueFrom(
        this.api.findByName<UiPreferencesValue>(UI_PREFERENCES_RESOURCE),
      );
      stored = readTheme(found?.value);
    } catch {
      return;
    }
    if (stored === null || this.chosen) return;
    if (stored !== this.theme.preference()) this.theme.set(stored);
  }

  /**
   * Stores `theme` on the account. Creates the resource when it is absent, otherwise replaces its
   * whole value and keeps the other members. Resolves `false` when the write fails.
   */
  save(theme: ThemePreference): Promise<boolean> {
    this.chosen = true;
    const run = this.queue.then(() => this.write(theme));
    this.queue = run;
    return run;
  }

  private async write(theme: ThemePreference): Promise<boolean> {
    try {
      const found = await firstValueFrom(
        this.api.findByName<UiPreferencesValue>(UI_PREFERENCES_RESOURCE),
      );
      if (found === null) {
        await firstValueFrom(
          this.api.create<UiPreferencesValue>({ name: UI_PREFERENCES_RESOURCE, value: { theme } }),
        );
      } else {
        await firstValueFrom(
          this.api.patch<UiPreferencesValue>(found.id, {
            value: { ...asObject(found.value), theme },
          }),
        );
      }
      return true;
    } catch {
      return false;
    }
  }
}

/** The stored theme, or `null` when the value holds none this app knows. */
function readTheme(value: unknown): ThemePreference | null {
  const theme = asObject(value)['theme'];
  return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : null;
}

/** The stored JSON as an object. Anything else, such as a value from an old build, is empty. */
function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

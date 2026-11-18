import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageSwitcher } from '@features/language';
import { RadioGroup, type RadioOption } from '@ui/radio-group';
import { ToasterService } from '@ui/toaster';
import { ThemeService, type ThemePreference } from '@util/brand';
import { PageEditors, PageSection } from '@features/management-shared-page-sections';

import { ThemePreferenceSync } from './theme-preference-sync';

const K = 'managementProfile.preferences';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Where the language switch reloads to: this page, opened at this card. */
const RELOAD_URL = '/management/profile#preferences';

/**
 * The Preferences card: the theme and the language. Both save on change, with no Save button.
 *
 * The theme applies at once on this browser and then saves to the account in the background.
 * The language reloads the page, because `LOCALE_ID` is fixed at bootstrap. With unsaved edits
 * in another card, the page asks first. A kept edit stops the switch before anything is stored.
 */
@Component({
  selector: 'lib-profile-preferences',
  imports: [LanguageSwitcher, PageSection, RadioGroup, TranslocoPipe],
  templateUrl: './profile-preferences.html',
  styleUrl: './profile-preferences.scss',
})
export class ProfilePreferences {
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly sync = inject(ThemePreferenceSync);
  protected readonly theme = inject(ThemeService);

  private readonly editors = inject(PageEditors);

  protected readonly reloadUrl = RELOAD_URL;

  protected readonly canSwitch = (): Promise<boolean> => this.editors.canLeave();

  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly themeOptions = computed<readonly RadioOption<ThemePreference>[]>(() => {
    this.language();
    return THEMES.map((value) => ({
      value,
      label: this.transloco.translate(`${K}.theme.${value}`),
    }));
  });

  protected async chooseTheme(theme: ThemePreference | null): Promise<void> {
    if (theme === null || theme === this.theme.preference()) return;
    this.theme.set(theme);
    if (!(await this.sync.save(theme))) {
      this.toaster.error(this.transloco.translate(`${K}.theme.saveFailed`));
    }
  }
}

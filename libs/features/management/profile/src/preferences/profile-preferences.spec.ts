import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { ToasterService } from '@ui/toaster';
import { ThemeService, type ThemePreference } from '@util/brand';
import { Observable, of } from 'rxjs';
import { PageEditors } from '@features/management-shared-page-sections';

import { ProfilePreferences } from './profile-preferences';
import { ThemePreferenceSync } from './theme-preference-sync';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const preference = signal<ThemePreference>('system');
const theme = {
  preference,
  set: vi.fn((value: ThemePreference) => {
    preference.set(value);
  }),
};
const sync = { save: vi.fn<(theme: ThemePreference) => Promise<boolean>>() };
const toaster = { success: vi.fn(), error: vi.fn() };
const editors = { canLeave: vi.fn(() => Promise.resolve(false)) };

describe('ProfilePreferences', () => {
  let fixture: ComponentFixture<ProfilePreferences>;

  beforeEach(async () => {
    vi.clearAllMocks();
    preference.set('system');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        { provide: ThemeService, useValue: theme },
        { provide: ThemePreferenceSync, useValue: sync },
        { provide: ToasterService, useValue: toaster },
        { provide: PageEditors, useValue: editors },
      ],
    });
    fixture = TestBed.createComponent(ProfilePreferences);
    await fixture.whenStable();
  });

  function radio(value: ThemePreference): HTMLInputElement {
    const index = (['light', 'dark', 'system'] as const).indexOf(value);
    const found = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        'input[type="radio"]',
      ),
    ).at(index);
    if (found === undefined) throw new Error(`${value} not rendered`);
    return found;
  }

  async function pick(value: ThemePreference): Promise<void> {
    radio(value).click();
    await fixture.whenStable();
    await Promise.resolve();
  }

  it('offers three themes and selects the one in force', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('input[type="radio"]'),
    ).toHaveLength(3);
    expect(radio('system').checked).toBe(true);
  });

  it('applies a choice at once, then saves it to the account', async () => {
    let finish: (saved: boolean) => void = () => undefined;
    sync.save.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    );

    await pick('dark');

    // The save is still pending here.
    expect(theme.set).toHaveBeenCalledWith('dark');
    expect(preference()).toBe('dark');
    expect(sync.save).toHaveBeenCalledWith('dark');

    finish(true);
    await fixture.whenStable();
    await Promise.resolve();

    expect(theme.set).toHaveBeenCalledOnce();
    expect(toaster.error).not.toHaveBeenCalled();
  });

  it('keeps the theme and says so when the account save fails', async () => {
    sync.save.mockResolvedValue(false);

    await pick('dark');

    expect(preference()).toBe('dark');
    expect(toaster.error).toHaveBeenCalledWith('managementProfile.preferences.theme.saveFailed');
  });

  it('reloads this page at the card after a language change', () => {
    const switcher = (fixture.nativeElement as HTMLElement).querySelector('lib-language-switcher');

    expect(switcher).not.toBeNull();
    expect(
      (
        fixture.debugElement.query((node) => node.name === 'lib-language-switcher')
          .componentInstance as { reloadUrl: () => string | null }
      ).reloadUrl(),
    ).toBe('/management/profile#preferences');
  });

  it('links the language hint to the selector', () => {
    const page = fixture.nativeElement as HTMLElement;
    const hint = page.querySelector('#preferences-language-hint');
    const selector = page.querySelector('lib-language-switcher [role="combobox"]');

    expect(hint?.textContent).toContain('managementProfile.preferences.language.hint');
    expect(selector?.getAttribute('aria-describedby')).toBe('preferences-language-hint');
  });

  it("asks the page's editors before a language switch", async () => {
    const switcher = fixture.debugElement.query((node) => node.name === 'lib-language-switcher')
      .componentInstance as { beforeSwitch: () => (() => Promise<boolean>) | null };

    const check = switcher.beforeSwitch();
    if (check === null) throw new Error('no check passed');

    expect(await check()).toBe(false);
    expect(editors.canLeave).toHaveBeenCalledOnce();
  });

  it('is the section the fragment opens', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('#preferences')).not.toBeNull();
  });
});

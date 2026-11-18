import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  Select,
  SelectOption,
  SelectOptionTemplate,
  SelectSize,
  SelectedItemTemplate,
} from '@ui/select';
import { APP_LANGUAGES, ActiveLanguage, AppLanguage, swapLanguageInPath } from '@util/language';

import { LANGUAGE_PREFERENCE } from './language-preference';
import { languageTranslocoScope } from './language-switcher.i18n';
import { LanguageFlag } from './flags/language-flag';

/**
 * Moves the visitor to the same page in another language.
 *
 * ```html
 * <lib-language-switcher size="sm" />
 * ```
 *
 * The target is a path-segment swap: `/el/how-it-works` becomes `/en/how-it-works`. Nothing
 * is looked up, because both languages share one set of English slugs, the same property that
 * lets one route table serve both. Translated slugs would make this a per-language map.
 *
 * The switch navigates the document and not the router, so it is a full page load. `LOCALE_ID`
 * is a DI value fixed at bootstrap. Angular's date and number pipes read it, and it does not
 * follow Transloco, so the two stay in step only when the new language arrives in a new
 * injector. A `router.navigateByUrl` here leaves a Greek page formatting American dates, and
 * nothing throws.
 *
 * The names are endonyms, «Ελληνικά» and not «Greek». A person finds their own language by its
 * name in that language. That is also why these two strings are not in the dictionaries: they
 * are the same in every translation of this component.
 *
 * Two `<a href>` elements would work without JavaScript and a crawler would follow them. A
 * combobox does neither. Discovery still works, because every public page carries reciprocal
 * `hreflang` alternates that name both languages, and that is the signal a crawler reads. What
 * this gives up is the switch without JavaScript.
 */
@Component({
  selector: 'lib-language-switcher',
  imports: [LanguageFlag, Select, SelectOptionTemplate, SelectedItemTemplate],
  providers: [provideTranslocoScope(languageTranslocoScope)],
  template: `
    <lib-select
      [options]="options"
      [value]="selected()"
      [size]="size()"
      [loading]="switching()"
      [ariaLabel]="label()"
      [ariaDescribedby]="ariaDescribedby()"
      (valueChange)="choose($event)"
    >
      <!--
        The flag goes in both slots, so the closed trigger shows what the list offered. The row
        wrapper gives the pair its gap and puts the flag on the center line of the text. The
        select's own value slot is inside its encapsulation and nothing here can reach it.
      -->
      <ng-template libSelectedItem let-option>
        <span class="language-row">
          <lib-language-flag [language]="option.value" />
          <span>{{ option.label }}</span>
        </span>
      </ng-template>
      <ng-template libSelectOption let-option>
        <span class="language-row">
          <lib-language-flag [language]="option.value" />
          <span>{{ option.label }}</span>
        </span>
      </ng-template>
    </lib-select>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    /*
     * Content width. The library default minimum suits a field in a form column and leaves
     * this one floating in empty space. Sizing to the text is safe because a switch is a full
     * page load, so nobody sees the trigger resize between the two endonyms.
     */
    lib-select {
      --select-min-width: 0;
    }

    /*
     * Block-level flex, not inline-flex. An inline-level box sits on the text baseline of the
     * slot it is projected into, and the line box then reserves the font descender space under
     * it, which made the trigger 2.4px taller than a button of the same size beside it in the
     * header. A block-level flex box joins no inline formatting, so the row is as tall as its
     * contents and the two controls line up.
     */
    .language-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
  `,
})
export class LanguageSwitcher {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(ActiveLanguage);
  // Optional. Without a provider the switch still works, and it does not persist.
  private readonly preference = inject(LANGUAGE_PREFERENCE, { optional: true });

  /** Matches the surrounding controls. `sm` in a header. */
  readonly size = input<SelectSize>('md');

  /** Overrides the translated accessible name. Falls back to the translation when empty. */
  readonly ariaLabel = input('');

  /** Ids of text that describes the choice, such as a hint beside the switcher. */
  readonly ariaDescribedby = input('');

  /**
   * Asked before anything is stored. `false` keeps the current language and stores nothing.
   *
   * A page with unsaved edits passes its leave check, so a refused reload does not leave the
   * account in one language and the page in another.
   *
   * ```html
   * <lib-language-switcher [beforeSwitch]="canLeave" />
   * ```
   */
  readonly beforeSwitch = input<(() => Promise<boolean>) | null>(null);

  /**
   * The address to reload after the choice is stored. `null` swaps the language segment.
   *
   * Language-free pages pass their own address. The segment swap would send them to
   * `/{lang}/…`, which does not exist.
   *
   * ```html
   * <lib-language-switcher reloadUrl="/management/profile#preferences" />
   * ```
   */
  readonly reloadUrl = input<string | null>(null);

  /**
   * The accessible name, resolved in the class rather than by a `| transloco` in the
   * template.
   *
   * A pipe in a binding on the `<lib-select>` element resolves its scope through that
   * element's injector, so it waits on the select library's dictionary and not this
   * component's, and it emits nothing until that unrelated chunk arrives. The server render is
   * one shot, so that shipped a combobox with no accessible name. Naming the scope here ties
   * the name to the dictionary that holds it.
   *
   * The key has no prefix. Passing the scope object puts `language.` in front of it.
   */
  private readonly translatedLabel = toSignal(
    inject(TranslocoService).selectTranslate<string>('label', {}, languageTranslocoScope),
    { initialValue: '' },
  );

  protected readonly label = computed(() => this.ariaLabel() || this.translatedLabel());

  protected readonly options: readonly SelectOption<AppLanguage>[] = APP_LANGUAGES.map(
    (language) => ({ label: ENDONYMS[language], value: language }),
  );

  protected readonly active = computed(() => this.language.value());

  /** What the select shows. A refused switch sets it back, so the select drops the choice. */
  protected readonly selected = linkedSignal(() => this.active());

  protected readonly switching = signal(false);

  protected choose(language: AppLanguage | undefined): void {
    if (language === undefined || language === this.language.value()) return;

    this.selected.set(language);
    this.switching.set(true);
    void this.switchTo(language);
  }

  private async switchTo(language: AppLanguage): Promise<void> {
    const beforeSwitch = this.beforeSwitch();
    // A check that fails counts as a refusal.
    if (beforeSwitch !== null && !(await beforeSwitch().catch(() => false))) {
      this.selected.set(this.active());
      this.switching.set(false);
      return;
    }

    // Await before navigating. The write is a request, and unloading the page in flight
    // leaves the preference behind while the URL moves on.
    try {
      await this.preference?.persist(language);
    } catch {
      // A preference that does not save is no reason to refuse the switch. The person gets
      // the language, and the app does not remember it.
    }

    const reloadUrl = this.reloadUrl();
    if (reloadUrl === null) {
      this.document.location.assign(swapLanguageInPath(this.router.url, language));
      return;
    }
    // An `assign` to the same path with another fragment only scrolls. Replace, then reload.
    this.document.defaultView?.history.replaceState(null, '', reloadUrl);
    this.document.location.reload();
  }
}

/**
 * Each language's name in itself. These strings stay out of the dictionaries, which would hold
 * the same two values in every language and invite a translator to correct one.
 */
const ENDONYMS: Record<AppLanguage, string> = {
  el: 'Ελληνικά',
  en: 'English',
};

/**
 * The strip on its own, over a host that is nothing but a state signal.
 *
 * The datagrid's spec proves the two things that need a grid: that the
 * document is read before the first query, and that the toolbar's headroom
 * drives the shape. Here the strip is proven host-agnostic.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { Tooltip } from '@ui/tooltip';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import {
  SAVED_VIEWS_VERSION,
  SavedViewsController,
  memorySavedViewsStorage,
} from '@ui/saved-views/core';
import type { SavedViewsDocument, SavedViewsLayout } from '@ui/saved-views/core';
import { SavedViews } from './saved-views';

/** The host's state: one word. */
interface Word {
  readonly text: string;
}

function isWord(value: unknown): value is Word {
  return typeof value === 'object' && value !== null && typeof (value as Word).text === 'string';
}

function document(...names: string[]): SavedViewsDocument<unknown> {
  return {
    version: SAVED_VIEWS_VERSION,
    views: names.map((name, index) => ({
      id: `view-${index.toString()}`,
      name,
      state: { text: name.toLowerCase() },
    })),
  };
}

@Component({
  selector: 'lib-saved-views-host',
  imports: [SavedViews],
  template: `<lib-saved-views [controller]="controller" [layout]="layout()" />`,
})
class Host {
  readonly word = signal<Word>({ text: '' });
  readonly layout = signal<SavedViewsLayout>('auto');
  storage = memorySavedViewsStorage();
  readonly controller = new SavedViewsController<Word>({
    key: () => 'words_views',
    storage: () => this.storage,
    state: () => this.word(),
    apply: (state) => {
      this.word.set(state);
    },
    isDestroyed: () => false,
    isState: isWord,
    statesEqual: (a, b) => a.text === b.text,
  });
}

describe('SavedViews', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
      this.open = false;
    };
  });

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let pass = 0; pass < 3; pass += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function createHost(stored: SavedViewsDocument<unknown>): Promise<ComponentFixture<Host>> {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    // Both dictionaries before the first render. The default loader answers
    // synchronously, and a load the pipe triggers mid-render would then write
    // the strip's `translations` signal inside that render.
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('savedViews/en'));
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    host.storage = memorySavedViewsStorage({ words_views: stored });
    // What a host does with the answer: start in the default view.
    const initial = await host.controller.load('words_views');
    if (initial !== null) {
      host.word.set(initial);
    }
    await settle(fixture);
    return fixture;
  }

  function root(fixture: ComponentFixture<Host>): HTMLElement {
    return fixture.debugElement.nativeElement as HTMLElement;
  }

  function tabs(fixture: ComponentFixture<Host>): HTMLElement[] {
    return [...root(fixture).querySelectorAll<HTMLElement>('[data-view-id]')];
  }

  function names(fixture: ComponentFixture<Host>): (string | undefined)[] {
    return tabs(fixture).map((tab) => tab.querySelector('.sv-tab-name')?.textContent.trim());
  }

  it('draws one tab per view and applies the first, whatever the state is', async () => {
    const fixture = await createHost(document('Busy', 'Quiet'));

    expect(names(fixture)).toEqual(['Busy', 'Quiet']);
    expect(fixture.componentInstance.word()).toEqual({ text: 'busy' });
  });

  it('is a tablist with one tab stop, so Tab leaves the strip', async () => {
    const fixture = await createHost(document('Busy', 'Quiet'));

    expect(root(fixture).querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs(fixture).map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1']);
  });

  it('drops a stored view whose state the host cannot read', async () => {
    const fixture = await createHost({
      version: SAVED_VIEWS_VERSION,
      views: [
        { id: 'a', name: 'Words', state: { text: 'words' } },
        { id: 'b', name: 'Columns', state: { columns: [] } },
      ],
    });

    expect(names(fixture)).toEqual(['Words']);
  });

  it('reports dirty through the host comparison and reverts through the host apply', async () => {
    const fixture = await createHost(document('Busy'));
    const host = fixture.componentInstance;

    host.word.set({ text: 'changed' });
    await settle(fixture);
    expect(tabs(fixture).at(0)?.querySelector('.sv-tab-dirty')).not.toBeNull();

    host.controller.revertChanges();
    await settle(fixture);
    expect(host.word()).toEqual({ text: 'busy' });
    expect(tabs(fixture).at(0)?.querySelector('.sv-tab-dirty')).toBeNull();
  });

  describe('a temporary view', () => {
    const TEMPORARY = { id: 'temporary', name: 'Γιώργος', state: { text: 'customer' } };

    function temporaryTab(fixture: ComponentFixture<Host>): HTMLElement {
      const found = root(fixture).querySelector<HTMLElement>('[data-temporary-id]');
      if (found == null) {
        throw new Error('temporary tab not rendered');
      }
      return found;
    }

    it('is drawn after the stored views, out of the set a drag reorders', async () => {
      const fixture = await createHost(document('Busy', 'Quiet'));
      fixture.componentInstance.controller.openTemporary(TEMPORARY);
      await settle(fixture);

      const all = [...root(fixture).querySelectorAll<HTMLElement>('[role="tab"]')];
      expect(all.at(-1)).toBe(temporaryTab(fixture));
      expect(temporaryTab(fixture).hasAttribute('data-view-id')).toBe(false);
      expect(temporaryTab(fixture).getAttribute('aria-selected')).toBe('true');
      expect(temporaryTab(fixture).querySelector('.sv-tab-default')).toBeNull();
    });

    it('says in words that it was created automatically', async () => {
      const fixture = await createHost(document('Busy'));
      fixture.componentInstance.controller.openTemporary(TEMPORARY);
      await settle(fixture);

      const note = temporaryTab(fixture)
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => root(fixture).querySelector(`[id="${id}"]`)?.textContent.trim());
      // This spec loads no dictionary, so the note renders its key.
      expect(note).toContain('savedViews.temporary');
      expect(temporaryTab(fixture).querySelector('.sv-tab-temporary')).not.toBeNull();
    });

    it('explains its mark in the library tooltip, not a native title', async () => {
      const fixture = await createHost(document('Busy'));
      fixture.componentInstance.controller.openTemporary(TEMPORARY);
      await settle(fixture);

      const mark = temporaryTab(fixture).querySelector('.sv-tab-temporary');
      expect(mark?.hasAttribute('title')).toBe(false);
      expect(getDebugNode(mark)?.injector.get(Tooltip).libTooltip()).toBe('savedViews.temporary');
      expect(root(fixture).querySelector('[title]')).toBeNull();
    });

    it('offers no save, only revert, when it has changed', async () => {
      const fixture = await createHost(document('Busy'));
      const host = fixture.componentInstance;
      host.controller.openTemporary(TEMPORARY);
      host.word.set({ text: 'changed' });
      await settle(fixture);

      const tooltips = [...temporaryTab(fixture).querySelectorAll('.sv-tab-action')].map((button) =>
        getDebugNode(button)?.injector.get(Tooltip).libTooltip(),
      );
      expect(tooltips).toEqual(['savedViews.discardChanges']);
    });

    it('closes from its ×, with no confirmation, back to the default', async () => {
      const fixture = await createHost(document('Busy', 'Quiet'));
      const host = fixture.componentInstance;
      host.controller.openTemporary(TEMPORARY);
      await settle(fixture);

      temporaryTab(fixture).querySelector<HTMLElement>('.sv-tab-remove')?.click();
      await settle(fixture);

      expect(root(fixture).querySelector('[data-temporary-id]')).toBeNull();
      expect(host.word()).toEqual({ text: 'busy' });
      expect(names(fixture)).toEqual(['Busy', 'Quiet']);
    });

    it('does not move under Ctrl+arrow, and the last stored view does not pass it', async () => {
      const fixture = await createHost(document('Busy', 'Quiet'));
      const host = fixture.componentInstance;
      host.controller.openTemporary(TEMPORARY);
      await settle(fixture);

      const press = (element: HTMLElement, key: string): void => {
        element.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true }));
      };
      press(temporaryTab(fixture), 'ArrowLeft');
      press(tabs(fixture)[1], 'ArrowRight');
      await settle(fixture);

      expect(names(fixture)).toEqual(['Busy', 'Quiet']);
      const all = [...root(fixture).querySelectorAll<HTMLElement>('[role="tab"]')];
      expect(all.at(-1)).toBe(temporaryTab(fixture));
    });
  });

  it('is the strip under auto with no headroom provided', async () => {
    const fixture = await createHost(document('Busy'));

    expect(root(fixture).querySelector('[role="tablist"]')).not.toBeNull();
    expect(root(fixture).querySelector('.sv-select')).toBeNull();
  });

  it('takes the compact form when the host says so', async () => {
    const fixture = await createHost(document('Busy'));

    fixture.componentInstance.layout.set('compact');
    await settle(fixture);

    expect(root(fixture).querySelector('[role="tablist"]')).toBeNull();
    expect(root(fixture).querySelector('.sv-select')).not.toBeNull();
    expect(root(fixture).querySelector('.sv-menu-trigger')).not.toBeNull();
  });

  // The long sentence is the wide form's empty state. In the field it never
  // fitted: 239px of Greek in 106px of room, so it arrived as an ellipsis
  // against the menu glyph. English measured 129px, which is why only Greek
  // showed it.
  it('places a short placeholder in the field, not the sentence the wide form uses', () => {
    const template = readFileSync(join(process.cwd(), 'src/saved-views.html'), 'utf8');

    expect(template).toContain('[placeholder]="\'savedViews.emptyField\' | uiCopy | transloco"');
    expect(template).toContain('<p class="sv-empty">{{ \'savedViews.empty\'');
  });

  it('fixes the width of the field, so the inset is not paid for out of the text', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/saved-views.scss'), 'utf8');
    const shell = stylesheet.slice(stylesheet.indexOf('.sv-select-shell {'));

    expect(shell.slice(0, shell.indexOf('}'))).toContain('width: 11rem');
    expect(shell.slice(0, shell.indexOf('}'))).not.toContain('min-width: 0');
  });

  // The Greek placeholder is half again the length of the English one, and it
  // ran under the menu glyph drawn over the field. The clearance used to sit
  // on this lib's `libSelectedItem` content, which the select renders only
  // when a view is selected, so the empty field had none.
  it('reserves the menu button its room on the field, not on the selected item', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/saved-views.scss'), 'utf8');
    const select = stylesheet.slice(
      stylesheet.indexOf('.sv-select {'),
      stylesheet.indexOf('.sv-menu-trigger'),
    );
    const current = stylesheet.slice(stylesheet.indexOf('.sv-option-current {'));

    expect(select).toContain('--select-value-inset-end');
    expect(current.slice(0, current.indexOf('}'))).not.toContain('padding-inline-end');
  });
});

describe('SavedViews copy', () => {
  // Regression: the add row's label is data the listbox holds, read with `translate`, and the
  // first read ran before the lazy scope, logging the key as missing on every page load.
  it('reads the add row only once its dictionary has landed, with no missing-key warning', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.layout.set('compact');
    fixture.detectChanges();

    const missing = warn.mock.calls.filter((call) =>
      call.some((part) => typeof part === 'string' && part.includes('savedViews.create')),
    );
    warn.mockRestore();
    expect(missing).toEqual([]);
  });

  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'savedViews.default': 'customer.defaultView' }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('savedViews/en'));
    transloco.setTranslation({ customer: { defaultView: 'Opens first' } }, 'en', { merge: true });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.storage = memorySavedViewsStorage({ words_views: document('Busy') });
    await fixture.componentInstance.controller.load('words_views');
    for (let pass = 0; pass < 3; pass += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    const note = (fixture.nativeElement as HTMLElement).querySelector('.sv-note');
    expect(note?.textContent.trim()).toBe('Opens first');
  });
});

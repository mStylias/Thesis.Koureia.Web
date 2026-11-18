import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import {
  SAVED_VIEWS_VERSION,
  SavedViewsController,
  memorySavedViewsStorage,
} from '@ui/saved-views/core';
import type { SavedViewsLayout } from '@ui/saved-views/core';
import { SavedViews } from './saved-views';

/**
 * A per-story description plus an explicit "Show code" snippet. Every example renders through a
 * demo component, so the generated source would otherwise show the demo tag, not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/** The demo host's state: which chairs are shown. */
interface ChairsState {
  readonly chairs: readonly string[];
}

function isChairsState(value: unknown): value is ChairsState {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as ChairsState).chairs)
  );
}

const STORAGE = memorySavedViewsStorage({
  demo_views: {
    version: SAVED_VIEWS_VERSION,
    views: [
      { id: 'all', name: 'Όλες οι καρέκλες', state: { chairs: ['Α', 'Β', 'Γ'] } },
      { id: 'front', name: 'Μπροστά', state: { chairs: ['Α'] } },
      { id: 'back', name: 'Πίσω', state: { chairs: ['Β', 'Γ'] } },
    ],
  },
});

@Component({
  selector: 'lib-saved-views-demo',
  imports: [SavedViews],
  template: `
    <div style="max-width: 44rem; display: grid; gap: 1rem;">
      <lib-saved-views [controller]="controller" [layout]="layout()" />
      <p style="margin: 0; color: var(--text-secondary);">
        Καρέκλες: {{ chairs().join(', ') || 'καμία' }}
      </p>
      <p style="margin: 0;">
        <button type="button" (click)="toggle('Γ')">Εναλλαγή της Γ</button>
        — αλλάζει την κατάσταση, και η επιλεγμένη προβολή δείχνει μη αποθηκευμένες αλλαγές.
      </p>
    </div>
  `,
})
class SavedViewsDemo {
  readonly layout = input<SavedViewsLayout>('strip');
  readonly chairs = signal<readonly string[]>([]);

  readonly controller = new SavedViewsController<ChairsState>({
    key: () => 'demo_views',
    storage: () => STORAGE,
    state: () => ({ chairs: this.chairs() }),
    apply: (state) => {
      this.chairs.set(state.chairs);
    },
    isDestroyed: () => false,
    isState: isChairsState,
    statesEqual: (a, b) => a.chairs.join() === b.chairs.join(),
  });

  constructor() {
    void this.controller.load('demo_views');
  }

  protected toggle(chair: string): void {
    const current = this.chairs();
    this.chairs.set(
      current.includes(chair) ? current.filter((c) => c !== chair) : [...current, chair],
    );
  }
}

const meta: Meta<SavedViewsDemo> = {
  title: 'Layout & Navigation/Saved views',
  component: SavedViewsDemo,
  decorators: [
    moduleMetadata({ imports: [SavedViewsDemo] }),
    applicationConfig({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
          },
        }),
      ],
    }),
  ],
  parameters: { layout: 'padded' },
};

export default meta;

const USAGE = `
<lib-saved-views [controller]="views" layout="strip" />
`;

export const Strip: StoryObj<SavedViewsDemo> = {
  render: () => ({ template: '<lib-saved-views-demo layout="strip" />' }),
  parameters: doc(
    [
      'A tab per saved view. Single click selects, double click or `F2` renames, drag or',
      '`Ctrl`+arrows reorder, right-click or `Shift`+`F10` opens the menu. Change the host',
      'state and the selected tab shows save and revert in place of its ×.',
    ].join(' '),
    USAGE,
  ),
};

export const Compact: StoryObj<SavedViewsDemo> = {
  render: () => ({ template: '<lib-saved-views-demo layout="compact" />' }),
  parameters: doc(
    [
      'The same rows as a listbox, for a bar that has run out of room. The first row adds a',
      'view; the menu hangs from a button inside the field; the unsaved pair stays beside it.',
    ].join(' '),
    '<lib-saved-views [controller]="views" layout="compact" />',
  ),
};

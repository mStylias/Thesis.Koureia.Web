import { Component, inject } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { ThemeService, provideBrand } from '@util/brand';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { ThemeToggle } from './theme-toggle';

/**
 * A per-story description plus the snippet shown under "Show code". Written by hand because
 * every story renders through a demo wrapper, so the generated source would read
 * `<lib-theme-toggle-demo />` — the scaffolding rather than the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const SIZES = ['sm', 'md', 'lg'] as const;

@Component({
  selector: 'lib-theme-toggle-sizes-demo',
  imports: [ThemeToggle],
  template: `
    <div style="display: flex; align-items: center; gap: var(--space-4)">
      @for (size of sizes; track size) {
        <lib-theme-toggle [size]="size" />
      }
    </div>
  `,
})
class SizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-theme-toggle-state-demo',
  imports: [ThemeToggle],
  template: `
    <div style="display: grid; gap: var(--space-4); justify-items: start">
      <lib-theme-toggle />
      <p class="t-body-sm">
        Preference: <code>{{ theme.preference() }}</code> • resolved:
        <code>{{ theme.resolved() }}</code>
      </p>
    </div>
  `,
})
class StateDemo {
  protected readonly theme = inject(ThemeService);
}

const meta: Meta = {
  title: 'Actions/Theme toggle',
  decorators: [
    applicationConfig({
      providers: [
        provideBrand({
          id: 'demo',
          name: 'Demo',
          wordmark: 'demo',
          logo: '/demo.png',
          heroImage: '/demo-hero.webp',
          defaultTheme: 'system',
        }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    }),
  ],
};

export default meta;

export const Default: StoryObj = {
  decorators: [moduleMetadata({ imports: [StateDemo] })],
  render: () => ({ template: '<lib-theme-toggle-state-demo />' }),
  parameters: doc(
    `
Flips the interface between light and dark. It writes through \`ThemeService\`, so the whole
page re-themes — the readout below is the service's own state, not the control's.

The accessible name stays "dark theme" in both positions; whether it is on rides on
\`aria-pressed\`. A name that flipped would be re-announced by the very interaction that
changed it, describing the control instead of the state.
    `,
    `<lib-theme-toggle />`,
  ),
};

export const Sizes: StoryObj = {
  decorators: [moduleMetadata({ imports: [SizesDemo] })],
  render: () => ({ template: '<lib-theme-toggle-sizes-demo />' }),
  parameters: doc(
    'Matches the controls beside it — `sm` in a header, `lg` next to a large call to action.',
    `
<lib-theme-toggle size="sm" />
<lib-theme-toggle size="md" />
<lib-theme-toggle size="lg" />
    `,
  ),
};

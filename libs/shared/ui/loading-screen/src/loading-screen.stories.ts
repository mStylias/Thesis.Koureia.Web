import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { LoadingScreen } from './loading-screen';

/**
 * A per-story description plus the snippet shown under "Show code". Written by hand because
 * every story renders through a demo wrapper, so the generated source would read
 * `<lib-loading-screen-demo />` — the scaffolding rather than the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/**
 * The splash is `position: fixed`, and a story must not cover the documentation page with it.
 * `contain: paint` makes this box the containing block, so the overlay fills the demo instead.
 */
const STAGE_STYLE = [
  'contain: paint',
  'block-size: 18rem',
  'display: grid',
  'place-items: center',
  'inline-size: 100%',
  'border: var(--border-width-hairline) solid var(--border)',
  'border-radius: var(--radius-lg)',
  'background: var(--surface-2)',
].join(';');

@Component({
  selector: 'lib-loading-screen-demo',
  imports: [Button, LoadingScreen],
  template: `
    <div style="display: grid; gap: var(--space-4); justify-items: start; max-width: 32rem">
      <button libButton type="button" size="sm" [disabled]="loading()" (click)="run()">
        Load for {{ loadMs() }}ms
      </button>

      <div [style]="stageStyle">
        <p class="t-body-sm">The page under the splash.</p>
        <lib-loading-screen
          [loading]="loading()"
          logo="/brand/icon.svg"
          [minDuration]="minDuration()"
        />
      </div>

      <p class="t-caption">
        Floor {{ minDuration() }}ms — the splash goes down at the later of the two.
      </p>
    </div>
  `,
})
class Demo {
  /** The wait the splash covers, in milliseconds. */
  readonly loadMs = input(60);

  /** Passed straight through to the splash. */
  readonly minDuration = input(500);

  protected readonly stageStyle = STAGE_STYLE;
  protected readonly loading = signal(false);

  protected run(): void {
    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
    }, this.loadMs());
  }
}

const meta: Meta = {
  title: 'Feedback & status/Loading screen',
  decorators: [
    applicationConfig({
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
    }),
    moduleMetadata({ imports: [Demo] }),
  ],
};

export default meta;

export const FastLoad: StoryObj = {
  name: 'Load shorter than the floor',
  render: () => ({ template: '<lib-loading-screen-demo />' }),
  parameters: doc(
    'The work finishes in 60ms and the splash still stays up for 500ms. Without the floor it would flash for two frames, which reads as a glitch rather than as feedback.',
    `
<lib-loading-screen [loading]="entering()" [logo]="brand.logo" />
    `,
  ),
};

export const SlowLoad: StoryObj = {
  name: 'Load longer than the floor',
  render: () => ({ template: '<lib-loading-screen-demo [loadMs]="1600" />' }),
  parameters: doc(
    'The work takes 1600ms and the splash is up for 1600ms, not 2100ms. `minDuration` is a floor on the total, never an addition to it.',
    `
<lib-loading-screen [loading]="entering()" [logo]="brand.logo" [minDuration]="500" />
    `,
  ),
};

export const NoFloor: StoryObj = {
  name: 'No floor',
  render: () => ({ template: '<lib-loading-screen-demo [minDuration]="0" />' }),
  parameters: doc(
    'A floor of zero, for a consumer with its own timing. The 60ms wait is now genuinely 60ms and the splash is all but invisible, which is the case the default exists to avoid.',
    `
<lib-loading-screen [loading]="entering()" [logo]="brand.logo" [minDuration]="0" />
    `,
  ),
};

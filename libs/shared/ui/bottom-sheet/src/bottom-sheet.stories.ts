import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { BottomSheet } from './bottom-sheet';

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

@Component({
  selector: 'lib-bottom-sheet-demo',
  imports: [BottomSheet],
  template: `
    <!-- The page under the sheet. The bottom padding is the whole visible band. -->
    <div
      style="min-height: 22rem; padding-block-end: calc(var(--bottom-sheet-peek-height) + 4.25rem);"
    >
      <p style="color: var(--text-secondary);">
        The bar stays on screen while this content scrolls. Tap it, or drag it up.
      </p>
      @for (line of lines; track line) {
        <p style="color: var(--text-muted);">{{ line }}</p>
      }
    </div>

    <lib-bottom-sheet
      style="--bottom-sheet-actions-height: 4.25rem;"
      [(expanded)]="open"
      [lockScroll]="lockScroll()"
    >
      <div libBottomSheetPeek style="display: flex; align-items: center; gap: 0.75rem;">
        <span
          style="width: 2.5rem; height: 2.5rem; border-radius: 999px; background: var(--surface-2); display: grid; place-items: center; font-family: var(--font-mono);"
          >ΒΗ</span
        >
        <span style="min-width: 0;">
          <span style="display: block;">Barber House</span>
          <span
            style="display: block; color: var(--text-muted); font-size: 0.8125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
            >Haircut + beard • Anyone • Fri 25 Sep, 17:30</span
          >
        </span>
      </div>

      <div
        libBottomSheetActions
        style="display: flex; align-items: center; gap: 1rem; width: 100%;"
      >
        <span style="font-family: var(--font-mono); font-size: 1.25rem;">€25</span>
        <button type="button" style="flex: 1 1 auto;">Continue</button>
      </div>

      <h3 style="margin-block: 0.5rem;">Your selection</h3>
      <p style="color: var(--text-secondary);">Haircut — 30′ — €15</p>
      <p style="color: var(--text-secondary);">Beard trim — 20′ — €10</p>
      <p style="color: var(--text-secondary);">Anyone available</p>
      <p style="color: var(--text-secondary);">Friday 25 September, 17:30</p>
      <hr style="border: 0; border-block-start: 1px solid var(--border); margin-block: 0.75rem;" />
      <p style="font-family: var(--font-mono);">50′ • €25</p>
    </lib-bottom-sheet>
  `,
})
class BottomSheetDemo {
  readonly lockScroll = input(true);
  readonly startExpanded = input(false);
  readonly open = signal(false);

  readonly lines = Array.from({ length: 8 }, (_, index) => `Page content, line ${index + 1}.`);

  constructor() {
    queueMicrotask(() => {
      if (this.startExpanded()) this.open.set(true);
    });
  }
}

const meta: Meta<BottomSheetDemo> = {
  title: 'Overlays/Bottom sheet',
  component: BottomSheetDemo,
  decorators: [
    moduleMetadata({ imports: [BottomSheetDemo] }),
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
  ],
};

export default meta;
type Story = StoryObj<BottomSheetDemo>;

export const Collapsed: Story = {
  parameters: doc(
    'The resting state. The bar is on screen with the actions row under it, and the panel is `inert`, so nothing in it can be tabbed to. Tap anywhere on the bar or drag it up — there is no chevron, the grip is the affordance.',
    `
<lib-bottom-sheet [(expanded)]="open">
  <div libBottomSheetPeek>one line, always on screen</div>
  <div libBottomSheetActions>the actions, also always on screen</div>
  <p>the detail, revealed when expanded</p>
</lib-bottom-sheet>
    `,
  ),
};

export const Expanded: Story = {
  args: { startExpanded: true },
  parameters: doc(
    'Over a backdrop, with the actions row moved to the foot of the sheet so the panel the customer opened is what sits under the bar. Tap the backdrop, press `Escape`, or drag the sheet down to collapse it. Focus moves into the panel on expand and back to the bar on collapse.',
    `<lib-bottom-sheet [(expanded)]="open">…</lib-bottom-sheet>`,
  ),
};

export const PageFurniture: Story = {
  args: { lockScroll: false },
  parameters: doc(
    'With `lockScroll` off, the page behind an expanded sheet still scrolls. For a sheet that belongs to the page rather than covering it.',
    `<lib-bottom-sheet [(expanded)]="open" [lockScroll]="false">…</lib-bottom-sheet>`,
  ),
};

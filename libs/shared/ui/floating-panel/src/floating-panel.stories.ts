import { Component, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';

import { FloatingPanel, FloatingPanelContent } from './floating-panel';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: { description: { story: markdown }, source: { code: code.trim(), language } },
});

@Component({
  selector: 'lib-floating-panel-demo',
  imports: [Button, Checkbox, FloatingPanel, FloatingPanelContent],
  template: `
    <button libButton type="button" severity="secondary" (click)="open.set(!open())">
      Columns
    </button>
    <lib-floating-panel [(open)]="open" header="Columns">
      <ng-template libFloatingPanelContent>
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          @for (column of columns; track column) {
            <lib-checkbox size="sm" [value]="true">{{ column }}</lib-checkbox>
          }
        </div>
      </ng-template>
    </lib-floating-panel>
  `,
})
class FloatingPanelDemo {
  readonly open = signal(true);
  readonly columns = ['Customer', 'Phone', 'Email', 'Last visit', 'Visits', 'Spent', 'Notes'];
}

@Component({
  selector: 'lib-floating-panel-inset-demo',
  imports: [Button, FloatingPanel, FloatingPanelContent],
  template: `
    <header
      style="position: fixed; inset: 0 0 auto; height: var(--shell-header-height);
             border-bottom: var(--border-width-hairline) solid var(--border); background: var(--surface);"
    ></header>
    <button
      libButton
      type="button"
      severity="secondary"
      style="margin-top: var(--shell-header-height);"
      (click)="open.set(!open())"
    >
      Toggle
    </button>
    <lib-floating-panel [(open)]="open" header="Filters" insetTop="var(--shell-header-height)">
      <ng-template libFloatingPanelContent>
        <p>Stops under the bar above it.</p>
      </ng-template>
    </lib-floating-panel>
  `,
})
class FloatingPanelInsetDemo {
  readonly open = signal(true);
}

const meta: Meta<FloatingPanelDemo> = {
  title: 'Overlays/Floating panel',
  component: FloatingPanelDemo,
  decorators: [
    moduleMetadata({ imports: [FloatingPanelDemo, FloatingPanelInsetDemo] }),
    applicationConfig({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    }),
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj<FloatingPanelDemo> = {
  parameters: doc(
    'Docked to the bottom-right corner, the full height of the viewport. Drag the header to move it, any edge or corner to resize it, and double-click the header to dock it again.',
    `
<lib-floating-panel [(open)]="open" header="Columns">
  <ng-template libFloatingPanelContent>…</ng-template>
</lib-floating-panel>`,
  ),
};

export const UnderAnAppBar: StoryObj<FloatingPanelDemo> = {
  render: () => ({ template: `<lib-floating-panel-inset-demo />` }),
  parameters: doc(
    '`insetTop` keeps the space above the panel free, such as an app bar. The panel stops a gutter below it, when docked and when dragged.',
    `
<lib-floating-panel [(open)]="open" header="Filters" insetTop="var(--shell-header-height)">
  <ng-template libFloatingPanelContent>…</ng-template>
</lib-floating-panel>`,
  ),
};

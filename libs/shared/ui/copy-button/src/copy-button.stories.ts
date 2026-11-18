import { Component } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { CopyButton } from './copy-button';

@Component({
  selector: 'lib-copy-button-demo',
  imports: [CopyButton],
  template: `
    <div style="display: flex; align-items: center; gap: var(--space-3);">
      <span>despina&#64;example.com</span>
      <lib-copy-button value="despina@example.com" label="Copy email" />
    </div>
  `,
})
class CopyButtonDemo {}

const meta: Meta<CopyButtonDemo> = {
  title: 'Actions/Copy button',
  component: CopyButtonDemo,
  decorators: [
    moduleMetadata({ imports: [CopyButtonDemo] }),
    applicationConfig({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj<CopyButtonDemo> = {
  parameters: {
    docs: {
      source: {
        code: `<lib-copy-button [value]="email" [label]="'Copy email'" />`,
      },
    },
  },
};

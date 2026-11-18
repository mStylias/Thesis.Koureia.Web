import { Component } from '@angular/core';
import { LucideStar } from '@lucide/angular';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { Stat } from './stat';
import { StatGroup } from './stat-group';

const STAR =
  'width: var(--icon-size-sm); height: var(--icon-size-sm); color: var(--accent); fill: currentColor;';

@Component({
  selector: 'lib-stat-demo',
  imports: [LucideStar, Stat, StatGroup],
  template: `
    <lib-stat-group aria-label="Figures" style="display: grid; max-width: 30rem;">
      <lib-stat [value]="128" label="Completed" />
      <lib-stat [value]="6" label="Upcoming" />
      <lib-stat value="4.8" label="42 reviews">
        <svg lucideStar aria-hidden="true" style="${STAR}"></svg>
      </lib-stat>
    </lib-stat-group>
  `,
})
class StatDemo {}

@Component({
  selector: 'lib-stat-label-first-demo',
  imports: [Stat],
  template: `
    <div style="display: grid; grid-template-columns: repeat(2, 11rem); gap: var(--space-3);">
      <lib-stat labelFirst value="4.853 €" label="Revenue" />
      <lib-stat labelFirst value="9,9%" label="Lost appointments" />
    </div>
  `,
})
class StatLabelFirstDemo {}

const meta: Meta<StatDemo> = {
  title: 'Data/Stat',
  component: StatDemo,
  decorators: [moduleMetadata({ imports: [StatDemo, StatLabelFirstDemo] })],
  tags: ['autodocs'],
};

export default meta;

export const Figures: StoryObj<StatDemo> = {
  parameters: {
    docs: {
      source: {
        code: `<lib-stat-group aria-label="Figures">
  <lib-stat [value]="128" label="Completed" />
  <lib-stat [value]="6" label="Upcoming" />
  <lib-stat value="4.8" label="42 reviews">
    <svg lucideStar aria-hidden="true"></svg>
  </lib-stat>
</lib-stat-group>`,
      },
    },
  },
};

export const LabelFirst: StoryObj<StatDemo> = {
  render: () => ({ template: '<lib-stat-label-first-demo />' }),
  parameters: {
    docs: {
      description: {
        story: 'The label above the value. A screen reader still reads the value first.',
      },
      source: {
        code: `<lib-stat labelFirst value="4.853 €" label="Revenue" />`,
      },
    },
  },
};

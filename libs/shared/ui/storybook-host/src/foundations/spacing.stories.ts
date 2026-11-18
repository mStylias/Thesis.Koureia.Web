import type { Meta, StoryObj } from '@storybook/angular';
import { FoundationSpacingShowcase } from './foundation-showcases';

const meta: Meta<FoundationSpacingShowcase> = {
  title: 'Foundations/Spacing',
  component: FoundationSpacingShowcase,
  parameters: {
    docs: {
      description: {
        component: 'The rem-based spacing scale built on a four-pixel grid.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<FoundationSpacingShowcase>;

export const Overview: Story = {};

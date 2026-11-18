import type { Meta, StoryObj } from '@storybook/angular';
import { FoundationColourShowcase } from './foundation-showcases';

const meta: Meta<FoundationColourShowcase> = {
  title: 'Foundations/Colour',
  component: FoundationColourShowcase,
  parameters: {
    docs: {
      description: {
        component: 'The brand primary, theme-aware surfaces, and restrained status palette.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<FoundationColourShowcase>;

export const Overview: Story = {};

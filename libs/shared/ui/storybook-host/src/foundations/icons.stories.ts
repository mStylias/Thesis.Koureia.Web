import type { Meta, StoryObj } from '@storybook/angular';
import { FoundationIconsShowcase } from './foundation-showcases';

const meta: Meta<FoundationIconsShowcase> = {
  title: 'Foundations/Icons',
  component: FoundationIconsShowcase,
  parameters: {
    docs: {
      description: {
        component: 'Lucide icon conventions, shared sizing, and accessible labelling guidance.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<FoundationIconsShowcase>;

export const Overview: Story = {};

import type { Meta, StoryObj } from '@storybook/angular';
import { FoundationTypographyShowcase } from './foundation-showcases';

const meta: Meta<FoundationTypographyShowcase> = {
  title: 'Foundations/Typography',
  component: FoundationTypographyShowcase,
  parameters: {
    docs: {
      description: {
        component: 'The semantic type scale for display, interface, and tabular content.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<FoundationTypographyShowcase>;

export const Overview: Story = {};

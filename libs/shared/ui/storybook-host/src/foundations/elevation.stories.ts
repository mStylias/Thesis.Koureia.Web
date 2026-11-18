import type { Meta, StoryObj } from '@storybook/angular';
import { FoundationElevationShowcase } from './foundation-showcases';

const meta: Meta<FoundationElevationShowcase> = {
  title: 'Foundations/Elevation',
  component: FoundationElevationShowcase,
  parameters: {
    docs: {
      description: {
        component: 'Warm elevation tokens for chips, cards, overlays, and rare accent emphasis.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<FoundationElevationShowcase>;

export const Overview: Story = {};

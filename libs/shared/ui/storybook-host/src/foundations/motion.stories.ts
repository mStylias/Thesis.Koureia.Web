import type { Meta, StoryObj } from '@storybook/angular';
import { FoundationMotionShowcase } from './foundation-showcases';

const meta: Meta<FoundationMotionShowcase> = {
  title: 'Foundations/Motion',
  component: FoundationMotionShowcase,
  parameters: {
    docs: {
      description: {
        component: 'Purposeful durations, easing, and an accessible animate.enter/leave example.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<FoundationMotionShowcase>;

export const Overview: Story = {};

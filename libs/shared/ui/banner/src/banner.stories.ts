import { Component } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { LucideShieldCheck } from '@lucide/angular';
import { Button } from '@ui/button';

import { Banner } from './banner';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const STACK = 'display: grid; gap: var(--space-3); max-inline-size: 32rem;';

@Component({
  selector: 'lib-banner-demo',
  imports: [Banner],
  template: `
    <div style="${STACK}">
      <lib-banner>
        You can add the appointment to your calendar through the email we sent you.
      </lib-banner>
    </div>
  `,
})
class BannerDemo {}

@Component({
  selector: 'lib-banner-tones-demo',
  imports: [Banner],
  template: `
    <div style="${STACK}">
      <lib-banner tone="info">Only staff see the internal note.</lib-banner>
      <lib-banner tone="success">The customer received the email.</lib-banner>
      <lib-banner tone="warning">The customer is blocked from booking online.</lib-banner>
      <lib-banner tone="error">The appointment did not save. Try again.</lib-banner>
      <lib-banner tone="info">
        A long message wraps under itself, and the icon stays level with the first line. The box
        takes the width of its container.
      </lib-banner>
    </div>
  `,
})
class BannerTonesDemo {}

@Component({
  selector: 'lib-banner-parts-demo',
  imports: [Banner, Button],
  template: `
    <div style="${STACK}">
      <lib-banner tone="warning" heading="Customers cannot book this member online">
        <ul style="margin: 0; padding-inline-start: var(--space-5);">
          <li>No working hours</li>
          <li>No services</li>
        </ul>
      </lib-banner>
      <lib-banner tone="error">
        The staff could not be loaded.
        <button
          libButton
          libBannerAction
          type="button"
          size="sm"
          variant="outlined"
          severity="secondary"
        >
          Retry
        </button>
      </lib-banner>
      <lib-banner [icon]="shield">Your choices will be kept after you sign in.</lib-banner>
    </div>
  `,
})
class BannerPartsDemo {
  protected readonly shield = LucideShieldCheck;
}

const meta: Meta<BannerDemo> = {
  title: 'Feedback & status/Banner',
  component: BannerDemo,
  decorators: [moduleMetadata({ imports: [BannerDemo, BannerTonesDemo, BannerPartsDemo] })],
  parameters: {
    docs: {
      description: {
        component:
          'A message in a tinted box, inline with the page. The tone sets the tint, the edge and the icon. The banner sets no role: add `role="status"` or `role="alert"` when it appears in response to an action.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<BannerDemo>;

export const Default: Story = {
  render: () => ({ template: `<lib-banner-demo />` }),
  parameters: doc(
    'Info is the default tone.',
    `<lib-banner>You can add the appointment to your calendar through the email we sent you.</lib-banner>`,
  ),
};

export const Tones: Story = {
  render: () => ({ template: `<lib-banner-tones-demo />` }),
  parameters: doc(
    'Each tone has its own icon, so the color is never the only signal.',
    `
<lib-banner tone="info">Only staff see the internal note.</lib-banner>
<lib-banner tone="success">The customer received the email.</lib-banner>
<lib-banner tone="warning">The customer is blocked from booking online.</lib-banner>
<lib-banner tone="error" role="alert">The appointment did not save. Try again.</lib-banner>
`,
  ),
};

export const HeadingActionAndIcon: Story = {
  render: () => ({ template: `<lib-banner-parts-demo />` }),
  parameters: doc(
    'A heading over the message, an action at the end, and an icon in place of the tone icon.',
    `
<lib-banner tone="warning" heading="Customers cannot book this member online">
  <ul>…</ul>
</lib-banner>

<lib-banner tone="error" role="alert">
  The staff could not be loaded.
  <button libButton libBannerAction size="sm" variant="outlined" severity="secondary">Retry</button>
</lib-banner>

<lib-banner [icon]="shieldIcon">Your choices will be kept after you sign in.</lib-banner>
`,
  ),
};

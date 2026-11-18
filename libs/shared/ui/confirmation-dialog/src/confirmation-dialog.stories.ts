import { Component, inject, input, signal } from '@angular/core';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { ConfirmationService } from './confirmation-dialog.service';
import { ConfirmationResult, ConfirmationSeverity } from './confirmation-dialog.types';

const SEVERITIES = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const;

/** A per-story description and the consumer-facing snippet shown by Storybook. */
const doc = (markdown: string, code: string, language = 'ts') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const PLAYGROUND_SOURCE = `
private readonly confirmation = inject(ConfirmationService);

protected async confirmAction(): Promise<void> {
  const result = await this.confirmation.open({
    title: 'Confirm action',
    message: 'Are you sure you want to continue?',
    severity: 'warning',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  });

  if (result === 'confirmed') {
    // Continue with the action.
  }
}
`;

@Component({
  selector: 'lib-confirmation-dialog-demo',
  imports: [Button],
  template: `
    <div
      style="display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-start;"
    >
      <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
        <button libButton variant="outlined" severity="secondary" (click)="openPlayground()">
          Open (playground args)
        </button>
        <button libButton variant="outlined" severity="error" (click)="cancelBooking()">
          Cancel booking
        </button>
        <button libButton variant="outlined" (click)="confirmBooking()">Confirm booking</button>
        <button libButton variant="outlined" severity="info" (click)="acknowledge()">
          Acknowledge only
        </button>
      </div>

      @if (lastResult(); as result) {
        <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
          Last result: {{ result }}
        </p>
      }
    </div>
  `,
})
class ConfirmationDialogDemo {
  private readonly confirmation = inject(ConfirmationService);

  readonly title = input('Confirm action');
  readonly message = input('Are you sure you want to continue?');
  readonly severity = input<ConfirmationSeverity>('warning');
  readonly showIcon = input(true);
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly showCancel = input(true);
  readonly dismissible = input(false);

  protected readonly lastResult = signal<ConfirmationResult | null>(null);

  protected async openPlayground(): Promise<void> {
    this.lastResult.set(
      await this.confirmation.open({
        title: this.title(),
        message: this.message(),
        severity: this.severity(),
        showIcon: this.showIcon(),
        confirmLabel: this.confirmLabel(),
        cancelLabel: this.cancelLabel(),
        showCancel: this.showCancel(),
        dismissible: this.dismissible(),
      }),
    );
  }

  protected async cancelBooking(): Promise<void> {
    this.lastResult.set(
      await this.confirmation.open({
        title: 'Cancel booking?',
        message: 'Friday at 17:30 with Kimonas will be freed up. This cannot be undone.',
        severity: 'error',
        confirmLabel: 'Cancel booking',
        cancelLabel: 'Keep it',
      }),
    );
  }

  protected async confirmBooking(): Promise<void> {
    this.lastResult.set(
      await this.confirmation.open({
        title: 'Confirm your booking',
        message: 'Skin fade with Kimonas — Friday at 17:30, 30 min, €18.',
        severity: 'primary',
        confirmLabel: 'Book it',
        cancelLabel: 'Not yet',
        dismissible: true,
      }),
    );
  }

  protected async acknowledge(): Promise<void> {
    this.lastResult.set(
      await this.confirmation.open({
        title: 'Shop closed on 15 Aug',
        message: 'Bookings for that day will be rescheduled automatically.',
        severity: 'info',
        confirmLabel: 'Got it',
        showCancel: false,
      }),
    );
  }
}

const meta: Meta<ConfirmationDialogDemo> = {
  title: 'Overlays/Confirmation dialog',
  component: ConfirmationDialogDemo,
  decorators: [
    applicationConfig({
      // Storybook has no application-level Transloco provider. The dialog's
      // lazy scope is created only after a trigger is clicked, so without this
      // root configuration the imperative component creation fails at runtime.
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    }),
    moduleMetadata({ imports: [ConfirmationDialogDemo] }),
  ],
  argTypes: {
    title: { control: 'text' },
    message: { control: 'text' },
    severity: { control: 'select', options: SEVERITIES },
    showIcon: { control: 'boolean' },
    confirmLabel: { control: 'text' },
    cancelLabel: { control: 'text' },
    showCancel: { control: 'boolean' },
    dismissible: { control: 'boolean' },
  },
  args: {
    title: 'Confirm action',
    message: 'Are you sure you want to continue?',
    severity: 'warning',
    showIcon: true,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    showCancel: true,
    dismissible: false,
  },
};

export default meta;
type Story = StoryObj<ConfirmationDialogDemo>;

/**
 * Interactive sandbox — dialogs are opened imperatively through
 * `ConfirmationService.open()`, so each example is a trigger button rather
 * than a static dialog. Tweak the inputs with the controls below, then press
 * **Open (playground args)** to preview the resulting dialog; the other
 * buttons show ready-made presets.
 */
export const Playground: Story = {
  parameters: doc(
    'Use the **Controls** tab to shape the dialog, then press ' +
      '**Open (playground args)** to launch it. The remaining triggers open ' +
      'fixed presets so you can compare common configurations.',
    PLAYGROUND_SOURCE,
  ),
};

export const Destructive: Story = {
  args: {
    title: 'Cancel booking?',
    message: 'Friday at 17:30 with Kimonas will be freed up.',
    severity: 'error',
    confirmLabel: 'Cancel booking',
    cancelLabel: 'Keep it',
  },
  parameters: doc(
    'An `error` severity dialog for irreversible actions. Colors the icon ' +
      'badge and confirm button red and uses an explicit `confirmLabel` / ' +
      '`cancelLabel` so the buttons state the outcome instead of a generic ' +
      '"Confirm" / "Cancel".',
    `
const result = await this.confirmation.open({
  title: 'Cancel booking?',
  message: 'Friday at 17:30 with Kimonas will be freed up.',
  severity: 'error',
  confirmLabel: 'Cancel booking',
  cancelLabel: 'Keep it',
});
    `,
  ),
};

export const Dismissible: Story = {
  args: { dismissible: true },
  parameters: doc(
    'Set `dismissible: true` to add a × button and allow closing via ' +
      '`Escape` or a backdrop click — each of which resolves `open()` with ' +
      '`dismissed`. Use it for low-stakes confirmations the user can safely ' +
      'back out of; leave it off (the default) when a deliberate ' +
      'confirm/cancel choice is required.',
    `
const result = await this.confirmation.open({
  title: 'Confirm your booking',
  message: 'Skin fade with Kimonas — Friday at 17:30, 30 min, €18.',
  severity: 'primary',
  dismissible: true,
});
    `,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'The dialog renders in a native `<dialog>` opened with `showModal()`, ' +
        'so most modal accessibility behavior comes from the platform.',
      '',
      '- **Focus is trapped** inside the dialog while it is open, and ' +
        '`showModal()` moves initial focus into it.',
      '- **`Escape` closes the dialog** — when `dismissible`, it resolves as ' +
        '`dismissed`; otherwise the key is intercepted so the dialog stays ' +
        'open rather than closing without a choice.',
      '- The dialog exposes `role="dialog"` with `aria-modal`, and is ' +
        'labelled by its title and described by its message via ' +
        '`aria-labelledby` / `aria-describedby`.',
      '- **Focus is restored** to the element that opened the dialog when it ' +
        'closes, via the native `close()`.',
      `- Content sits in the top layer above a backdrop, so nothing behind it is interactive.`,
    ].join('\n'),
    `
const result = await this.confirmation.open({
  title: 'Confirm action',
  message: 'Are you sure you want to continue?',
  dismissible: true,
});

switch (result) {
  case 'confirmed':
    // The user accepted.
    break;
  case 'cancelled':
    // The user chose the cancel action.
    break;
  case 'dismissed':
    // The user pressed Escape, clicked the backdrop or used the close button.
    break;
}
    `,
  ),
};

import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { Stepper } from './stepper';
import type { StepperOrientation, StepperStep } from './stepper.types';

/**
 * A per-story description plus an explicit "Show code" snippet. Every example renders through a
 * demo component, so the generated source would otherwise show the demo tag, not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const BOOKING_STEPS: readonly StepperStep[] = [
  { id: 'shop', label: 'Barbershop', locked: true },
  { id: 'services', label: 'Services' },
  { id: 'barber', label: 'Barber' },
  { id: 'when', label: 'Date and time' },
  { id: 'confirm', label: 'Confirm' },
];

@Component({
  selector: 'lib-stepper-demo',
  imports: [Stepper],
  template: `
    <div style="max-width: 52rem;">
      <lib-stepper
        [steps]="steps()"
        [(activeStep)]="active"
        [completedSteps]="completed()"
        [orientation]="orientation()"
      >
        <p style="margin-block-start: 1.5rem; color: var(--text-secondary);">
          The body of "{{ activeLabel() }}" goes here. The stepper projects it and owns none of it.
        </p>
      </lib-stepper>
    </div>
  `,
})
class StepperDemo {
  readonly steps = input<readonly StepperStep[]>(BOOKING_STEPS);
  readonly completed = input<readonly string[]>(['shop', 'services']);
  readonly orientation = input<StepperOrientation>('horizontal');
  readonly active = signal('barber');

  protected activeLabel(): string {
    return this.steps().find((step) => step.id === this.active())?.label ?? '';
  }
}

@Component({
  selector: 'lib-stepper-summary-demo',
  imports: [Stepper],
  template: `
    <div style="max-width: 52rem;">
      <lib-stepper [steps]="steps" [(activeStep)]="active" [completedSteps]="completed">
        <p style="margin-block-start: 1.5rem; color: var(--text-secondary);">Step body.</p>
      </lib-stepper>
    </div>
  `,
})
class StepperSummaryDemo {
  readonly steps: readonly StepperStep[] = [
    { id: 'shop', label: 'Barbershop', summary: 'Barber House', locked: true },
    { id: 'services', label: 'Services', summary: 'Haircut + beard • 50′' },
    { id: 'barber', label: 'Barber', summary: 'Anyone' },
    { id: 'when', label: 'Date and time' },
    { id: 'confirm', label: 'Confirm' },
  ];
  readonly completed: readonly string[] = ['shop', 'services', 'barber'];
  readonly active = signal('when');
}

const meta: Meta<StepperDemo> = {
  title: 'Layout & Navigation/Stepper',
  component: StepperDemo,
  decorators: [
    moduleMetadata({ imports: [StepperDemo, StepperSummaryDemo] }),
    applicationConfig({
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
  ],
};

export default meta;
type Story = StoryObj<StepperDemo>;

export const Horizontal: Story = {
  parameters: doc(
    'The default. Completed steps are buttons — click "Services" to go back. "Barbershop" is `locked`: it renders as done and is not activatable.',
    `
<lib-stepper
  [steps]="steps()"
  [(activeStep)]="step"
  [completedSteps]="done()"
  (stepSelected)="goTo($event)"
>
  <!-- the active step's body -->
</lib-stepper>
    `,
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  parameters: doc(
    'A column instead of a rail, for a narrow sidebar. The phone presentation is unchanged — resize the preview to see it.',
    `<lib-stepper orientation="vertical" [steps]="steps()" [(activeStep)]="step" />`,
  ),
};

export const WithSummaries: Story = {
  render: () => ({ template: '<lib-stepper-summary-demo />' }),
  parameters: doc(
    'Each step can carry the choice made in it. Leave `summary` unset where another surface already shows the choices — the same values twice on one screen is worse than once.',
    `
const steps = [
  { id: 'services', label: 'Services', summary: 'Haircut + beard • 50′' },
  { id: 'barber', label: 'Barber', summary: 'Anyone' },
];
    `,
    'ts',
  ),
};

export const NothingDone: Story = {
  args: { completed: [] },
  parameters: doc(
    'At the start of a flow. Every step past the active one is inert markup and cannot take focus.',
    `<lib-stepper [steps]="steps()" [(activeStep)]="step" [completedSteps]="[]" />`,
  ),
};

import { Component, input, signal, viewChild } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { LucideCirclePlus } from '@lucide/angular';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Accordion } from './accordion';
import {
  AccordionContent,
  AccordionHeading,
  AccordionIndicator,
  AccordionPanel,
  AccordionPanelBody,
  AccordionTrigger,
} from './accordion-parts';
import { AccordionValue } from './accordion.types';

/**
 * Shorthand for a per-story description plus an explicit "Show code" snippet.
 * The override is required: every example renders through a demo component
 * (stories cannot hold signals), so the generated source would otherwise show
 * `<lib-accordion-*-demo />` — the scaffolding, not the API. The trade-off is
 * that the snippet is static prose and can drift from the demo above it.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/** The item structure every story repeats, with the parts that vary elided. */
const ITEM = `
  <section>
    <h3 libAccordionHeading>
      <button libAccordionTrigger value="service" [panel]="panel">
        What is this service about?
      </button>
    </h3>
    <div libAccordionPanel #panel="ngAccordionPanel">
      <ng-template libAccordionContent>
        <div libAccordionPanelBody>Manage appointments, customers, staff…</div>
      </ng-template>
    </div>
  </section>`;

const ACCORDION_IMPORTS = [
  Accordion,
  AccordionContent,
  AccordionHeading,
  AccordionIndicator,
  AccordionPanel,
  AccordionPanelBody,
  AccordionTrigger,
];

const questions = [
  {
    value: 'service',
    title: 'What is this service about?',
    content:
      'Manage appointments, customers, staff schedules, and shop performance from one place.',
  },
  {
    value: 'security',
    title: 'Is my data secure?',
    content: 'Access is protected with modern authentication and encrypted transport.',
  },
  {
    value: 'plans',
    title: 'Can I change plans later?',
    content: 'Yes. You can change your plan at any time from your account settings.',
  },
];

@Component({
  selector: 'lib-accordion-playground-demo',
  imports: ACCORDION_IMPORTS,
  template: `
    <lib-accordion [multiple]="multiple()" [wrap]="wrap()" [(value)]="active">
      @for (item of items; track item.value) {
        <section>
          <h3 libAccordionHeading>
            <button
              libAccordionTrigger
              [value]="item.value"
              [panel]="panel"
              [disabled]="disabledValue() === item.value"
            >
              {{ item.title }}
            </button>
          </h3>
          <div libAccordionPanel #panel="ngAccordionPanel">
            <ng-template libAccordionContent>
              <div libAccordionPanelBody>{{ item.content }}</div>
            </ng-template>
          </div>
        </section>
      }
    </lib-accordion>
  `,
})
class AccordionPlaygroundDemo {
  readonly multiple = input(false);
  readonly wrap = input(false);
  readonly disabledValue = input<string | null>(null);
  protected readonly items = questions;
  protected readonly active = signal<AccordionValue>('service');
}

@Component({
  selector: 'lib-accordion-controlled-demo',
  imports: [...ACCORDION_IMPORTS, TitleCasePipe],
  template: `
    <div
      style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4);"
    >
      @for (item of items; track item.value) {
        <button type="button" (click)="active.set(item.value)">
          Open {{ item.value | titlecase }}
        </button>
      }
      <button type="button" (click)="active.set(null)">Close all</button>
    </div>

    <lib-accordion [(value)]="active">
      @for (item of items; track item.value) {
        <section>
          <h3 libAccordionHeading>
            <button libAccordionTrigger [value]="item.value" [panel]="panel">
              {{ item.title }}
            </button>
          </h3>
          <div libAccordionPanel #panel="ngAccordionPanel">
            <ng-template libAccordionContent>
              <div libAccordionPanelBody>{{ item.content }}</div>
            </ng-template>
          </div>
        </section>
      }
    </lib-accordion>
  `,
})
class AccordionControlledDemo {
  protected readonly items = questions;
  protected readonly active = signal<AccordionValue>('security');
}

@Component({
  selector: 'lib-accordion-custom-demo',
  imports: [...ACCORDION_IMPORTS, LucideCirclePlus],
  template: `
    <lib-accordion value="service">
      <section>
        <h3 libAccordionHeading>
          <button libAccordionTrigger value="service" [panel]="panel">
            <span style="display: grid; gap: var(--space-1);">
              <span>Rich trigger content</span>
              <small style="color: var(--text-muted);">
                Labels, metadata, or badges can be projected here
              </small>
            </span>
            <svg libAccordionIndicator lucideCirclePlus></svg>
          </button>
        </h3>
        <div libAccordionPanel #panel="ngAccordionPanel">
          <ng-template libAccordionContent>
            <div libAccordionPanelBody>
              The custom indicator rotates from the trigger's native
              <code>aria-expanded</code> state.
            </div>
          </ng-template>
        </div>
      </section>
    </lib-accordion>
  `,
})
class AccordionCustomDemo {}

@Component({
  selector: 'lib-accordion-dynamic-demo',
  imports: ACCORDION_IMPORTS,
  template: `
    <lib-accordion multiple [(value)]="active" #accordion>
      @for (item of items(); track item.value) {
        <section>
          <h3 libAccordionHeading>
            <button libAccordionTrigger [value]="item.value" [panel]="panel">
              {{ item.title }}
            </button>
          </h3>
          <div libAccordionPanel #panel="ngAccordionPanel">
            <ng-template libAccordionContent>
              <div libAccordionPanelBody>{{ item.content }}</div>
            </ng-template>
          </div>
        </section>
      }
    </lib-accordion>

    <div style="display: flex; gap: var(--space-2); margin-top: var(--space-4);">
      <button type="button" (click)="add()">Add panel</button>
      <button type="button" (click)="remove()">Remove last</button>
      <button type="button" (click)="accordionRef().expandAll()">Expand all</button>
      <button type="button" (click)="accordionRef().collapseAll()">Collapse all</button>
    </div>
  `,
})
class AccordionDynamicDemo {
  protected readonly accordionRef = viewChild.required(Accordion);
  protected readonly active = signal<AccordionValue>(['item-1']);
  protected readonly items = signal([
    { value: 'item-1', title: 'Dynamic panel 1', content: 'Content 1' },
    { value: 'item-2', title: 'Dynamic panel 2', content: 'Content 2' },
  ]);
  private next = 3;

  protected add(): void {
    const next = this.next++;
    this.items.update((items) => [
      ...items,
      {
        value: `item-${next}`,
        title: `Dynamic panel ${next}`,
        content: `Content ${next}`,
      },
    ]);
  }

  protected remove(): void {
    this.items.update((items) => items.slice(0, -1));
  }
}

const meta: Meta<AccordionPlaygroundDemo> = {
  title: 'Layout & Navigation/Accordion',
  component: AccordionPlaygroundDemo,
  decorators: [
    moduleMetadata({
      imports: [AccordionControlledDemo, AccordionCustomDemo, AccordionDynamicDemo],
    }),
  ],
  argTypes: {
    multiple: { control: 'boolean' },
    wrap: { control: 'boolean' },
    disabledValue: {
      control: 'select',
      options: [null, 'service', 'security', 'plans'],
    },
  },
  args: { multiple: false, wrap: false, disabledValue: null },
};

export default meta;
type Story = StoryObj<AccordionPlaygroundDemo>;

export const Playground: Story = {
  parameters: doc(
    'One item is a heading containing the trigger, plus the panel it points ' +
      'at. The heading level is yours to choose — it depends on the ' +
      'surrounding document outline, and the wrong level breaks heading ' +
      'navigation. The `libAccordionPanelBody` wrapper is required: the panel ' +
      'host is the grid row that collapses to `0fr`, so its padding has to ' +
      'live on an inner element or it would floor the collapsing track.',
    `
<lib-accordion [(value)]="active">${ITEM}
</lib-accordion>
`,
  ),
};

export const Multiple: Story = {
  args: { multiple: true },
  parameters: doc(
    'With `multiple`, `value` is a `readonly string[]` instead of a single ' +
      'string. `expandAll()` on the component opens every panel in this mode; ' +
      '`collapseAll()` closes them in either.',
    `
<lib-accordion multiple [(value)]="active">…</lib-accordion>

<!-- active: signal<AccordionValue>(['service', 'plans']) -->
`,
  ),
};

export const Controlled: Story = {
  render: () => ({ template: '<lib-accordion-controlled-demo />' }),
  parameters: doc(
    'The accordion is fully controlled: write `value` from anywhere and the ' +
      'panels follow. `null` collapses everything in single mode.',
    `
<button type="button" (click)="active.set('security')">Open Security</button>
<button type="button" (click)="active.set(null)">Close all</button>

<lib-accordion [(value)]="active">…</lib-accordion>
`,
  ),
};

export const CustomTriggerAndIndicator: Story = {
  render: () => ({ template: '<lib-accordion-custom-demo />' }),
  parameters: doc(
    'Trigger content is projected, so a label can carry metadata or badges. ' +
      'Project an element marked `libAccordionIndicator` to replace the ' +
      "default chevron — it rotates from the trigger's own `aria-expanded`, " +
      'and stays `aria-hidden` either way.',
    `
<button libAccordionTrigger value="service" [panel]="panel">
  <span>
    <span>Rich trigger content</span>
    <small>Labels, metadata, or badges can be projected here</small>
  </span>
  <svg libAccordionIndicator lucideCirclePlus></svg>
</button>
`,
  ),
};

export const Disabled: Story = {
  args: { disabledValue: 'security' },
  parameters: doc(
    "`disabled` goes on the trigger, not the group — the group's own " +
      '`disabled` turns the whole accordion off. A disabled trigger is ' +
      '`aria-disabled` and cannot be activated; `[softDisabled]="false"` on ' +
      'the group skips it during arrow-key navigation instead of leaving it ' +
      'focusable.',
    `
<button libAccordionTrigger value="security" [panel]="panel" disabled>
  Is my data secure?
</button>
`,
  ),
};

export const TemplateAndDynamic: Story = {
  render: () => ({ template: '<lib-accordion-dynamic-demo />' }),
  parameters: doc(
    'Items added or removed at runtime are picked up through ' +
      '`contentChildren`, so the controlled value keeps working. Panel ' +
      'content is created on first expansion and kept afterwards; set ' +
      '`[preserveContent]="false"` on the panel to destroy it on collapse ' +
      'instead, at the cost of any local state inside it.',
    `
<lib-accordion multiple [(value)]="active" #accordion>
  @for (item of items(); track item.value) {
    …
  }
</lib-accordion>

<button type="button" (click)="accordion.expandAll()">Expand all</button>
<button type="button" (click)="accordion.collapseAll()">Collapse all</button>
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    'Angular Aria supplies the button/region relationship, roving focus, ' +
      'disabled behaviour, and Enter, Space, Arrow, Home, and End keyboard ' +
      'support. Collapsed panels are `inert`, so their content leaves both the ' +
      'tab order and the accessibility tree. Semantic heading levels remain ' +
      'authored by the consumer.',
    `
<lib-accordion [(value)]="active">
  <section>
    <!-- Pick the level that fits the page outline. -->
    <h3 libAccordionHeading>
      <button libAccordionTrigger value="account" [panel]="panel">Account</button>
    </h3>
    <!-- role="region", aria-labelledby the trigger, inert while collapsed. -->
    <div libAccordionPanel #panel="ngAccordionPanel">
      <ng-template libAccordionContent>
        <div libAccordionPanelBody>Account details</div>
      </ng-template>
    </div>
  </section>
</lib-accordion>
`,
  ),
};

import {
  booleanAttribute,
  Component,
  contentChild,
  Directive,
  effect,
  inject,
  input,
  OnDestroy,
} from '@angular/core';
import {
  AccordionContent as AriaAccordionContent,
  AccordionPanel as AriaAccordionPanel,
  AccordionTrigger as AriaAccordionTrigger,
  ɵɵDeferredContentAware as AriaDeferredContentAware,
} from '@angular/aria/accordion';
import { LucideChevronDown } from '@lucide/angular';
import { Accordion } from './accordion';

/** Marker for a projected custom expand/collapse indicator. */
@Directive({
  selector: '[libAccordionIndicator]',
  host: { class: 'accordion-indicator-custom' },
})
export class AccordionIndicator {}

/** Marks content that is created only when its panel first expands. */
@Directive({
  selector: 'ng-template[libAccordionContent]',
  hostDirectives: [AriaAccordionContent],
})
export class AccordionContent {}

/**
 * Optional decoration component for the semantic heading that contains an
 * accordion trigger. Apply it to the heading level appropriate to the page.
 */
/* Attribute-selector component is intentional for semantic decoration. */
/* oxlint-disable @angular-eslint/component-selector */
@Component({
  selector:
    'h2[libAccordionHeading],h3[libAccordionHeading],h4[libAccordionHeading],h5[libAccordionHeading],h6[libAccordionHeading]',
  template: '<ng-content />',
  styleUrl: './accordion-heading.scss',
  host: { class: 'accordion-heading' },
})
export class AccordionHeading {}
/* oxlint-enable @angular-eslint/component-selector */

/**
 * Native button trigger. `value` identifies it in the parent accordion's
 * controlled value and `panel` points to its content region.
 */
@Component({
  // This component enhances, rather than wraps, the required native button.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: 'button[libAccordionTrigger]',
  imports: [LucideChevronDown],
  template: `
    <span class="accordion-trigger-label"><ng-content /></span>
    <span class="accordion-indicator" aria-hidden="true">
      <ng-content select="[libAccordionIndicator]" />
      @if (!customIndicator()) {
        <svg lucideChevronDown></svg>
      }
    </span>
  `,
  styleUrl: './accordion-trigger.scss',
  hostDirectives: [
    {
      directive: AriaAccordionTrigger,
      inputs: ['panel', 'id', 'disabled', 'expanded'],
      outputs: ['expandedChange'],
    },
  ],
  host: { class: 'accordion-trigger' },
})
export class AccordionTrigger implements OnDestroy {
  private readonly accordion = inject(Accordion);
  private readonly aria = inject(AriaAccordionTrigger);
  protected readonly customIndicator = contentChild(AccordionIndicator);

  /** Stable identifier used by the root controlled value. */
  readonly value = input.required<string>();

  /** Expansion model supplied by the headless aria trigger. */
  readonly expanded = this.aria.expanded;

  private readonly expansionSubscription = this.expanded.subscribe((expanded) => {
    this.accordion.updateValue(this.value(), expanded);
  });

  ngOnDestroy(): void {
    this.expansionSubscription.unsubscribe();
  }
}

/**
 * Region controlled by an accordion trigger. Place a
 * `ng-template[libAccordionContent]` containing one
 * `[libAccordionPanelBody]` inside it.
 */
@Component({
  // This component enhances the consumer's chosen semantic region element.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: '[libAccordionPanel]',
  template: '<ng-content />',
  styleUrl: './accordion-panel.scss',
  hostDirectives: [
    {
      directive: AriaAccordionPanel,
      inputs: ['id'],
    },
  ],
  host: { class: 'accordion-panel' },
})
export class AccordionPanel {
  private readonly deferredContent = inject(AriaDeferredContentAware);

  /** Keep instantiated content mounted after collapse, preserving local state. */
  readonly preserveContent = input(true, { transform: booleanAttribute });

  constructor() {
    effect(() => {
      this.deferredContent.preserveContent.set(this.preserveContent());
    });
  }
}

/** Required direct child wrapper that enables natural-height panel motion. */
@Component({
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: '[libAccordionPanelBody]',
  // The host is the grid item that collapses to 0; padding lives on the inner
  // wrapper so it cannot set a non-zero floor on the collapsing track.
  template: '<div class="accordion-panel-body-content"><ng-content /></div>',
  styleUrl: './accordion-panel-body.scss',
  host: { class: 'accordion-panel-body' },
})
export class AccordionPanelBody {}

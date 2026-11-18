import {
  booleanAttribute,
  Component,
  contentChildren,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { AccordionGroup as AriaAccordionGroup } from '@angular/aria/accordion';
import { AccordionTrigger } from './accordion-parts';
import { AccordionValue, isAccordionValueList } from './accordion.types';

/**
 * Accessible accordion group built on `@angular/aria`.
 *
 * The controlled `value` is a string in single mode and a readonly string
 * array in multiple mode. Expansion can also be controlled per trigger with
 * `[(expanded)]`.
 */
@Component({
  selector: 'lib-accordion',
  template: '<ng-content />',
  styleUrl: './accordion.scss',
  hostDirectives: [
    {
      directive: AriaAccordionGroup,
      // `multiExpandable` is deliberately absent. `hostDirectives` can only
      // re-expose a host directive's input, never bind one, so forwarding it
      // would hand consumers the group's own default — `true` — and flip this
      // component's default from single to multiple expansion. The group is
      // therefore left permissive and single-expansion is enforced by the
      // reconciling effect below, which owns `value` anyway.
      inputs: ['disabled', 'softDisabled', 'wrap'],
    },
  ],
  host: {
    class: 'accordion',
    '[attr.data-multiple]': 'multiple() ? "" : null',
  },
})
export class Accordion {
  private readonly aria = inject(AriaAccordionGroup);
  private readonly triggers = contentChildren(AccordionTrigger, {
    descendants: true,
  });

  /** Expanded trigger value, or values when `multiple` is enabled. */
  readonly value = model<AccordionValue>(null);

  /** Whether more than one panel may be expanded. */
  readonly multiple = input(false, { transform: booleanAttribute });

  constructor() {
    effect(() => {
      const current = this.value();
      const multiple = this.multiple();

      for (const trigger of this.triggers()) {
        const shouldExpand = multiple
          ? isAccordionValueList(current)
            ? current.includes(trigger.value())
            : current === trigger.value()
          : isAccordionValueList(current)
            ? current[0] === trigger.value()
            : current === trigger.value();

        if (trigger.expanded() !== shouldExpand) {
          trigger.expanded.set(shouldExpand);
        }
      }
    });
  }

  /** Expands every panel when multiple expansion is enabled. */
  expandAll(): void {
    if (this.multiple()) {
      this.aria.expandAll();
    }
  }

  /** Collapses every panel. */
  collapseAll(): void {
    this.aria.collapseAll();
  }

  /** @internal Called by child triggers when user interaction changes state. */
  updateValue(itemValue: string, expanded: boolean): void {
    const current = this.value();

    if (!this.multiple()) {
      if (expanded) {
        if (current !== itemValue) {
          this.value.set(itemValue);
        }
      } else if (
        current === itemValue ||
        (isAccordionValueList(current) && current[0] === itemValue)
      ) {
        this.value.set(null);
      }
      return;
    }

    const values = isAccordionValueList(current) ? [...current] : current === null ? [] : [current];
    const hasValue = values.includes(itemValue);

    if (expanded && !hasValue) {
      this.value.set([...values, itemValue]);
    } else if (!expanded && hasValue) {
      this.value.set(values.filter((value) => value !== itemValue));
    }
  }
}

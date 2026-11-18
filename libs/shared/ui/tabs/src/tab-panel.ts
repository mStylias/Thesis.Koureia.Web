import { Component, Directive } from '@angular/core';
import { TabContent as AriaTabContent, TabPanel as AriaTabPanel } from '@angular/aria/tabs';

/**
 * The content region for the tab sharing its `value`. Built on the headless `ngTabPanel`,
 * which supplies `role="tabpanel"`, `aria-labelledby` and `inert` on inactive panels.
 *
 * ```html
 * <lib-tab-panel value="profile">…eager content…</lib-tab-panel>
 * ```
 *
 * For content that renders only on first activation, wrap it in `ng-template libTabContent`:
 *
 * ```html
 * <lib-tab-panel value="reports">
 *   <ng-template libTabContent>…rendered on first activation…</ng-template>
 * </lib-tab-panel>
 * ```
 *
 * `value` and `id` come from `ngTabPanel` and bind directly on `lib-tab-panel`.
 */
@Component({
  selector: 'lib-tab-panel',
  template: '<ng-content />',
  styleUrl: './tab-panel.scss',
  hostDirectives: [
    {
      directive: AriaTabPanel,
      inputs: ['value', 'id'],
    },
  ],
  host: {
    class: 'tab-panel',
  },
})
export class TabPanel {}

/**
 * Marks an `ng-template` as a panel's lazy content, instantiated when its panel first
 * becomes active. Delegates to the headless `ngTabContent`.
 */
@Directive({
  selector: 'ng-template[libTabContent]',
  hostDirectives: [AriaTabContent],
})
export class TabContent {}

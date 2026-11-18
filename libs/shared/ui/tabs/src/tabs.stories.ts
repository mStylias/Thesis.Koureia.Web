import { Component, input, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { LucideBell, LucideCreditCard, LucideUser, LucideUsers } from '@lucide/angular';
import { Tab } from './tab';
import { TabList } from './tab-list';
import { TabMenu } from './tab-menu';
import { TabContent, TabPanel } from './tab-panel';
import { Tabs } from './tabs';
import { TabMenuItem, TabsOrientation, TabsSelectionMode } from './tabs.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-tabs-*-demo />` — the scaffolding, not the API. Overriding
 * `docs.source.code` shows what a consumer would actually paste.
 *
 * The trade-off is that a snippet is static: it does not follow the
 * controls, and it is documentation rather than compiled code, so keep it
 * in step with the demo components above.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const TABS_IMPORTS = [Tabs, TabList, Tab, TabPanel, TabContent, TabMenu];

/** Interactive sandbox driven by the Storybook controls. */
@Component({
  selector: 'lib-tabs-playground-demo',
  imports: [...TABS_IMPORTS],
  template: `
    <lib-tabs [scrollable]="scrollable()" style="max-width: 40rem;">
      <lib-tab-list
        [orientation]="orientation()"
        [selectionMode]="selectionMode()"
        [(value)]="active"
      >
        <lib-tab value="profile">Profile</lib-tab>
        <lib-tab value="billing">Billing</lib-tab>
        <lib-tab value="team" [disabled]="disableTeam()">Team</lib-tab>
        <lib-tab value="notifications">Notifications</lib-tab>
      </lib-tab-list>

      <lib-tab-panel value="profile">
        Update your name, avatar, and the barbershop bio customers see.
      </lib-tab-panel>
      <lib-tab-panel value="billing">
        Manage cards on file and download past invoices.
      </lib-tab-panel>
      <lib-tab-panel value="team"> Invite barbers and set their working hours. </lib-tab-panel>
      <lib-tab-panel value="notifications">
        Choose which booking events email or text you.
      </lib-tab-panel>
    </lib-tabs>
  `,
})
class TabsPlaygroundDemo {
  readonly orientation = input<TabsOrientation>('horizontal');
  readonly selectionMode = input<TabsSelectionMode>('follow');
  readonly scrollable = input(false);
  readonly disableTeam = input(false);
  protected readonly active = signal('profile');
}

/** Controlled: selection driven from outside the component. */
@Component({
  selector: 'lib-tabs-controlled-demo',
  imports: [...TABS_IMPORTS, TitleCasePipe],
  template: `
    <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4);">
      @for (t of tabs; track t) {
        <button
          type="button"
          style="padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); border: var(--border-width-hairline) solid var(--border); background: var(--surface); color: var(--text-primary); cursor: pointer;"
          (click)="active.set(t)"
        >
          Go to {{ t }}
        </button>
      }
    </div>

    <p style="color: var(--text-secondary); font-size: var(--text-sm);">
      Active tab: <strong>{{ active() }}</strong>
    </p>

    <lib-tabs style="max-width: 40rem;">
      <lib-tab-list [(value)]="active">
        @for (t of tabs; track t) {
          <lib-tab [value]="t">{{ t | titlecase }}</lib-tab>
        }
      </lib-tab-list>
      @for (t of tabs; track t) {
        <lib-tab-panel [value]="t">The {{ t }} panel.</lib-tab-panel>
      }
    </lib-tabs>
  `,
})
class TabsControlledDemo {
  protected readonly tabs = ['overview', 'schedule', 'reviews'];
  protected readonly active = signal('schedule');
}

/** Dynamic + closable: tabs generated from an array the user mutates. */
@Component({
  selector: 'lib-tabs-dynamic-demo',
  imports: [...TABS_IMPORTS],
  template: `
    <lib-tabs style="max-width: 40rem;">
      <lib-tab-list [(value)]="active">
        @for (tab of tabs(); track tab.value) {
          <lib-tab [value]="tab.value" closable (closed)="remove(tab.value)">
            {{ tab.label }}
          </lib-tab>
        }
      </lib-tab-list>
      @for (tab of tabs(); track tab.value) {
        <lib-tab-panel [value]="tab.value">{{ tab.label }} content.</lib-tab-panel>
      }
    </lib-tabs>

    <button
      type="button"
      style="margin-top: var(--space-4); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: var(--border-width-hairline) solid var(--border); background: var(--surface); color: var(--text-primary); cursor: pointer;"
      (click)="add()"
    >
      + Add tab
    </button>
  `,
})
class TabsDynamicDemo {
  private next = 4;
  protected readonly tabs = signal([
    { value: 't1', label: 'Chair 1' },
    { value: 't2', label: 'Chair 2' },
    { value: 't3', label: 'Chair 3' },
  ]);
  protected readonly active = signal('t1');

  protected add(): void {
    const value = `t${this.next++}`;
    this.tabs.update((list) => [...list, { value, label: `Chair ${this.next - 1}` }]);
    this.active.set(value);
  }

  protected remove(value: string): void {
    this.tabs.update((list) => list.filter((t) => t.value !== value));
    if (this.active() === value) {
      this.active.set(this.tabs()[0]?.value ?? '');
    }
  }
}

/** Scrollable: 25 tabs in a constrained width, with the overlap scroll UX. */
@Component({
  selector: 'lib-tabs-scrollable-demo',
  imports: [...TABS_IMPORTS],
  template: `
    <div style="max-width: 34rem;">
      <lib-tabs scrollable>
        <lib-tab-list [(value)]="active">
          @for (n of counts; track n) {
            <lib-tab [value]="'tab' + n">Tab {{ n }}</lib-tab>
          }
        </lib-tab-list>
        @for (n of counts; track n) {
          <lib-tab-panel [value]="'tab' + n">Content for tab {{ n }}.</lib-tab-panel>
        }
      </lib-tabs>
    </div>
  `,
})
class TabsScrollableDemo {
  protected readonly counts = Array.from({ length: 25 }, (_, i) => i + 1);
  protected readonly active = signal('tab1');
}

/** Lazy: panel content is only created the first time its tab activates. */
@Component({
  selector: 'lib-tabs-lazy-demo',
  imports: [...TABS_IMPORTS],
  template: `
    <lib-tabs style="max-width: 40rem;">
      <lib-tab-list selectionMode="explicit" [(value)]="active">
        <lib-tab value="a">Cheap</lib-tab>
        <lib-tab value="b">Expensive</lib-tab>
      </lib-tab-list>

      <lib-tab-panel value="a">Rendered eagerly with the rest of the page.</lib-tab-panel>
      <lib-tab-panel value="b">
        <ng-template libTabContent>
          <p>
            This panel was first created at
            <strong>{{ createdAt }}</strong> — only once its tab was activated.
          </p>
        </ng-template>
      </lib-tab-panel>
    </lib-tabs>
  `,
})
class TabsLazyDemo {
  protected readonly active = signal('a');
  protected get createdAt(): string {
    return new Date().toLocaleTimeString();
  }
}

/** Template: rich headers with icons plus a custom indicator color. */
@Component({
  selector: 'lib-tabs-template-demo',
  imports: [...TABS_IMPORTS, LucideUser, LucideCreditCard, LucideUsers, LucideBell],
  template: `
    <lib-tabs style="max-width: 42rem; --tab-indicator-size: 3px;">
      <lib-tab-list [(value)]="active">
        <lib-tab value="profile"> <svg lucideUser></svg> Profile </lib-tab>
        <lib-tab value="billing"> <svg lucideCreditCard></svg> Billing </lib-tab>
        <lib-tab value="team"> <svg lucideUsers></svg> Team </lib-tab>
        <lib-tab value="alerts"> <svg lucideBell></svg> Alerts </lib-tab>
      </lib-tab-list>

      <lib-tab-panel value="profile">Your public barber profile.</lib-tab-panel>
      <lib-tab-panel value="billing">Cards and invoices.</lib-tab-panel>
      <lib-tab-panel value="team">Barbers and their hours.</lib-tab-panel>
      <lib-tab-panel value="alerts">Booking notifications.</lib-tab-panel>
    </lib-tabs>
  `,
})
class TabsTemplateDemo {
  protected readonly active = signal('profile');
}

/** Tab Menu: router-driven navigation tabs with no panels. */
@Component({
  selector: 'lib-tabs-menu-demo',
  imports: [TabMenu],
  template: `<lib-tab-menu [items]="items" ariaLabel="Account sections" />`,
})
class TabsMenuDemo {
  protected readonly items: TabMenuItem[] = [
    { label: 'Overview', routerLink: '/' },
    { label: 'Bookings', routerLink: '/bookings' },
    { label: 'Earnings', routerLink: '/earnings' },
    { label: 'Reviews', routerLink: '/reviews', disabled: true },
    { label: 'Help center', url: 'https://koureia.gr/help', target: '_blank' },
  ];
}

const meta: Meta<TabsPlaygroundDemo> = {
  title: 'Layout & Navigation/Tabs',
  component: TabsPlaygroundDemo,
  decorators: [
    applicationConfig({
      providers: [
        // A catch-all route so Storybook's own `iframe.html` URL resolves —
        // the tab-menu links navigate within this empty route tree.
        provideRouter([{ path: '**', children: [] }]),
        // The lib ships a Transloco scope (the scroll and × tooltips);
        // without a root config it throws NG0201 on the transpiler token.
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
    moduleMetadata({
      imports: [
        TabsControlledDemo,
        TabsDynamicDemo,
        TabsScrollableDemo,
        TabsLazyDemo,
        TabsTemplateDemo,
        TabsMenuDemo,
      ],
    }),
  ],
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    selectionMode: { control: 'radio', options: ['follow', 'explicit'] },
    scrollable: { control: 'boolean' },
    disableTeam: { control: 'boolean' },
  },
  args: {
    orientation: 'horizontal',
    selectionMode: 'follow',
    scrollable: false,
    disableTeam: false,
  },
};

export default meta;
type Story = StoryObj<TabsPlaygroundDemo>;

/**
 * Interactive sandbox — flip `orientation`, `selectionMode`, `scrollable`,
 * or disable the Team tab with the **Controls** below. Every other example
 * on this page pins a few inputs to isolate one behavior.
 */
export const Playground: Story = {
  parameters: doc(
    'The basic tabs: a `lib-tab-list` of `lib-tab` headers and matching ' +
      '`lib-tab-panel`s, with `[(value)]` tracking the selection. Use the ' +
      '**Controls** to explore orientation, selection mode, and scrolling.',
    `
<lib-tabs>
  <lib-tab-list [(value)]="active">
    <lib-tab value="profile">Profile</lib-tab>
    <lib-tab value="billing">Billing</lib-tab>
    <lib-tab value="team">Team</lib-tab>
  </lib-tab-list>

  <lib-tab-panel value="profile">…</lib-tab-panel>
  <lib-tab-panel value="billing">…</lib-tab-panel>
  <lib-tab-panel value="team">…</lib-tab-panel>
</lib-tabs>
    `,
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  parameters: doc(
    'Set `orientation="vertical"` on `lib-tab-list` — the strip stacks and ' +
      'sits beside its panels, and arrow-key navigation follows the up/down ' +
      'axis. The indicator slides vertically along the inline edge.',
    `
<lib-tabs>
  <lib-tab-list orientation="vertical" [(value)]="active">
    <lib-tab value="profile">Profile</lib-tab>
    <lib-tab value="billing">Billing</lib-tab>
  </lib-tab-list>

  <lib-tab-panel value="profile">…</lib-tab-panel>
  <lib-tab-panel value="billing">…</lib-tab-panel>
</lib-tabs>
    `,
  ),
};

export const Controlled: Story = {
  render: () => ({ template: '<lib-tabs-controlled-demo />' }),
  parameters: doc(
    'Selection is a two-way `[(value)]` binding, so you can drive it from ' +
      'anywhere — here the buttons above set the active tab, and the tabs ' +
      'update the same signal back.',
    `
<button type="button" (click)="active.set('reviews')">Go to reviews</button>
<p>Active tab: <strong>{{ active() }}</strong></p>

<lib-tabs>
  <lib-tab-list [(value)]="active">
    @for (t of tabs; track t) {
      <lib-tab [value]="t">{{ t | titlecase }}</lib-tab>
    }
  </lib-tab-list>
  @for (t of tabs; track t) {
    <lib-tab-panel [value]="t">The {{ t }} panel.</lib-tab-panel>
  }
</lib-tabs>
    `,
  ),
};

export const Dynamic: Story = {
  render: () => ({ template: '<lib-tabs-dynamic-demo />' }),
  parameters: doc(
    'Generate tabs with `@for` over an array. Pair `closable` + `(closed)` ' +
      'with array mutation for add/remove — no special API needed.',
    `
<lib-tabs>
  <lib-tab-list [(value)]="active">
    @for (tab of tabs(); track tab.value) {
      <lib-tab [value]="tab.value" closable (closed)="remove(tab.value)">
        {{ tab.label }}
      </lib-tab>
    }
  </lib-tab-list>
  @for (tab of tabs(); track tab.value) {
    <lib-tab-panel [value]="tab.value">{{ tab.label }} content.</lib-tab-panel>
  }
</lib-tabs>

<button type="button" (click)="add()">+ Add tab</button>
    `,
  ),
};

export const Scrollable: Story = {
  render: () => ({ template: '<lib-tabs-scrollable-demo />' }),
  parameters: doc(
    'With `scrollable` on `lib-tabs`, an overflowing strip shows prev/next ' +
      'buttons. Each click scrolls by ~80% of the viewport, so a few ' +
      'previously-seen tabs stay on screen as anchors (rather than jumping a ' +
      'full page and leaving the next tab half-cut). Keyboard users just ' +
      'arrow through — the focused tab scrolls into view automatically.',
    `
<lib-tabs scrollable>
  <lib-tab-list [(value)]="active">
    @for (n of counts; track n) {
      <lib-tab [value]="'tab' + n">Tab {{ n }}</lib-tab>
    }
  </lib-tab-list>
  @for (n of counts; track n) {
    <lib-tab-panel [value]="'tab' + n">Content for tab {{ n }}.</lib-tab-panel>
  }
</lib-tabs>
    `,
  ),
};

export const SelectOnFocus: Story = {
  args: { selectionMode: 'follow' },
  parameters: doc(
    '`selectionMode="follow"` (the default) is *automatic activation*: ' +
      'arrowing to a tab selects it immediately. Best when panels are cheap. ' +
      'Switch to `explicit` for *manual activation* (arrow to move focus, ' +
      'Enter/Space to commit) when a panel is expensive.',
    `
<lib-tabs>
  <lib-tab-list selectionMode="follow" [(value)]="active">
    <lib-tab value="profile">Profile</lib-tab>
    <lib-tab value="billing">Billing</lib-tab>
  </lib-tab-list>
  …
</lib-tabs>
    `,
  ),
};

export const Lazy: Story = {
  render: () => ({ template: '<lib-tabs-lazy-demo />' }),
  parameters: doc(
    'Wrap a panel body in `<ng-template libTabContent>` so it is only ' +
      'created the first time its tab activates — note the timestamp is ' +
      'stamped on first open, not on page load. Combine with ' +
      '`selectionMode="explicit"` to avoid rendering it on a mere arrow-through.',
    `
<lib-tabs>
  <lib-tab-list selectionMode="explicit" [(value)]="active">
    <lib-tab value="a">Cheap</lib-tab>
    <lib-tab value="b">Expensive</lib-tab>
  </lib-tab-list>

  <lib-tab-panel value="a">Rendered eagerly with the rest of the page.</lib-tab-panel>
  <lib-tab-panel value="b">
    <ng-template libTabContent>…created on first activation…</ng-template>
  </lib-tab-panel>
</lib-tabs>
    `,
  ),
};

export const Disabled: Story = {
  args: { disableTeam: true },
  parameters: doc(
    'Add `disabled` to a `lib-tab`: it renders muted, cannot be selected, ' +
      'and is skipped during arrow-key navigation.',
    `
<lib-tabs>
  <lib-tab-list [(value)]="active">
    <lib-tab value="profile">Profile</lib-tab>
    <lib-tab value="team" disabled>Team</lib-tab>
  </lib-tab-list>
  …
</lib-tabs>
    `,
  ),
};

export const CustomIndicatorAndTemplate: Story = {
  render: () => ({ template: '<lib-tabs-template-demo />' }),
  parameters: doc(
    'Project any markup into a `lib-tab` for rich headers (here, Lucide ' +
      'icons + labels). Restyle the sliding indicator by overriding the ' +
      '`--tab-indicator-color` / `--tab-indicator-size` custom properties on ' +
      '`lib-tabs` (this demo thickens it to 3px).',
    `
<lib-tabs style="--tab-indicator-size: 3px;">
  <lib-tab-list [(value)]="active">
    <lib-tab value="profile"><svg lucideUser></svg> Profile</lib-tab>
    <lib-tab value="billing"><svg lucideCreditCard></svg> Billing</lib-tab>
  </lib-tab-list>

  <lib-tab-panel value="profile">Your public barber profile.</lib-tab-panel>
  <lib-tab-panel value="billing">Cards and invoices.</lib-tab-panel>
</lib-tabs>
    `,
  ),
};

export const TabMenuNavigation: Story = {
  render: () => ({ template: '<lib-tabs-menu-demo />' }),
  parameters: doc(
    '`lib-tab-menu` is a tab-styled `navigation` landmark with no panels — ' +
      'each item is a real `<a>` link, so status-bar preview, open-in-new-tab, ' +
      'and copy-link all work. The active item tracks the route via ' +
      '`routerLinkActive`. External items use `url`/`target`, and the item ' +
      'matching the current route carries `aria-current="page"`.',
    `
<lib-tab-menu [items]="items" ariaLabel="Account sections" />

<!-- items: TabMenuItem[] -->
items: TabMenuItem[] = [
  { label: 'Overview', routerLink: '/' },
  { label: 'Bookings', routerLink: '/bookings' },
  { label: 'Reviews', routerLink: '/reviews', disabled: true },
  { label: 'Help center', url: 'https://koureia.gr/help', target: '_blank' },
];
    `,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'Tabs are built on the headless `@angular/aria` tabs pattern, so the ' +
        'ARIA contract and keyboard model come from Angular rather than ' +
        'hand-rolled scripting.',
      '',
      '- The strip is a `role="tablist"`; each header is a `role="tab"` with ' +
        '`aria-selected`, and each panel is a `role="tabpanel"` wired via ' +
        '`aria-controls` / `aria-labelledby`.',
      '- **Arrow keys** move between tabs (Home/End jump to the ends); with ' +
        '`selectionMode="follow"` they also select, with `explicit` you ' +
        'commit using **Enter/Space**.',
      '- Focus is **roving** by default — only the active tab is in the tab ' +
        'order — and inactive panels are marked `inert`.',
      '- The scroll prev/next buttons are pointer-only: they are ' +
        '`aria-hidden` and out of the tab order, since keyboard users reach ' +
        'every tab with the arrow keys. Their label is therefore a `title` ' +
        'tooltip — an `aria-label` on an `aria-hidden` element is dead ' +
        "markup — as is the closable ×'s `closeAriaLabel`.",
      '- All three labels default to a **translated** string ' +
        '(`scrollPrevAriaLabel`, `scrollNextAriaLabel`, `closeAriaLabel` ' +
        'override them); `lib-tab-menu` marks the current route with ' +
        '`aria-current="page"`.',
      '- The sliding indicator animates a GPU-only `transform`, skips its ' +
        'first-paint animation, and is disabled under `prefers-reduced-motion`.',
    ].join('\n'),
    `
<!-- Labels default to the lib's own Transloco scope; override per instance. -->
<lib-tabs
  scrollable
  scrollPrevAriaLabel="Προηγούμενες καρτέλες"
  scrollNextAriaLabel="Επόμενες καρτέλες">
  <lib-tab-list [(value)]="active">
    <lib-tab value="a" closable closeAriaLabel="Κλείσιμο" (closed)="remove('a')">
      Chair 1
    </lib-tab>
  </lib-tab-list>
  …
</lib-tabs>
    `,
  ),
};

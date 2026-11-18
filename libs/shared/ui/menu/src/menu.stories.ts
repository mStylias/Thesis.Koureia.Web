import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import {
  LucideCalendarPlus,
  LucideCopy,
  LucideLink,
  LucideLogOut,
  LucideMail,
  LucidePencil,
  LucideScissors,
  LucideSettings,
  LucideShare2,
  LucideTrash2,
  LucideUser,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { Menu } from './menu';
import { MenuTrigger } from './menu-trigger';
import { MenuItemTemplate } from './menu-templates';
import { MenuItem } from './menu.types';

/**
 * Shorthand for a per-story description plus an explicit "Show code" snippet.
 * The override is required: every example renders through a demo component
 * (stories cannot hold signals), so the generated source would otherwise show
 * `<lib-menu-*-demo />` — the scaffolding, not the API. The trade-off is that
 * the snippet is static prose and can drift from the demo above it.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

@Component({
  selector: 'lib-menu-basic-demo',
  imports: [Button, Menu, MenuTrigger],
  template: `
    <button libButton [libMenuTriggerFor]="menu">Actions</button>
    <lib-menu #menu [items]="items" ariaLabel="Booking actions" />
  `,
})
class MenuBasicDemo {
  protected readonly items: MenuItem[] = [
    { label: 'Book again', icon: LucideCalendarPlus, shortcut: '⌘B' },
    { label: 'Edit booking', icon: LucidePencil },
    { separator: true },
    { label: 'Copy code', icon: LucideCopy, shortcut: '⌘C' },
    { label: 'Cancel booking', icon: LucideTrash2, disabled: true },
  ];
}

@Component({
  selector: 'lib-menu-headings-demo',
  imports: [Button, Menu, MenuTrigger],
  template: `
    <button libButton variant="outlined" [libMenuTriggerFor]="menu">Account</button>
    <lib-menu #menu [items]="items" ariaLabel="Account" />
  `,
})
class MenuHeadingsDemo {
  protected readonly items: MenuItem[] = [
    { label: 'Signed in as Kimonas', heading: true },
    { label: 'Profile', icon: LucideUser },
    { label: 'Settings', icon: LucideSettings },
    { separator: true },
    { label: 'Session', heading: true },
    { label: 'Sign out', icon: LucideLogOut },
  ];
}

@Component({
  selector: 'lib-menu-submenus-demo',
  imports: [Button, Menu, MenuTrigger],
  template: `
    <button libButton severity="secondary" [libMenuTriggerFor]="menu">Share</button>
    <lib-menu #menu [items]="items" ariaLabel="Share" />
  `,
})
class MenuSubmenusDemo {
  protected readonly items: MenuItem[] = [
    { label: 'Book again', icon: LucideCalendarPlus },
    {
      label: 'Share',
      icon: LucideShare2,
      items: [
        { label: 'Email', icon: LucideMail },
        { label: 'Copy link', icon: LucideLink },
        {
          label: 'More',
          items: [{ label: 'Viber' }, { label: 'WhatsApp' }],
        },
      ],
    },
    { separator: true },
    { label: 'Cancel booking', icon: LucideTrash2 },
  ];
}

@Component({
  selector: 'lib-menu-template-demo',
  imports: [Button, Menu, MenuTrigger, MenuItemTemplate],
  template: `
    <button libButton [libMenuTriggerFor]="menu">Barbers</button>
    <lib-menu #menu [items]="items" ariaLabel="Barbers">
      <ng-template libMenuItem let-item>
        <span
          style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); width: 100%;"
        >
          <span>{{ item.label }}</span>
          <span
            style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted);"
          >
            {{ item.shortcut }}
          </span>
        </span>
      </ng-template>
    </lib-menu>
  `,
})
class MenuTemplateDemo {
  // `shortcut` doubles as the slot for arbitrary trailing data here.
  protected readonly items: MenuItem[] = [
    { label: 'Kimonas', shortcut: '17:30' },
    { label: 'Stavros', shortcut: '18:00' },
    { label: 'Elena', shortcut: '18:30' },
  ];
}

@Component({
  selector: 'lib-menu-command-router-demo',
  imports: [Button, Menu, MenuTrigger],
  template: `
    <button libButton [libMenuTriggerFor]="menu">Navigate</button>
    <lib-menu #menu [items]="items" ariaLabel="Navigation" />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Last command: {{ lastCommand() }}
    </p>
  `,
})
class MenuCommandRouterDemo {
  protected readonly lastCommand = signal('—');
  protected readonly items: MenuItem[] = [
    {
      label: 'Book a cut',
      icon: LucideScissors,
      command: ({ item }) => {
        this.lastCommand.set(`“${item.label}” executed`);
      },
    },
    {
      label: 'My bookings',
      icon: LucideCalendarPlus,
      routerLink: ['/bookings'],
      queryParams: { upcoming: '1' },
    },
    { separator: true },
    {
      label: 'lucide.dev',
      icon: LucideLink,
      url: 'https://lucide.dev',
      target: '_blank',
    },
  ];
}

@Component({
  selector: 'lib-menu-disabled-demo',
  imports: [Button, Menu, MenuTrigger],
  template: `
    <div style="display: flex; gap: var(--space-3); align-items: center;">
      <button libButton [libMenuTriggerFor]="menu" menuDisabled>Menu blocked only</button>
      <button libButton [libMenuTriggerFor]="menu" menuDisabled disabled>
        Blocked and disabled
      </button>
    </div>
    <lib-menu #menu [items]="items" ariaLabel="Booking actions" />
  `,
})
class MenuDisabledDemo {
  protected readonly items: MenuItem[] = [
    { label: 'Book again', icon: LucideCalendarPlus },
    { label: 'Edit booking', icon: LucidePencil },
  ];
}

const meta: Meta<MenuBasicDemo> = {
  title: 'Layout & Navigation/Menu',
  component: MenuBasicDemo,
  decorators: [
    applicationConfig({
      // The command/router demo navigates to a route that only exists
      // here.
      providers: [provideRouter([{ path: '**', children: [] }])],
    }),
    moduleMetadata({
      imports: [
        MenuBasicDemo,
        MenuHeadingsDemo,
        MenuSubmenusDemo,
        MenuTemplateDemo,
        MenuCommandRouterDemo,
        MenuDisabledDemo,
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<MenuBasicDemo>;

export const Basic: Story = {
  parameters: doc(
    'A button-triggered dropdown via the `libMenuTriggerFor` directive. ' +
      'Click toggles it with nothing highlighted, like a native menu; Enter, ' +
      'Space, ArrowDown, and ArrowUp open it with the first item focused. ' +
      'Escape closes and restores focus to the trigger. Shares the `MenuItem` ' +
      'model and the open/focus engine with `ContextMenu`.\n\n' +
      'Hold the items in a field or a `computed()` — rows are compared by ' +
      'reference, so an array rebuilt in the template would churn every row.',
    `
<button libButton [libMenuTriggerFor]="menu">Actions</button>
<lib-menu #menu [items]="items" ariaLabel="Booking actions" />
`,
  ),
};

export const Headings: Story = {
  render: () => ({ template: '<lib-menu-headings-demo />' }),
  parameters: doc(
    '`heading: true` rows label sections of the menu. Each one names a ' +
      '`role="group"` that holds the rows up to the next heading. Headings are not ' +
      'focusable, and are skipped during keyboard navigation.',
    `
<button libButton variant="outlined" [libMenuTriggerFor]="menu">Account</button>
<lib-menu #menu [items]="items" ariaLabel="Account" />

<!-- items -->
[
  { label: 'Signed in as Kimonas', heading: true },
  { label: 'Profile', icon: LucideUser },
  { label: 'Settings', icon: LucideSettings },
  { separator: true },
  { label: 'Session', heading: true },
  { label: 'Sign out', icon: LucideLogOut },
]
`,
  ),
};

export const Submenus: Story = {
  render: () => ({ template: '<lib-menu-submenus-demo />' }),
  parameters: doc(
    'Nest `items` inside an item to build submenus, to any depth. They open ' +
      'on hover or with ArrowRight / Enter and flip at the viewport edge. ' +
      'Each submenu renders in its own overlay pane so it can escape a ' +
      'scrolling ancestor; `[expansionDelay]` tunes the hover delay.',
    `
<button libButton severity="secondary" [libMenuTriggerFor]="menu">Share</button>
<lib-menu #menu [items]="items" ariaLabel="Share" />

<!-- items -->
[
  { label: 'Book again', icon: LucideCalendarPlus },
  {
    label: 'Share',
    icon: LucideShare2,
    items: [
      { label: 'Email', icon: LucideMail },
      { label: 'Copy link', icon: LucideLink },
      { label: 'More', items: [{ label: 'Viber' }, { label: 'WhatsApp' }] },
    ],
  },
  { separator: true },
  { label: 'Cancel booking', icon: LucideTrash2 },
]
`,
  ),
};

export const Template: Story = {
  render: () => ({ template: '<lib-menu-template-demo />' }),
  parameters: doc(
    'An `ng-template[libMenuItem]` replaces the default icon + label + ' +
      'shortcut row for every item, at every submenu depth. The item is the ' +
      'implicit context.',
    `
<button libButton [libMenuTriggerFor]="menu">Barbers</button>
<lib-menu #menu [items]="items" ariaLabel="Barbers">
  <ng-template libMenuItem let-item>
    <span class="row">
      <span>{{ item.label }}</span>
      <span class="time">{{ item.shortcut }}</span>
    </span>
  </ng-template>
</lib-menu>
`,
  ),
};

export const CommandAndRouter: Story = {
  render: () => ({ template: '<lib-menu-command-router-demo />' }),
  parameters: doc(
    'Items run a `command` callback, navigate with `routerLink` (plus ' +
      'optional `queryParams`), or open an external `url`. Link items render ' +
      'as real anchors, so the status bar, modifier-click-to-new-tab, and ' +
      '"copy link address" all work: pointer clicks navigate natively via the ' +
      'anchor, and keyboard activation navigates programmatically. A disabled ' +
      'link renders as a plain row instead — a live `href` would let the ' +
      'browser navigate whatever the menu thinks.',
    `
<button libButton [libMenuTriggerFor]="menu">Navigate</button>
<lib-menu #menu [items]="items" ariaLabel="Navigation" />

<!-- items -->
[
  { label: 'Book a cut', icon: LucideScissors, command: ({ item }) => run(item) },
  {
    label: 'My bookings',
    icon: LucideCalendarPlus,
    routerLink: ['/bookings'],
    queryParams: { upcoming: '1' },
  },
  { separator: true },
  { label: 'lucide.dev', icon: LucideLink, url: 'https://lucide.dev', target: '_blank' },
]
`,
  ),
};

export const DisabledTrigger: Story = {
  render: () => ({ template: '<lib-menu-disabled-demo />' }),
  parameters: doc(
    '`[menuDisabled]` blocks every activation — pointer and keyboard — and ' +
      'marks the trigger `aria-disabled`, so it is announced as disabled ' +
      'rather than reading as operable and quietly doing nothing. It governs ' +
      "the menu only: pass the host element's own `disabled` as well when it " +
      'should also leave the tab order and take the disabled styling.',
    `
<!-- Menu blocked, button still focusable. -->
<button libButton [libMenuTriggerFor]="menu" menuDisabled>Actions</button>

<!-- Usually what you want: both. -->
<button libButton [libMenuTriggerFor]="menu" menuDisabled disabled>Actions</button>

<lib-menu #menu [items]="items" ariaLabel="Booking actions" />
`,
  ),
};

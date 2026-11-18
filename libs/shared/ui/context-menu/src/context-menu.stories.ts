import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import {
  LucideCalendarPlus,
  LucideCopy,
  LucideLink,
  LucideMail,
  LucidePencil,
  LucideScissors,
  LucideShare2,
  LucideTrash2,
} from '@lucide/angular';
import { MenuItem, MenuItemTemplate } from '@ui/menu';
import { ContextMenu } from './context-menu';
import { ContextMenuTrigger } from './context-menu-trigger';

/**
 * A per-story description plus the consumer-facing snippet Storybook shows under
 * "Show code". Every story overrides it: the generated source would otherwise be
 * the `<lib-context-menu-*-demo />` scaffolding, which is not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const TARGET_STYLE = `
  display: grid;
  place-items: center;
  min-height: 10rem;
  padding: var(--space-6);
  border: var(--border-width-hairline) dashed var(--border-strong);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  user-select: none;
`;

@Component({
  selector: 'lib-context-menu-basic-demo',
  imports: [ContextMenu, ContextMenuTrigger],
  template: `
    <div [libContextMenu]="menu" tabindex="0" [style]="targetStyle">
      Right-click here (or focus and press Shift+F10)
    </div>
    <lib-context-menu #menu [items]="items" ariaLabel="Booking actions" />
  `,
})
class ContextMenuBasicDemo {
  protected readonly targetStyle = TARGET_STYLE;
  protected readonly items: MenuItem[] = [
    { label: 'Book again', icon: LucideCalendarPlus, shortcut: '⌘B' },
    { label: 'Edit booking', icon: LucidePencil },
    { separator: true },
    { label: 'Copy code', icon: LucideCopy, shortcut: '⌘C' },
    { label: 'Cancel booking', icon: LucideTrash2, disabled: true },
  ];
}

@Component({
  selector: 'lib-context-menu-submenus-demo',
  imports: [ContextMenu, ContextMenuTrigger],
  template: `
    <div [libContextMenu]="menu" tabindex="0" [style]="targetStyle">
      Right-click and hover “Share” — submenus open on hover or ArrowRight
    </div>
    <lib-context-menu #menu [items]="items" ariaLabel="Booking actions" />
  `,
})
class ContextMenuSubmenusDemo {
  protected readonly targetStyle = TARGET_STYLE;
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
  selector: 'lib-context-menu-global-demo',
  imports: [ContextMenu],
  template: `
    <div [style]="targetStyle">
      No trigger attached — right-click <em>anywhere</em> in this page
    </div>
    <lib-context-menu global [items]="items" ariaLabel="Page actions" />
  `,
})
class ContextMenuGlobalDemo {
  protected readonly targetStyle = TARGET_STYLE;
  protected readonly items: MenuItem[] = [
    { label: 'Book a cut', icon: LucideScissors },
    { label: 'Copy page link', icon: LucideLink },
  ];
}

@Component({
  selector: 'lib-context-menu-template-demo',
  imports: [ContextMenu, ContextMenuTrigger, MenuItemTemplate],
  template: `
    <div [libContextMenu]="menu" tabindex="0" [style]="targetStyle">
      Right-click for custom-rendered rows
    </div>
    <lib-context-menu #menu [items]="items" ariaLabel="Barbers">
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
    </lib-context-menu>
  `,
})
class ContextMenuTemplateDemo {
  protected readonly targetStyle = TARGET_STYLE;
  // `shortcut` doubles as the slot for arbitrary trailing data here.
  protected readonly items: MenuItem[] = [
    { label: 'Kimonas', shortcut: '17:30' },
    { label: 'Stavros', shortcut: '18:00' },
    { label: 'Elena', shortcut: '18:30' },
  ];
}

@Component({
  selector: 'lib-context-menu-command-demo',
  imports: [ContextMenu, ContextMenuTrigger],
  template: `
    <div [libContextMenu]="menu" tabindex="0" [style]="targetStyle">
      Right-click and pick an action
    </div>
    <lib-context-menu #menu [items]="items" ariaLabel="Actions" />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Last command: {{ lastCommand() }}
    </p>
  `,
})
class ContextMenuCommandDemo {
  protected readonly targetStyle = TARGET_STYLE;
  protected readonly lastCommand = signal('—');
  protected readonly items: MenuItem[] = [
    {
      label: 'Book again',
      icon: LucideCalendarPlus,
      command: ({ item }) => {
        this.lastCommand.set(`“${item.label}” executed`);
      },
    },
    {
      label: 'Copy code',
      icon: LucideCopy,
      command: ({ item }) => {
        this.lastCommand.set(`“${item.label}” executed`);
      },
    },
  ];
}

@Component({
  selector: 'lib-context-menu-router-demo',
  imports: [ContextMenu, ContextMenuTrigger],
  template: `
    <div [libContextMenu]="menu" tabindex="0" [style]="targetStyle">
      Right-click for navigation items
    </div>
    <lib-context-menu #menu [items]="items" ariaLabel="Navigation" />
  `,
})
class ContextMenuRouterDemo {
  protected readonly targetStyle = TARGET_STYLE;
  protected readonly items: MenuItem[] = [
    {
      label: 'My bookings',
      icon: LucideCalendarPlus,
      routerLink: ['/bookings'],
      queryParams: { upcoming: '1' },
    },
    { label: 'Book a cut', icon: LucideScissors, routerLink: '/book' },
    { separator: true },
    {
      label: 'lucide.dev',
      icon: LucideLink,
      url: 'https://lucide.dev',
      target: '_blank',
    },
  ];
}

const meta: Meta<ContextMenuBasicDemo> = {
  title: 'Overlays/Context menu',
  component: ContextMenuBasicDemo,
  decorators: [
    applicationConfig({
      // The demos navigate to routes that only exist here.
      providers: [provideRouter([{ path: '**', children: [] }])],
    }),
    moduleMetadata({
      imports: [
        ContextMenuBasicDemo,
        ContextMenuSubmenusDemo,
        ContextMenuGlobalDemo,
        ContextMenuTemplateDemo,
        ContextMenuCommandDemo,
        ContextMenuRouterDemo,
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<ContextMenuBasicDemo>;

const BASIC_ITEMS = `
protected readonly items: MenuItem[] = [
  { label: 'Book again', icon: LucideCalendarPlus, shortcut: '⌘B' },
  { label: 'Edit booking', icon: LucidePencil },
  { separator: true },
  { label: 'Copy code', icon: LucideCopy, shortcut: '⌘C' },
  { label: 'Cancel booking', icon: LucideTrash2, disabled: true },
];
`;

/**
 * Attach a menu to any element with the `libContextMenu` trigger
 * directive. It opens at the pointer on right-click, on touch
 * long-press, and — anchored to the element — on Shift+F10 for
 * keyboard users. Escape closes and restores focus; disabled items
 * stay focusable but never activate.
 */
export const Basic: Story = {
  parameters: doc(
    'The trigger directive is the whole integration: point it at a `lib-context-menu` and give the menu an `ariaLabel`.',
    `
<!-- tabindex makes the target reachable, so Shift+F10 can open the menu. -->
<div [libContextMenu]="menu" tabindex="0">Right-click here</div>
<lib-context-menu #menu [items]="items" ariaLabel="Booking actions" />
` + BASIC_ITEMS,
  ),
};

/**
 * Nest `items` inside an item to build submenus. They open on hover
 * (after a short delay) or with ArrowRight / Enter, close with
 * ArrowLeft or Escape, and flip to the other side at the viewport
 * edge.
 */
export const Submenus: Story = {
  render: () => ({ template: '<lib-context-menu-submenus-demo />' }),
  parameters: doc(
    'Submenu state, keyboard behaviour, and the ARIA wiring come from the headless `@angular/aria/menu` pattern.',
    `
protected readonly items: MenuItem[] = [
  { label: 'Book again', icon: LucideCalendarPlus },
  {
    label: 'Share',
    icon: LucideShare2,
    items: [
      { label: 'Email', icon: LucideMail },
      { label: 'Copy link', icon: LucideLink },
      // Nesting is unbounded; each level is its own overlay pane.
      { label: 'More', items: [{ label: 'Viber' }, { label: 'WhatsApp' }] },
    ],
  },
  { separator: true },
  { label: 'Cancel booking', icon: LucideTrash2 },
];
`,
    'ts',
  ),
};

/**
 * With the `global` attribute the menu listens on the document — no
 * trigger directive needed. Best for full-page surfaces.
 */
export const Global: Story = {
  render: () => ({ template: '<lib-context-menu-global-demo />' }),
  parameters: doc(
    'Use `global` for a whole-page menu. There is no trigger element, so nothing carries `aria-haspopup` — keyboard users reach it with Shift+F10 on whatever holds focus.',
    `
<!-- No trigger directive: right-click anywhere in the document. -->
<lib-context-menu global [items]="items" ariaLabel="Page actions" />
    `,
  ),
};

/**
 * A `libMenuItem` template replaces the default icon + label +
 * shortcut row for every item, at every submenu depth.
 */
export const Template: Story = {
  render: () => ({ template: '<lib-context-menu-template-demo />' }),
  parameters: doc(
    'One template replaces the row for every item, at every depth. The `MenuItem` is the implicit context, so extra fields ride along on it.',
    `
<lib-context-menu #menu [items]="items" ariaLabel="Barbers">
  <ng-template libMenuItem let-item>
    <span class="row">
      <span>{{ item.label }}</span>
      <span class="row-meta">{{ item.shortcut }}</span>
    </span>
  </ng-template>
</lib-context-menu>
    `,
  ),
};

/**
 * `command` callbacks receive the originating event and the item.
 * The menu closes and focus returns to the target after execution.
 */
export const Command: Story = {
  render: () => ({ template: '<lib-context-menu-command-demo />' }),
  parameters: doc(
    '`command` runs before the menu closes and focus returns to the trigger, so a handler can move focus somewhere else if it needs to.',
    `
protected readonly items: MenuItem[] = [
  {
    label: 'Book again',
    icon: LucideCalendarPlus,
    command: ({ item, originalEvent }) => {
      this.lastCommand.set(item.label);
    },
  },
  { label: 'Copy code', icon: LucideCopy, command: () => this.copyCode() },
];
`,
    'ts',
  ),
};

/**
 * Items navigate with `routerLink` (plus optional `queryParams`) or
 * open external `url`s in an optional `target` window.
 */
export const Router: Story = {
  render: () => ({ template: '<lib-context-menu-router-demo />' }),
  parameters: doc(
    'Link items render as real `<a>` anchors, so the status bar, copy-link and modifier/middle-click new-tab all work. Pointer clicks navigate natively; keyboard activation navigates programmatically.',
    `
protected readonly items: MenuItem[] = [
  {
    label: 'My bookings',
    icon: LucideCalendarPlus,
    routerLink: ['/bookings'],
    queryParams: { upcoming: '1' },
  },
  { label: 'Book a cut', icon: LucideScissors, routerLink: '/book' },
  { separator: true },
  // An external url; target is optional and adds rel="noopener".
  { label: 'lucide.dev', icon: LucideLink, url: 'https://lucide.dev', target: '_blank' },
];
`,
    'ts',
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'The WAI-ARIA menu pattern comes from headless `@angular/aria/menu`, so navigation and the `menu`/`menuitem` contract are not reimplemented here.',
      '',
      '- **Keyboard invocation**: Shift+F10 and the ContextMenu key open the menu anchored to the target element, since those events carry no usable pointer coordinates. The target needs to be focusable for that to be reachable.',
      '- **Initial focus differs by input**: a keyboard open highlights the first item so arrow keys can start immediately; a pointer open focuses the menu container with nothing highlighted, matching native context menus.',
      '- **Escape** closes the menu and restores focus to whatever was focused when it opened. Tab out closes it too.',
      '- **Name the menu**: `role="menu"` has no other source of an accessible name, so always pass `ariaLabel`.',
      '- **`aria-haspopup="menu"`** is on the trigger, and is withheld while `contextMenuDisabled` — advertising a menu that will not open is the same defect as leaving an edit affordance on a read-only control. A disabled trigger also leaves the native browser menu alone.',
      '- **Disabled items** stay focusable and discoverable, and simply never activate.',
      '- Row highlight is pointer-only (`:hover` + `:focus-visible`), never plain `:focus`, because the pattern moves focus on hover.',
    ].join('\n'),
    `
<!-- Focusable target + a named menu is the whole accessibility contract. -->
<div [libContextMenu]="menu" [contextMenuDisabled]="readonly()" tabindex="0">
  Right-click, or focus and press Shift+F10
</div>
<lib-context-menu #menu [items]="items" ariaLabel="Booking actions" />
    `,
  ),
};

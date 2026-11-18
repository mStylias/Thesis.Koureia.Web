import { Component, input, linkedSignal, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import {
  LucideCalendar,
  LucideChartNoAxesColumn,
  LucideCircleQuestionMark,
  LucideHouse,
  LucideMenu,
  LucidePanelLeft,
  LucideScissors,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { Sidebar, SidebarBrand, SidebarBrandText } from './sidebar';
import { SidebarGroup } from './sidebar.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-sidebar-*-demo />` — the scaffolding, not the API. Overriding
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

/** The nav array behind every snippet below. */
const NAV_SNIPPET = `
nav: SidebarGroup[] = [
  { items: [{ label: 'Αρχική', icon: LucideHouse, routerLink: '/' }] },
  {
    label: 'Διαχείριση',
    items: [
      {
        label: 'Υπηρεσίες',
        icon: LucideScissors,
        items: [{ label: 'Κουρέματα', routerLink: '/services/haircuts' }],
      },
      { label: 'Ρυθμίσεις', icon: LucideSettings, routerLink: '/settings' },
    ],
  },
];`;

const NAV: readonly SidebarGroup[] = [
  {
    items: [
      { label: 'Αρχική', icon: LucideHouse, routerLink: '/' },
      { label: 'Ραντεβού', icon: LucideCalendar, routerLink: '/bookings' },
      { label: 'Πελάτες', icon: LucideUsers, routerLink: '/customers' },
    ],
  },
  {
    label: 'Διαχείριση',
    items: [
      {
        label: 'Υπηρεσίες',
        icon: LucideScissors,
        items: [
          { label: 'Κουρέματα', routerLink: '/services/haircuts' },
          { label: 'Ξυρίσματα', routerLink: '/services/shaves' },
          { label: 'Περιποίηση γενιού', routerLink: '/services/beard' },
        ],
      },
      {
        label: 'Στατιστικά',
        icon: LucideChartNoAxesColumn,
        routerLink: '/stats',
        disabled: true,
      },
      { label: 'Ρυθμίσεις', icon: LucideSettings, routerLink: '/settings' },
    ],
  },
  {
    items: [
      {
        label: 'Βοήθεια',
        icon: LucideCircleQuestionMark,
        url: 'https://koureia.gr/help',
        target: '_blank',
      },
    ],
  },
];

@Component({
  selector: 'lib-sidebar-playground-demo',
  imports: [Sidebar, SidebarBrand, SidebarBrandText, Button, LucidePanelLeft],
  template: `
    <div
      style="display: flex; height: 480px; border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg); overflow: hidden;"
    >
      <lib-sidebar
        #nav
        [groups]="groups()"
        [(collapsed)]="collapsedState"
        [compact]="compact()"
        [ariaLabel]="ariaLabel()"
      >
        <a
          *libSidebarBrand
          href="#"
          style="display: flex; align-items: center; gap: var(--space-3); color: var(--text-primary); text-decoration: none;"
        >
          <img
            src="/brand/icon.svg"
            alt=""
            style="width: var(--icon-size-lg); height: var(--icon-size-lg); flex-shrink: 0;"
          />
          <span
            libSidebarBrandText
            style="font-family: var(--font-display); font-size: var(--text-lg); font-weight: var(--weight-bold);"
          >
            Koureia
          </span>
        </a>
      </lib-sidebar>

      <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
        <!-- The trigger lives OUT here, not on the panel it resizes.
             In a real shell this is lib-topbar's showSidebarToggle; the
             point is that it is anchored outside the panel it resizes, so
             it has no motion of its own — it rides the content column's
             reflow rather than repositioning inside a moving panel. -->
        <div
          style="display: flex; align-items: center; height: var(--shell-header-height); padding-inline: var(--space-3); border-bottom: var(--border-width-hairline) solid var(--border);"
        >
          <button
            libButton
            type="button"
            variant="text"
            severity="secondary"
            iconOnly
            rounded
            aria-label="Πλαϊνή μπάρα πλοήγησης"
            [attr.aria-expanded]="!collapsedState()"
            [attr.aria-controls]="nav.navId"
            (click)="collapsedState.set(!collapsedState())"
          >
            <svg
              lucidePanelLeft
              style="width: var(--icon-size-md); height: var(--icon-size-md); stroke-width: var(--icon-stroke);"
            ></svg>
          </button>
        </div>

        <main style="flex: 1; min-width: 0; padding: var(--space-6);">
          <p style="margin: 0; color: var(--text-secondary);">
            Page content — it reflows as the sidebar collapses to the icon rail. Collapse it: the
            brand icon stays exactly where it is, the copy fades out ahead of the narrowing, and
            hovering or focusing an option then shows its name in a tooltip.
          </p>
        </main>
      </div>
    </div>
  `,
})
class SidebarPlaygroundDemo {
  readonly collapsed = input(false);
  readonly compact = input(false);
  readonly ariaLabel = input('');
  readonly groups = input<readonly SidebarGroup[]>(NAV);

  // The control sets the initial state; the demo's own toggle (and the
  // sidebar itself, when a rail submenu parent is activated) writes back.
  readonly collapsedState = linkedSignal(() => this.collapsed());
}

@Component({
  selector: 'lib-sidebar-mobile-demo',
  imports: [Sidebar, SidebarBrand, SidebarBrandText, LucideMenu, Button],
  template: `
    <header
      style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-bottom: var(--border-width-hairline) solid var(--border);"
    >
      <button
        libButton
        type="button"
        variant="text"
        severity="secondary"
        iconOnly
        rounded
        aria-label="Άνοιγμα πλοήγησης"
        (click)="navOpen.set(true)"
      >
        <svg
          lucideMenu
          style="width: var(--icon-size-md); height: var(--icon-size-md); stroke-width: var(--icon-stroke);"
        ></svg>
      </button>
      <strong style="font-family: var(--font-display);">Koureia</strong>
    </header>

    <lib-sidebar [groups]="groups" [(mobileOpen)]="navOpen">
      <span *libSidebarBrand style="display: flex; align-items: center; gap: var(--space-3);">
        <img
          src="/brand/icon.svg"
          alt=""
          style="width: var(--icon-size-lg); height: var(--icon-size-lg);"
        />
        <span
          libSidebarBrandText
          style="font-family: var(--font-display); font-size: var(--text-lg); font-weight: var(--weight-bold);"
        >
          Koureia
        </span>
      </span>
    </lib-sidebar>

    <main style="padding: var(--space-6);">
      <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
        Narrow the viewport below 1024px (or pick a mobile viewport in the toolbar), then tap the
        hamburger — the sidebar opens as a modal drawer and closes itself on navigation, Escape, or
        a backdrop tap.
      </p>
    </main>
  `,
})
class SidebarMobileDemo {
  protected readonly navOpen = signal(false);
  protected readonly groups = NAV;
}

const meta: Meta<SidebarPlaygroundDemo> = {
  title: 'Layout & Navigation/Sidebar',
  component: SidebarPlaygroundDemo,
  decorators: [
    // A catch-all route so Storybook's own `iframe.html` URL resolves —
    // the sidebar links navigate within this empty route tree.
    applicationConfig({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
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
      imports: [SidebarPlaygroundDemo, SidebarMobileDemo],
    }),
  ],
  argTypes: {
    collapsed: { control: 'boolean' },
    compact: { control: 'boolean' },
    ariaLabel: { control: 'text' },
  },
  args: {
    collapsed: false,
    compact: false,
    ariaLabel: '',
  },
};

export default meta;
type Story = StoryObj<SidebarPlaygroundDemo>;

/**
 * Interactive sandbox — work the collapse toggle beside the sidebar, or
 * flip the inputs with the controls below.
 */
export const Playground: Story = {
  parameters: doc(
    'The sidebar starts **expanded**. Its header row holds only the ' +
      'projected `*libSidebarBrand` template; groups are separated by ' +
      'hairlines, and the optional group `label` renders as a small ' +
      'heading. Options are real links — the current route is marked ' +
      '`aria-current="page"`.\n\n' +
      'The sidebar ships **no collapse trigger**. Bind `[(collapsed)]` to ' +
      'a button outside it — `lib-topbar` has one built in ' +
      '(`showSidebarToggle`). A trigger mounted on the panel that is ' +
      'itself resizing has to reposition mid-animation, and the eye then ' +
      'follows the moving button instead of the panel.',
    `
<lib-sidebar #nav [groups]="nav" [(collapsed)]="collapsed">
  <a *libSidebarBrand routerLink="/">
    <img src="/brand/icon.svg" alt="" />
    <span libSidebarBrandText>Barbershop</span>
  </a>
</lib-sidebar>

<!-- The trigger lives outside. aria-controls reads the nav landmark's
     id straight off the sidebar. -->
<lib-topbar showSidebarToggle [(sidebarCollapsed)]="collapsed"
  [sidebarControls]="nav.navId" />
${NAV_SNIPPET}
    `,
  ),
};

export const Collapsed: Story = {
  args: { collapsed: true },
  parameters: doc(
    'Collapsed, only the icons remain: the labels and group headings fade ' +
      'out (they stay in the accessibility tree, so every link keeps its ' +
      'name), the brand text hides via `libSidebarBrandText`, and hovering ' +
      'or focusing an option shows its name in a **tooltip on the right** — ' +
      'reusing `@ui/tooltip`. Bind `[(collapsed)]` to persist the ' +
      'state.\n\n' +
      'The **brand icon stays** — it sits on the same column as the option ' +
      'icons below and does not move by a pixel, so the rail is visibly ' +
      'the same sidebar rather than a different header. Watch the ' +
      'choreography either way: collapsing, the copy fades out first and ' +
      'then the rail narrows; expanding, the rail widens first and the ' +
      'copy fades in as it settles. Text never has to survive being ' +
      'squeezed.',
    `
<!-- The rail is a state, not a mode: bind it to persist it. -->
<lib-sidebar [groups]="nav" [(collapsed)]="collapsed">
  <a *libSidebarBrand routerLink="/">
    <!-- Stays visible in the rail, on the option-icon column. -->
    <img src="/brand/icon.svg" alt="" />
    <!-- Fades out with the option labels, ahead of the narrowing. -->
    <span libSidebarBrandText>Barbershop</span>
  </a>
</lib-sidebar>
    `,
  ),
};

export const Submenus: Story = {
  parameters: doc(
    'Give an item `items` to make it **expandable** (one level): it ' +
      'renders as a toggle with `aria-expanded`, and its children expand ' +
      'below with the grid-rows height animation. Set `expanded: true` to ' +
      'start open. In the collapsed rail, activating a parent **expands ' +
      'the sidebar** and opens that submenu — children never render in ' +
      'the rail.',
    `
nav: SidebarGroup[] = [
  {
    label: 'Διαχείριση',
    items: [
      {
        label: 'Υπηρεσίες',
        icon: LucideScissors,
        expanded: true, // omit to start closed
        items: [
          { label: 'Κουρέματα', routerLink: '/services/haircuts' },
          { label: 'Ξυρίσματα', routerLink: '/services/shaves' },
        ],
      },
    ],
  },
];
    `,
    'ts',
  ),
};

export const Compact: Story = {
  args: { compact: true },
  parameters: doc(
    'Set `compact` for denser rows in option-heavy navigations. Desktop ' +
      'only — the mobile drawer always keeps comfortable 44px touch ' +
      'targets.',
    `
<lib-sidebar [groups]="nav" compact>
  <a *libSidebarBrand routerLink="/">…</a>
</lib-sidebar>
    `,
  ),
};

export const Mobile: Story = {
  render: () => ({ template: '<lib-sidebar-mobile-demo />' }),
  parameters: {
    ...doc(
      'Below **1024px** the sidebar leaves the flow entirely and instead ' +
        'opens as a **modal drawer** (reusing `@ui/drawer`: focus ' +
        'trap, backdrop, Escape) with full labels — never the icon rail. ' +
        'The sidebar renders no trigger of its own; bind `[(mobileOpen)]` ' +
        'to your own hamburger button. It closes itself on navigation, ' +
        'Escape, and backdrop taps. Preview with a mobile viewport from ' +
        'the toolbar.',
      `
<!-- The sidebar ships no trigger — bind your own hamburger. -->
<header>
  <button libButton type="button" variant="text" iconOnly rounded
    aria-label="Άνοιγμα πλοήγησης"
    (click)="navOpen.set(true)">
    <svg lucideMenu></svg>
  </button>
</header>

<lib-sidebar [groups]="nav" [(mobileOpen)]="navOpen">
  <span *libSidebarBrand>
    <img src="/brand/icon.svg" alt="" />
    <span libSidebarBrandText>Barbershop</span>
  </span>
</lib-sidebar>
      `,
    ),
    viewport: { defaultViewport: 'mobile1' },
  },
};

export const Accessibility: Story = {
  parameters: doc(
    [
      '- The list renders inside a `<nav>` **navigation landmark** named by ' +
        '`ariaLabel` (default: a translated "Κύρια πλοήγηση").',
      '- Options are **real `<a>` anchors** — status bar, middle-click, and ' +
        'copy-link all work; the active route carries `aria-current="page"`.',
      "- The collapse toggle is **not** the sidebar's: point your own " +
        "button's `aria-controls` at `navId` (the `<nav>` landmark) and " +
        'carry the state on `aria-expanded`, keeping the name stable. ' +
        "`lib-topbar`'s `showSidebarToggle` does exactly that.",
      '- Collapsed, labels stay in the DOM (faded and clipped), so links ' +
        'keep their **accessible names**; tooltips appear on hover *and* ' +
        'focus, and dismiss on Escape (WCAG 1.4.13).',
      '- Disabled options are `aria-disabled="true"` and removed from the ' +
        'tab order; rows keep a 44px minimum target size.',
      '- Keyboard focus shows the standard 2px accent ring; all motion ' +
        'respects `prefers-reduced-motion`.',
    ].join('\n'),
    `
<!-- ariaLabel overrides the translated landmark name; items carry their
     own semantics from the data (disabled, external target, submenus). -->
<lib-sidebar [groups]="nav" ariaLabel="Πλοήγηση λογαριασμού">
  <a *libSidebarBrand routerLink="/">…</a>
</lib-sidebar>

nav: SidebarGroup[] = [
  { items: [
    { label: 'Στατιστικά', icon: LucideChartNoAxesColumn, routerLink: '/stats', disabled: true },
    { label: 'Βοήθεια', icon: LucideCircleQuestionMark, url: 'https://koureia.gr/help', target: '_blank' },
  ] },
];
    `,
  ),
};

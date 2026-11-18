import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import {
  LucideBell,
  LucideCalendar,
  LucideChartNoAxesColumn,
  LucideHouse,
  LucideScissors,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { Sidebar, SidebarBrand, SidebarBrandText } from '@ui/sidebar';
import type { SidebarGroup } from '@ui/sidebar';
import { Topbar } from './topbar';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through the
 * shell demo component, because a story object cannot hold the signals the
 * example needs. Storybook's generated source would therefore read
 * `<lib-topbar-shell-demo />` — the scaffolding, not the API. Overriding
 * `docs.source.code` shows what a consumer would actually paste.
 *
 * The trade-off is that a snippet is static: it does not follow the
 * controls, and it is documentation rather than compiled code, so keep it
 * in step with the demo component above.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/** The L-shape shell every story on this page renders. */
const SHELL_SNIPPET = `
<div style="display: flex;">
  <lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">
    <a *libSidebarBrand routerLink="/">
      <img src="/brand/icon.svg" alt="" />
      <span libSidebarBrandText>Barbershop</span>
    </a>
  </lib-sidebar>

  <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
    <!-- One signal per state, bound to both bars: the top bar owns BOTH of
         the sidebar's triggers (collapse on desktop, hamburger below it). -->
    <lib-topbar
      [(menuOpen)]="navOpen"
      showSidebarToggle
      [(sidebarCollapsed)]="collapsed"
      [sidebarControls]="nav.navId">
      <h1 libTopbarStart class="t-title">Ραντεβού</h1>
      <div libTopbarEnd>
        <button libButton type="button" variant="text" severity="secondary" iconOnly rounded
          aria-label="Ειδοποιήσεις">
          <svg lucideBell></svg>
        </button>
        <button libButton type="button" severity="secondary" variant="outlined">
          Λογαριασμός
        </button>
      </div>
    </lib-topbar>

    <main><!-- routed content --></main>
  </div>
</div>`;

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
      { label: 'Υπηρεσίες', icon: LucideScissors, routerLink: '/services' },
      { label: 'Στατιστικά', icon: LucideChartNoAxesColumn, routerLink: '/stats' },
      { label: 'Ρυθμίσεις', icon: LucideSettings, routerLink: '/settings' },
    ],
  },
];

// The app shell: a full-height sidebar on the left and, to its right, a
// content column whose top bar's bottom hairline continues the line the
// sidebar draws under its header — the whole point of the component.
@Component({
  selector: 'lib-topbar-shell-demo',
  imports: [Topbar, Sidebar, SidebarBrand, SidebarBrandText, Button, LucideBell],
  template: `
    <div
      style="display: flex; height: 520px; border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg); overflow: hidden;"
    >
      <lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">
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
        <lib-topbar
          [(menuOpen)]="navOpen"
          showSidebarToggle
          [(sidebarCollapsed)]="collapsed"
          [sidebarControls]="nav.navId"
        >
          <h1
            libTopbarStart
            style="margin: 0; font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--weight-bold);"
          >
            Ραντεβού
          </h1>
          <div libTopbarEnd>
            <button
              libButton
              type="button"
              variant="text"
              severity="secondary"
              iconOnly
              rounded
              aria-label="Ειδοποιήσεις"
            >
              <svg
                lucideBell
                style="width: var(--icon-size-md); height: var(--icon-size-md); stroke-width: var(--icon-stroke);"
              ></svg>
            </button>
            <button libButton type="button" severity="secondary" variant="outlined">
              Λογαριασμός
            </button>
          </div>
        </lib-topbar>

        <main style="flex: 1; min-width: 0; padding: var(--space-6); overflow: auto;">
          <p style="margin: 0; color: var(--text-secondary);">
            Collapse the sidebar from the toggle at the start of this bar. The button has no motion
            of its own — it rides in with the whole content column on the rail's curve, instead of
            repositioning inside a panel that is itself moving — and the top bar's bottom edge stays
            welded to the sidebar's header separator, so the line across the top never breaks.
            Narrow the viewport below 1024px and the sidebar becomes a drawer while that toggle
            gives way to the hamburger.
          </p>
        </main>
      </div>
    </div>
  `,
})
class TopbarShellDemo {
  protected readonly groups = NAV;
  protected readonly collapsed = signal(false);
  protected readonly navOpen = signal(false);
}

const meta: Meta<TopbarShellDemo> = {
  title: 'Layout & Navigation/Topbar',
  component: TopbarShellDemo,
  decorators: [
    applicationConfig({
      providers: [
        // A catch-all route so the sidebar links resolve within Storybook.
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
    moduleMetadata({ imports: [TopbarShellDemo] }),
  ],
};

export default meta;
type Story = StoryObj<TopbarShellDemo>;

/**
 * The top bar in its intended L-shape shell: a full-height sidebar on the
 * left, a content column on the right whose top bar continues the
 * sidebar's header separator into one unbroken horizontal line. Leading
 * content goes in `[libTopbarStart]`, right-pinned actions in
 * `[libTopbarEnd]`.
 */
export const Shell: Story = {
  parameters: doc(
    'The bar height is `--topbar-height`, which defaults to the shared ' +
      '`--shell-header-height` token the sidebar header pins itself to — so ' +
      "its bottom hairline lands exactly on the sidebar's, meeting as a " +
      "single line at the sidebar's right edge. Both are **fixed** heights " +
      'rather than minimums, so neither a tall page title here nor the ' +
      'brand there can move the line; collapsing the sidebar reflows the ' +
      'content column but never moves it either.\n\n' +
      '`showSidebarToggle` puts the collapse control here rather than on ' +
      'the sidebar. That is a motion decision as much as a layout one: a ' +
      'button mounted on the panel it resizes has to reposition *within* ' +
      'it mid-animation, and the eye follows the moving button instead of ' +
      'the panel. Anchored to the bar it has no motion of its own — it ' +
      "rides in with the content column on the rail's own curve and just " +
      'swaps its icon in place. Bind `[(sidebarCollapsed)]` to the ' +
      "sidebar's `[(collapsed)]`, and read `[sidebarControls]` off the " +
      'sidebar reference so `aria-controls` names the nav landmark.',
    SHELL_SNIPPET,
  ),
};

/**
 * Below 1024px the sidebar leaves the flow and opens as a modal drawer;
 * the top bar then shows the hamburger it owns. Bind one signal to both
 * `[(menuOpen)]` (here) and the sidebar's `[(mobileOpen)]`.
 */
export const Mobile: Story = {
  parameters: {
    ...doc(
      'The hamburger appears only below the sidebar breakpoint (1024px), ' +
        'where the sidebar is a drawer; the collapse toggle appears only ' +
        'above it, where there is a rail to collapse to. Both live in this ' +
        'bar, on exactly inverse media queries, so **one of the two is ' +
        'ever visible** — and the hidden one is `display: none` on its ' +
        'wrapper, out of the tab order and the a11y tree entirely. Preview ' +
        'with a mobile viewport from the toolbar.',
      `
<!-- Bind ONE signal per state to both, or the triggers control nothing. -->
<lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">…</lib-sidebar>

<lib-topbar
  [(menuOpen)]="navOpen"
  showSidebarToggle
  [(sidebarCollapsed)]="collapsed"
  [sidebarControls]="nav.navId">
  <h1 libTopbarStart class="t-title">Ραντεβού</h1>
</lib-topbar>
      `,
    ),
    viewport: { defaultViewport: 'mobile1' },
  },
};

/**
 * Accessibility notes.
 */
export const Accessibility: Story = {
  parameters: doc(
    [
      '- The bar is the page `banner` landmark (there must be at most one; ' +
        'the sidebar provides the `navigation` landmark).',
      '- The hamburger is a real `<button>` with `aria-haspopup="dialog"`, ' +
        '`aria-expanded` reflecting the drawer state, and a translated ' +
        '`aria-label` (override with `menuAriaLabel`).',
      '- The collapse toggle is a disclosure: `aria-expanded` for the rail ' +
        'state, `aria-controls` pointing at the `<nav>` landmark it ' +
        'expands (`[sidebarControls]="nav.navId"`), and a **stable** ' +
        'translated name ("Πλαϊνή μπάρα πλοήγησης"). It names the region, ' +
        'not the action — a name that flipped between "Collapse" and ' +
        '"Expand" would be re-announced under the user\'s own focus.',
      '- Each trigger is hidden outside its breakpoint via `display: none` ' +
        'on its wrapper, so it leaves the tab order and the a11y tree ' +
        'entirely — never just visually hidden.',
      "- The toggle's icon swap cross-fades in place and is gated on the " +
        'first user toggle, so nothing animates on first paint; the ' +
        "sidebar's own collapse motion respects `prefers-reduced-motion`.",
      '- Keyboard focus shows the standard 2px accent ring; projected ' +
        'actions bring their own semantics.',
    ].join('\n'),
    `
<!-- One banner per page. Give the heading real heading semantics, and
     name every icon-only action you project. -->
<lib-topbar
  [(menuOpen)]="navOpen"
  menuAriaLabel="Άνοιγμα πλοήγησης"
  showSidebarToggle
  [(sidebarCollapsed)]="collapsed"
  [sidebarControls]="nav.navId"
  sidebarToggleAriaLabel="Πλαϊνή μπάρα πλοήγησης">
  <h1 libTopbarStart class="t-title">Ραντεβού</h1>
  <div libTopbarEnd>
    <button libButton type="button" variant="text" iconOnly rounded
      aria-label="Ειδοποιήσεις">
      <svg lucideBell aria-hidden="true"></svg>
    </button>
  </div>
</lib-topbar>
    `,
  ),
};

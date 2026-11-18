# shared-ui-tabs

The tabs of the design system, built on the headless `@angular/aria` tabs pattern (keyboard navigation, roving focus, and the full ARIA contract come from Angular). Import from `@ui/tabs`.

Composable, aria-mirrored markup — bind selection with `[(value)]`:

```html
<lib-tabs [(value)]="active" [scrollable]="true">
  <lib-tab-list selectionMode="follow">
    <lib-tab value="profile">Profile</lib-tab>
    <lib-tab value="billing" disabled>Billing</lib-tab>
    <lib-tab value="team" closable (closed)="removeTab('team')">
      <svg lucideUsers></svg> Team
    </lib-tab>
  </lib-tab-list>

  <lib-tab-panel value="profile">…eager content…</lib-tab-panel>
  <lib-tab-panel value="billing">…</lib-tab-panel>
  <lib-tab-panel value="team">
    <ng-template libTabContent>…lazy content, rendered on first activation…</ng-template>
  </lib-tab-panel>
</lib-tabs>
```

## `lib-tabs`

- `[(value)]` — selected tab value (declared on `lib-tab-list`; two-way).
- `scrollable` (default `false`): when the strip overflows, prev/next buttons appear and the tabs scroll instead of overflowing. Each click scrolls by ~80% of the viewport so a few previously-seen tabs stay on screen as anchors. The buttons are pointer-only affordances — keyboard users move with the arrow keys, which scrolls the focused tab into view automatically. The selected tab is scrolled into view on first render, when the selection changes and when a tab or the strip changes size, without moving focus. The first render and a resize jump. A new selection scrolls smoothly, or jumps under `prefers-reduced-motion`. After a prev/next click, a resize leaves the strip where the user put it.
- `scrollPrevAriaLabel` / `scrollNextAriaLabel` — `title` tooltips for the scroll buttons, defaulting to translated strings. Not accessible names: the buttons are `aria-hidden`, so an `aria-label` on them would be dead markup.

## `lib-tab-list`

- `orientation`: `horizontal` (default) | `vertical` (tabs sit beside their panels).
- `selectionMode`: `follow` (default — automatic activation, the focused tab is selected as you arrow through) | `explicit` (manual activation; commit with Enter/Space — best when a panel is expensive or lazy).
- `wrap` (default `true`): arrow-key navigation wraps around the ends.
- Owns the sliding accent indicator, which slides between tabs on `--ease-out`/`--dur-base` (GPU-only `transform`), skips the animation on first paint, and is disabled under `prefers-reduced-motion`.

## `lib-tab`

- `value` (required): links the tab to its panel.
- `disabled`: renders muted and is skipped by keyboard navigation.
- `closable` + `(closed)`: renders a × affordance that emits `(closed)` instead of selecting — pair it with `@for` over your own array for dynamic/closable tabs. The × is pointer-only (ARIA gives `role="tab"` presentational children, so a control nested inside it would be nameless yet focusable); keyboard users press Delete or Backspace on the focused tab, advertised as `aria-keyshortcuts`. `closeAriaLabel` supplies the ×'s `title` tooltip (defaults to a translated string).
- Project any markup for rich headers (icon + label, badges, …).

## `lib-tab-panel`

- `value` (required): links the panel to its tab.
- Wrap content in `<ng-template libTabContent>` for lazy rendering (only instantiated on first activation).

## `lib-tab-menu`

A tab-styled `navigation` landmark with no panels — each item navigates. Renders real `<a>` links; the active item tracks the route via `routerLinkActive` and carries `aria-current="page"`.

```html
<lib-tab-menu [items]="navItems" ariaLabel="Account sections" />
```

- `items`: `TabMenuItem[]` — `{ label, routerLink?, url?, target?, disabled?, data? }`. Tracked by reference, so use stable instances; two items may share a `label`.
- `ariaLabel`: accessible name for the landmark. Unset by default — always name it when the page holds more than one `navigation` landmark (e.g. beside `lib-sidebar`).
- `routerLinkActiveOptions` (default `{ exact: true }`).
- `(itemSelect)`: emits the activated item.
- The active underline reads the same `--tab-indicator-size` / `--tab-indicator-color` knobs as `lib-tab-list`'s sliding indicator.

## i18n

The lib ships a `tabs` Transloco scope (Greek first, English fallback) for the scroll tooltips and the ×. Every string has an input that overrides it; leave the input empty to get the translation.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-tabs` to execute the unit tests.

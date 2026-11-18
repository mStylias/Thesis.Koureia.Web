# shared-ui-topbar

The application top bar of the design system. Import from `@ui/topbar`.

The matched pair of `@ui/sidebar`. In the desktop **L-shape** shell the sidebar runs full-height on the left and the top bar sits to its right — the top bar's bottom hairline continues the line the sidebar draws under its brand header, so the two read as one unbroken rule across the viewport. Layout-only and slot-based: it owns the bar, that alignment line, and **both of the sidebar's triggers** — the desktop collapse toggle and, below 1024px once the sidebar becomes a drawer, the hamburger.

```html
<lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">
  <a *libSidebarBrand routerLink="/">…</a>
</lib-sidebar>

<div class="content-column">
  <lib-topbar
    [(menuOpen)]="navOpen"
    showSidebarToggle
    [(sidebarCollapsed)]="collapsed"
    [sidebarControls]="nav.navId"
  >
    <h1 libTopbarStart class="t-title">Ραντεβού</h1>
    <div libTopbarEnd>
      <button libButton severity="secondary" variant="outlined">Λογαριασμός</button>
    </div>
  </lib-topbar>
  <main><!-- routed content --></main>
</div>
```

Lay the shell out as a flex row: `<lib-sidebar>` then a flex-column holding `<lib-topbar>` above the content. Bind one signal per state to both bars — `[(menuOpen)]` here to the sidebar's `[(mobileOpen)]`, `[(sidebarCollapsed)]` here to its `[(collapsed)]`.

**Why the collapse toggle is here and not on the sidebar:** a control mounted on the panel it resizes has to reposition _within_ it mid-animation — it snaps toward its new spot before the panel has moved, and on the cross-axis too, so the eye follows the button instead of the rail. Anchored to this bar it has no motion of its own. It still travels horizontally, because in the L-shape the whole content column slides in with the rail's right edge — but as one rigid body, on the sidebar's own curve, rather than as a second animation fighting the first. The sidebar's header is then free to keep the brand icon in the rail.

- `[libTopbarStart]` (or any unslotted content): leading area — page title, breadcrumb, search. Grows to fill the bar and truncates rather than widening it.
- `[libTopbarEnd]`: trailing actions pinned to the right — buttons, a user menu, a theme toggle.
- `[(menuOpen)]`: two-way state of the mobile drawer; the hamburger (shown only below 1024px) sets it open. The drawer closes itself on navigation, Escape, and backdrop taps.
- `menuAriaLabel`: accessible name of the hamburger (defaults to a translated string).
- `showSidebarToggle` (default `false`): renders the sidebar collapse toggle at the start of the bar. Opt-in — a top bar is usable without a sidebar beside it, and a toggle for a sidebar that is not there would be a control that does nothing. Shown only **above** 1024px, the exact inverse of the hamburger's query, so only one of the two is ever in the layout, the tab order and the a11y tree.
- `[(sidebarCollapsed)]`: two-way icon-rail state; bind to the sidebar's `[(collapsed)]`. The sidebar writes back to it too (a rail submenu parent expands the sidebar), and the toggle follows.
- `sidebarControls`: id of the region the toggle expands, for `aria-controls` — read it off the sidebar as `nav.navId`. Omitted when empty rather than pointing at a missing id.
- `sidebarToggleAriaLabel`: accessible name of the collapse toggle (defaults to a translated string). It names the region ("Πλαϊνή μπάρα πλοήγησης"), not the action: a name flipping between "Collapse" and "Expand" is re-announced under the user's own focus. State rides `aria-expanded`.

The toggle's two icons share one grid cell and cross-fade in place (`--dur-fast` in, ~20% faster out, `--ease-out`), so the swap never resizes the button. The entrance is gated on the first user toggle — `animate.enter` fires on first paint otherwise, and a bar that animates itself on load is not responding to anything.

- **The gutter is `--space-6`, and the leading icon button is pulled out by its own padding.** The bar is read as one column with whatever sits below it — a page's content inset, a drawer's header and toolbar — and all of those keep `--space-6`. A button box on that gutter would put its _glyph_ 8px further in, and 8px of invisible padding reads as the bar being indented past the panel under it, so the hamburger and the collapse toggle carry a negative start margin of exactly their own padding. The trailing slot needs none: the control there is a button, as a drawer header's close button is, so the two button boxes land on the same axis.

- Height via the `--topbar-height` custom property, which defaults to the shared `--shell-header-height` token the sidebar's header pins itself to. It is a **fixed** height, not a minimum: that is what keeps the two bottom hairlines on one Y whatever either bar holds. Projected content taller than the bar overflows it rather than pushing the line, so cap your content or retune `--shell-header-height` (both bars follow it).

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-topbar` to execute the unit tests.

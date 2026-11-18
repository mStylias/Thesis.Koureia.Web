# shared-ui-drawer

The drawer (side panel) of the design system, built on the native `<dialog>` element. Import from `@ui/drawer`.

Declarative — drive it with the two-way `visible` binding:

```html
<lib-drawer [(visible)]="filtersOpen" header="Filters" position="right">
  <div libDrawerToolbar>…pinned actions…</div>
  …content…
  <div libDrawerFooter>…pinned actions…</div>
</lib-drawer>
```

## Why a native `<dialog>`

`showModal()` hands the platform the four things a hand-rolled overlay gets wrong: focus containment, inertness of everything behind, `Escape`, and top-layer stacking that no `z-index` can lose. It also gives a _genuine_ non-modal mode (`show()`), so `[modal]="false"` is a real presentation rather than a modal with the scrim hidden.

The one thing the platform does not give is time: `close()` is immediate and would cut the exit transition. So closing runs through a `data-closing` phase and calls the real `close()` after `DRAWER_CLOSE_DELAY`, and a reopen inside that window aborts the pending teardown. The page scroll lock is held across the whole phase — releasing it the moment `visible` flips would jump the page behind a panel still sliding out — and it is reference-counted, so a second open drawer keeps it.

`push` mode is the deliberate exception to the library's no-layout-animation rule: reflowing the sibling content **is** the point, and a transform cannot express it. Keep push drawers off high-frequency paths.

## API

- `visible`: two-way `boolean`
- `position`: `left` (default) | `right` | `top` | `bottom` | `full` (full screen)
- `mode`: `over` (default, floats above the page) | `push` (sits in normal flow and pushes the sibling content — place the drawer inside your own flex/grid container; always non-modal, `full` position stays overlay-only)
- `size`: `sm` | `md` | `lg` — width for left/right, height for top/bottom; ignored for `full`
- `header`: title rendered in the built-in header; custom header via projected `libDrawerHeader`, pinned toolbar via projected `libDrawerToolbar`, pinned footer via projected `libDrawerFooter`
- `modal` (default `true`): mask over the page, focus trapped inside; `false` keeps the page interactive
- `dismissible` (default `true`): mask click closes (modal mode only)
- `showBackdrop` (default `true`): `false` keeps the focus trap and mask-click behavior but leaves the page undimmed
- `closable` (default `true`): shows the × button; `closeOnEscape` (default `true`)
- `blockScroll` (default `false`): locks page scrolling while open
- `ariaLabel`, `ariaLabelledby`, `closeAriaLabel`
- `closeGuard`: `() => boolean | Promise<boolean>`, asked before the ×, Escape or the mask closes the drawer. `false` keeps it open. A `visible` set from outside is not asked
- `(opened)` fires on show, `(closed)` after the exit transition
- `scrollToTop()`: puts the content back at its top, for a panel that swaps one record for another in place

Headless: omit `header` and set `closable="false"` — the projected content owns the whole panel.

`libDrawerToolbar` is drawn between the header and the content. Only `.drawer-content` scrolls, so
the toolbar is where a panel puts actions that belong to everything in it — a form's Cancel and
Save — and they stay reachable however far the content is scrolled. Put actions that read as the
end of the panel in `libDrawerFooter` instead, which pins to the bottom. Drawer styles cannot reach
either slot, so the consumer styles what it projects.

### `lib-drawer-actions`

The toolbar every details drawer uses. Put it in the toolbar slot, give it the group of actions,
and project the end slot: Edit, or Cancel and Save while editing.

```html
<lib-drawer-actions libDrawerToolbar [actions]="actions()" aria-label="Appointment actions">
  <button libButton severity="secondary" variant="outlined" (click)="edit()">Edit</button>
</lib-drawer-actions>
```

The end slot sits at the end of the line and never moves. When the line is short, the group gives
up space from its last action: first the captions, one at a time, then the icon buttons into a ⋮
menu. A `DrawerAction` is `id` · `label` (translated text) · `icon` · `severity` · `variant` ·
`iconOnly` (never a caption) · `menuOnly` (always a ⋮ row) · `disabled` · `loading` · `run`. An
`error` action draws as a red ⋮ row. The ⋮ is named by the `drawer` scope's `moreActions`, or by
`moreAriaLabel`.

The fit reads its widths from a hidden row that draws every caption, so an action in the menu can
come back without being drawn first. A `ResizeObserver` on the line, the end slot and that row runs
the fit again when a caption's translation or font arrives.

Sizes come from `$component-size` tokens (`--drawer-{sm,md,lg}-{width,height}`); override them on `lib-drawer` or any ancestor.

A left or right panel leaves a strip of the page uncovered, which is what a pointer dismisses it with. An app shell that keeps its own header visible instead takes the whole width under it with three more properties, set the same way:

| Property                     | Default                         | Effect                                                                                                                                            |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--drawer-inset-top`         | `0px`                           | Starts the panel below it, and shortens it by as much.                                                                                            |
| `--drawer-max-width`         | `calc(100vw - var(--space-10))` | The cap that keeps the strip. Raise it to `100vw` for an edge-to-edge panel.                                                                      |
| `--drawer-edge-border-width` | `var(--border-width-hairline)`  | The leading hairline. Set it to `0` once there is no page beside the panel to divide it from.                                                     |
| `--drawer-content-padding`   | `var(--space-6)`                | Padding around the projected content. Set it to `0` for a panel whose content goes edge to edge, such as a map. A headless drawer is already `0`. |

## Accessibility

- Modal drawers **trap focus** and mark the page inert, both from `showModal()`; closing restores focus to whatever had it before, from the native `close()`.
- The × button is `autofocus`, so opening lands focus inside the panel — **except in `push` mode**, where the drawer is page furniture that can start open and the native dialog focusing steps (which run for `show()` too) would otherwise pull focus on first paint.
- **A drawer with no header is a dialog with no name**, which screen readers announce as such. Give a headless drawer an `ariaLabel`, or point `ariaLabelledby` at a heading of your own; the drawer's own title wins over both when it has one.
- `Escape` closes while `closeOnEscape` is `true`. Modal drawers get it from the native `cancel` event, non-modal ones from a `keydown` on the panel — which means it only fires when focus is inside, the reason a non-modal drawer still focuses its close button.
- Mask click is a **pointer-only** shortcut; `Escape` and the × button are the keyboard paths.
- Every string is Transloco-scoped (`drawer`, Greek and English shipped): the × button falls back to the scope when `closeAriaLabel` is empty, so the affordance is never unnamed.
- The panel is outlined under `forced-colors`, which repaints it in the page's own Canvas and drops both the scrim and the shadow.

Motion is CSS-driven throughout (`@starting-style` plus the `data-closing` phase), so the base layer's `prefers-reduced-motion` handling covers it with no per-component query.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-drawer` to execute the unit tests.

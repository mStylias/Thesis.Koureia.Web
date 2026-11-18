# @ui/menu

The button-triggered dropdown menu of the design system, plus the
`lib-menu-panel` surface and the open/focus engine that `@ui/context-menu`
shares with it. Built on the headless `@angular/aria/menu` pattern and opened
through the `@ui/popover` primitive.

```ts
import { Menu, MenuTrigger } from '@ui/menu';
```

```html
<button libButton [libMenuTriggerFor]="menu">Actions</button>
<lib-menu #menu [items]="items" ariaLabel="Booking actions" />
```

Items are plain `MenuItem` objects — icons, shortcut hints, separators, group
headings, `command` callbacks, `routerLink`/`url` navigation, and nested `items`
submenus. Rows are compared by reference, so hold them in a field initializer or
a `computed()` rather than rebuilding the array in the template.

## Why these decisions

- **Two components, one engine.** `Menu` and `ContextMenu` differ only in how
  they are triggered, so everything else — initial focus, focus-out dismissal
  across detached submenu panes, pointer-vs-keyboard activation, running an
  item's action — lives in `MenuOverlayController`. Neither component
  reimplements it.
- **Submenus render in their own overlay panes**, not nested in their parent's
  DOM, so they can escape a scrolling container and flip at the viewport edge.
  The aria pattern assumes DOM nesting, so each pane is stamped with a shared
  tree id (`data-menu-tree`); that stamp is what tells "my submenu" apart from
  an unrelated menu when focus moves.
- **Link items are real anchors.** A `routerLink` or `url` row renders `<a>` so
  the status bar, modifier-click-to-new-tab, and "copy link address" all work.
  A _disabled_ link renders as a plain `<div>` instead: `aria-disabled` stops
  the pattern from selecting it, but a live `href` would still let the browser
  navigate on click or Enter.
- **State is `checked`, never `disabled`.** A menu that offers a choice — sort
  direction, a filter operation, which side a column is pinned to — marks the
  one in force with `checked`, which renders `menuitemradio` plus `aria-checked`
  and highlights the row. Using `disabled` for the same thing announces the
  user's own choice as unavailable and drops it out of the keyboard walk, so the
  entry they most want to find is the one they cannot land on. Reserve
  `disabled` for an action that genuinely cannot run.
- **The default active item is cleared on a pointer open.** The pattern marks
  the first item active on open; leaving it would read as a selection the user
  never made, and would make the first ArrowDown skip past item one.
- **No `libButton` dependency.** The trigger is a directive, so any element can
  be one.

## `[libMenuTriggerFor]`

- `[libMenuTriggerFor]` — the `lib-menu` to open. Required.
- `[menuDisabled]` — blocks every activation and marks the trigger
  `aria-disabled`. It governs the _menu_ only; pass the host element's own
  `disabled` as well if it should also leave the tab order.
- `exportAs: 'libMenuTrigger'`.

Click toggles the menu open with nothing highlighted, like a native menu.
Enter, Space, ArrowDown, and ArrowUp open it with the first item highlighted
and suppress the key's default. The directive carries `aria-haspopup="menu"`,
`aria-expanded`, and — while open — `aria-controls`.

## `lib-menu`

- `[items]` — `readonly MenuItem[]`. Defaults to `[]`.
- `[ariaLabel]` — accessible name of the `menu` element.
- `(opened)` / `(closed)` — fire after the menu opens, and after it starts
  closing for any reason.
- `isOpen()` — readonly signal.
- `openFor(anchor, { focusFirstItem, triggerEvent? })`, `toggleFor(…)`,
  `close()` — for driving the menu without the trigger directive.
- `menuId` — id of the `menu` element, for a custom trigger's `aria-controls`.

### `MenuItem`

`label` · `icon` (Lucide) · `shortcut` (visual hint only — binding the key is
the application's job) · `checked` + `checkedRole` (`'radio'`, the default, or
`'checkbox'`) · `disabled` · `danger` (the row in the error colour, for an action
that destroys data) · `visible: false` to omit the row · `separator` ·
`heading` · `command` · `routerLink` + `queryParams` · `url` + `target` ·
`items` for a submenu.

A `checked` row keeps its own icon and is highlighted like a selected Select
option. It stays activatable — clicking the direction already in force is a
harmless no-op, and forbidding it would cost the user the keyboard landing spot
they were aiming for. `checked` on a submenu trigger is ignored: state belongs
on the rows inside it.

## `lib-menu-panel`

The bare surface, for wrappers that host it in their own overlay. Takes
`[items]`, `[itemTemplate]`, `[ariaLabel]`, `[menuId]`, and `[expansionDelay]`
(hover open/close delay, generous by default so a diagonal pointer path toward
a submenu has time to reach it), and reports activation on `(itemSelected)` —
interpreting `command`/`routerLink`/`url` is the wrapper's job.

## Custom rows

An `ng-template[libMenuItem]` replaces the default icon + label + shortcut row,
at every submenu depth:

```html
<lib-menu #menu [items]="items">
  <ng-template libMenuItem let-item>
    <strong>{{ item.label }}</strong>
  </ng-template>
</lib-menu>
```

## Accessibility

- Full WAI-ARIA menu pattern from `@angular/aria`: `menu`/`menuitem` roles,
  roving focus, arrow keys, Home/End, typeahead, and submenus on ArrowRight.
- Escape closes and restores focus to the trigger; Tab out of the menu closes
  it, and focus moving between the root pane and a submenu pane does not.
- Disabled rows are `aria-disabled` and are never rendered as anchors, so
  neither the pattern nor the browser can activate them.
- Headings are `role="presentation"` and are skipped by keyboard navigation;
  separators are `role="separator"`.
- Keyboard focus shows the inset 2px accent ring. The hover highlight is
  deliberately `:hover`-only, so it cannot linger on the last hovered row after
  the pointer leaves.
- Icons are decorative and `aria-hidden`.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-menu` to execute the unit tests.

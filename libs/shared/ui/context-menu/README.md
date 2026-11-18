# shared-ui-context-menu

The right-click menu of the design system: the shared
[`lib-menu-panel`](../menu/README.md) rendered through the
[`@ui/popover`](../popover/README.md) primitive at the pointer position.
Import from `@ui/context-menu`.

```html
<!-- Attached to an element -->
<div [libContextMenu]="menu" tabindex="0">Right-click me</div>
<lib-context-menu #menu [items]="items" ariaLabel="Booking actions" />

<!-- Or attached to the whole document -->
<lib-context-menu global [items]="items" ariaLabel="Page actions" />
```

```ts
protected readonly items: MenuItem[] = [
  { label: 'Book again', icon: LucideCalendarPlus, shortcut: '⌘B' },
  { separator: true },
  { label: 'Share', icon: LucideShare2, items: [{ label: 'Email' }] },
  { label: 'My bookings', routerLink: ['/bookings'], queryParams: { upcoming: '1' } },
];
```

## Why a separate lib from `@ui/menu`

The two menus differ only in how they are invoked and where the panel lands, so
everything else is shared rather than duplicated: the typed `MenuItem` model,
the recursive `MenuPanel` on the headless `@angular/aria/menu` pattern, and the
`MenuOverlayController` that owns opening, initial focus, focus-out dismissal,
pointer-vs-keyboard activation and running `command` / `routerLink` / `url`.
Behaviour fixes land in `@ui/menu` once and both menus get them. This
lib adds the trigger semantics — right-click, `Shift+F10`, touch long-press —
and the two position lists.

## Why two position lists

A pointer anchor opens the panel below-right of the cursor, the native
convention, and flips corner by corner as the viewport runs out of room.
Keyboard invocations (`Shift+F10` and the ContextMenu key, which browsers
deliver as `contextmenu` events with `(0, 0)` coordinates) have no meaningful
pointer position, so the panel anchors to the target element instead,
dropdown-style.

## Why the directive also watches pointer events

Some platforms synthesise `contextmenu` for a touch long-press and some (iOS) do
not, so the trigger runs its own 500 ms long-press timer, cancelled by ~10 px of
movement. On the platforms that _do_ synthesise the event, the native one is
swallowed for 700 ms afterwards so the menu the timer opened is not immediately
re-anchored.

## API

### `lib-context-menu`

- `items`: `readonly MenuItem[]` — nested `items` on an entry create submenus
- `global`: attaches to the document instead of a trigger; right-click anywhere
- `ariaLabel`: accessible name of the menu — supply one, `role="menu"` has no
  other source of a name
- `(opened)` / `(closed)`: fire after the menu opens and once it starts closing
- `show(event)`: opens for a `contextmenu` event — at the pointer, or anchored to
  the target for keyboard invocations
- `showAt(anchor, triggerEvent?, { focusFirstItem? })`: opens at an explicit
  element or viewport point
- `hide()`: closes without restoring focus
- `<ng-template libMenuItem let-item>` replaces the default row at every depth

### `[libContextMenu]`

- `libContextMenu`: the `lib-context-menu` this element opens (required)
- `contextMenuDisabled`: makes the trigger inert without removing it

## Accessibility

- The WAI-ARIA menu pattern comes from headless `@angular/aria/menu`: arrow
  keys, `Home`/`End`, `Enter`/`Space`, typeahead, and `Escape` to close and
  restore focus to the element that was focused when the menu opened.
- `Shift+F10` and the ContextMenu key open the menu for keyboard users, anchored
  to the target element. A keyboard open highlights the first item so navigation
  can start; a pointer open highlights nothing, matching native context menus.
- The trigger carries `aria-haspopup="menu"` — **withheld while
  `contextMenuDisabled`**, since advertising a menu that will not open is the
  same defect as leaving an edit affordance on a read-only control. A disabled
  trigger also leaves the native browser menu alone rather than suppressing it.
- Give every menu an `ariaLabel`. Disabled items stay focusable and
  discoverable, and simply never activate.
- Row highlight is pointer-only (`:hover` + `:focus-visible`), never plain
  `:focus`, because the pattern moves focus on hover.
- Link items render as real `<a>` anchors, so the status bar, copy-link and
  modifier/middle-click new-tab all behave natively.

## Running unit tests

Run `nx test shared-ui-context-menu` to execute the unit tests.

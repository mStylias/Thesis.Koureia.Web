# shared-ui-popover

The overlay primitive of the design system, and the declarative popover built on it. Import from `@ui/popover`.

Requires the CDK overlay styles, bundled globally via `libs/shared/styles/src/vendors`.

```html
<!-- Declarative: a trigger and a content template -->
<button libButton [libPopoverTriggerFor]="hours">Opening hours</button>
<ng-template #hours>
  <dl>…</dl>
</ng-template>
```

```ts
// Headless: you own the panel and its styling
const ref = inject(PopoverService).open({
  anchor: { x: event.clientX, y: event.clientY },
  template: this.panelTemplate(),
  viewContainerRef: this.viewContainerRef,
  positions: PANEL_POSITIONS,
  onClose: (reason) => this.closed.emit(reason),
});
```

## Why two layers

`PopoverService` is deliberately headless: it owns anchoring, viewport flips, dismissal and teardown, and renders whatever you hand it. That is what lets the menu, the context menu, the date picker and the password-input feedback panel all sit on one positioning implementation while looking nothing alike — each keeps its own panel markup and styles.

`[libPopoverTriggerFor]` is the opinionated layer on top: a click-toggled `role="dialog"` card that takes focus, the equivalent of PrimeNG's Popover. **Reach for the service directly whenever focus must not move** — a strength meter or a live hint over a field the user is typing into cannot afford the trigger's unconditional `focusSurface()`.

Panel styles stay in the component's own SCSS. A CDK `TemplatePortal`/`ComponentPortal` carries the declaring component's emulated-encapsulation attribute even when the pane is portaled to `<body>`, so no global partial is needed.

## API

### `[libPopoverTriggerFor]`

- `libPopoverTriggerFor`: the `TemplateRef` rendered inside the surface (required)
- `popoverPosition`: `bottom` (default) | `top` — the preferred side; it flips when it does not fit
- `popoverAriaLabel` / `popoverAriaLabelledby`: name the dialog surface
- `popoverDisabled`: suppresses the popover without removing the directive
- `toggle()`, `show()`, `hide()` — exported as `libPopoverTrigger` for template refs

### `PopoverService`

- `open(config)` → `PopoverRef` — renders a `TemplateRef`
- `openComponent(component, config)` → `{ ref, componentRef }` — renders a component so you can set inputs and drive an exit animation

Config (`PopoverBaseConfig`): `anchor` (an element **or** an `{x, y}` viewport point), `positions`, `scrollBehavior` (`reposition` default | `close`), `dismissOnOutsidePointer`, `dismissOnEscape`, `panelClass`, `beforeDispose`, `onClose(reason)`.

### `PopoverRef`

`close(reason?)` (awaits `beforeDispose`, then tears down), `dispose()` (immediate, idempotent), `updateAnchor()`, `updatePosition()`, `position()` — the `ConnectionPositionPair` the overlay actually landed on, for keeping `transform-origin` on the anchored side — plus `overlayElement` and `closed`.

`onClose` fires **exactly once**, whatever ended the popover: `programmatic`, `outside`, `escape` or `scroll`. Teardown is guaranteed even if `onClose` throws or `beforeDispose` rejects, so a failed exit animation can never strand a pane on screen.

### Controls that open their own overlay

A date picker, select or menu inside a popover opens its panel as a _sibling_
pane in the CDK overlay container, not as a DOM descendant of ours — so CDK
reports every pointer in it as outside. Left alone the popover dismisses, and
because the outside dispatcher listens in the capture phase it dismisses
_before_ the click reaches the control, losing the interaction as well.

A pointer that lands inside a popup the pane declares it controls therefore
counts as inside. The link is `aria-controls` (or `aria-owns`) on any element
within the pane, which is what a control already publishes for assistive
technology. Nothing to register — but a nested control that opens a popup
without naming it will still dismiss the popover, and that is a bug in the
control.

## Accessibility

- The surface is a `role="dialog"` with `tabindex="-1"`; focus moves to its first focusable element on open, or to the surface itself when it holds none.
- **The dialog is always named.** With neither `popoverAriaLabel` nor `popoverAriaLabelledby`, the surface is labelled by the trigger — the control the user just activated. An unnamed `role="dialog"` fails AXE's `aria-dialog-name`.
- The trigger carries `aria-haspopup="dialog"`, `aria-expanded`, and `aria-controls` while open. A **disabled** trigger advertises none of them: announcing a dialog that cannot be opened is the disabled-state-that-does-not-disable failure in ARIA form.
- `Escape` closes and **restores focus to the trigger**, as does a programmatic `hide()`. It is captured on the pane, so content inside that stops propagation of `Escape` cannot trap the user.
- Outside pointerdown dismisses; scroll repositions by default.

Motion is CSS-driven (`animate.enter`/`animate.leave` with an origin-aware `transform-origin`), so the base layer's `prefers-reduced-motion` handling covers it with no per-component query.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-popover` to execute the unit tests.

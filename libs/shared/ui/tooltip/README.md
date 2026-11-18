# shared-ui-tooltip

The tooltip directive of the design system — short advisory text anchored to any element, rendered in a CDK overlay. Import from `@ui/tooltip`.

Requires the CDK overlay styles, bundled globally via
`libs/shared/styles/src/vendors`.

```html
<button libButton libTooltip="Save changes">Save</button>
<button libTooltip="Delete" tooltipPosition="right">…</button>

<!-- Rich content -->
<ng-template #hours>Open <strong>Tue–Sat</strong></ng-template>
<span [libTooltip]="hours" tabindex="0">Opening hours</span>
```

## Why a directive, and why only one at a time

The host **is** the trigger, so there is no wrapper element to disturb the consumer's layout and nothing to keep in sync with the host's own state — which is why this is a directive rather than an element component, unlike most of the library.

A module-level registry keeps **exactly one tooltip visible**. Showing a new one snaps the previous away with no leave animation, so sweeping the pointer across a row of icon buttons never leaves two panes overlapping. That also means a tooltip is never the right home for content the user must be able to compare side by side.

Content is **supplementary by definition**: it is not always visible, so it must never be the sole carrier of essential information. A control whose only accessible name would come from its tooltip needs an `aria-label` instead.

## API

- `libTooltip`: `string | TemplateRef` — the content (required)
- `tooltipPosition`: `top` (default) | `bottom` | `left` | `right` — preferred side; flips to the opposite side, then the remaining ones, when it does not fit
- `tooltipDisabled`: suppresses the tooltip; flipping it true while one is showing hides it
- `showDelay` (default `150`) / `hideDelay` (default `100`), in ms. Negative and non-numeric values are treated as no delay
- `showOnEllipsis`: show only when the host's own text is truncated

The default `showDelay` keeps a pointer that only crosses the host from flashing a tooltip. The default `hideDelay` is not cosmetic — it is the window in which the pointer can travel from the host onto the tooltip, which is what keeps the surface hoverable.

Also exported: `buildTooltipPositions`, `resolveTooltipPosition`, `TooltipPosition`.

## Accessibility

Built to WCAG AA including SC 1.4.13, _Content on Hover or Focus_:

- **Hoverable** — the pane is a live target; moving onto it cancels the pending hide, so its content stays reachable.
- **Dismissible** — `Escape` closes it without moving the pointer or focus. The listener is on the **document**, in capture: a tooltip shown by hover has focus on nothing, so a host-level handler could never see the key. It is installed only while a tooltip is up, so `Escape` still reaches an enclosing dialog the rest of the time.
- **Persistent** — it stays while the pointer or focus remains, and shows on keyboard focus as well as hover.

Beyond the SC:

- The surface is `role="tooltip"`, and the host gains `aria-describedby` pointing at it while open. A consumer's own `aria-describedby` ids are **composed with**, never replaced by, the tooltip's.
- Activating the host hides the tooltip: a click leaves focus on the host, which would otherwise pin the tooltip open until focus moved away.
- A non-interactive host needs `tabindex="0"` to be reachable at all.
- The surface is an inverse-of-the-page fill — high contrast in both themes — with a `forced-colors` border, since a forced palette repaints it in the page's own Canvas and drops the shadow.

Motion is CSS-driven and origin-aware, so the base layer's `prefers-reduced-motion` handling covers it with no per-component query.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-tooltip` to execute the unit tests.

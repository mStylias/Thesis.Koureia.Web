# @ui/floating-panel

A non-modal panel that floats over the page. It opens docked to the bottom-right corner and runs
the full height of its bounds. The user drags it by the header and resizes it from any edge or
corner. The page under it stays usable, so it suits a tool the user works with while watching the
page react, such as a grid's column chooser.

```ts
import { FloatingPanel, FloatingPanelContent } from '@ui/floating-panel';
```

```html
<lib-floating-panel [(open)]="open" header="Columns" insetTop="var(--shell-header-height)">
  <ng-template libFloatingPanelContent>…</ng-template>
</lib-floating-panel>
```

The body is a template, so it is built only while the panel is open. It sits in a flex column
that fills the panel: give its root `flex: 1; min-height: 0` to scroll a part of it, or let the
body scroll as a whole.

## Why an overlay and not `position: fixed` in place

A fixed element is clipped by any ancestor with a `transform`, a `filter` or layout containment,
and it stacks inside whatever stacking context it is declared in. The panel renders in a CDK
overlay pane, which is out of reach of both. It sets no position strategy: the panel places
itself, and the pane only lifts it.

## Why the docked place is CSS

A panel the user has not touched has no box in script. CSS anchors it to the top, right and bottom
of its bounds, so it follows the viewport with no resize handler. The first drag or resize reads
the rendered box and from then on writes `left`, `top`, `width` and `height` inline. A double click
on the header clears them and docks it again. The placement survives a close and a reopen, and
goes with the component.

## Why it docks below its anchor

Docked at the full height of its bounds, the panel covered the end of the toolbar that opened it:
the trigger that closes it, and every action beside it. `dockBelow` names that toolbar. On open,
and on a re-dock, the panel reads the anchor's bottom edge and starts a gutter under it. Only the
docked place follows the anchor. The drag bounds stay at `insetTop`, so the user can still move
the panel over the anchor on purpose. The anchor never pushes the panel below its minimum height.

## Why the bounds are an element

`insetTop` is a CSS length, often a `var()`, and script cannot resolve that. A hidden fixed
element with the bounds' insets reports them as pixels through `getBoundingClientRect`. It sits
outside the panel, because the enter animation's `transform` would otherwise become its
containing block.

## API

| Input            | Type                  | Notes                                                                 |
| ---------------- | --------------------- | --------------------------------------------------------------------- |
| `open`           | `model<boolean>`      | Two-way visibility.                                                   |
| `header`         | `string`              | The heading, which also names the dialog.                             |
| `panelId`        | `string`              | Id of the panel, for a trigger's `aria-controls`. Generated if empty. |
| `insetTop`       | `string`              | CSS length kept free above the panel, such as an app bar's height.    |
| `dockBelow`      | `HTMLElement \| null` | The docked panel opens below it. A drag can still go above it.        |
| `closeAriaLabel` | `string`              | Name of the close button. Falls back to the translation.              |
| `moveAriaLabel`  | `string`              | Name of the move grip. Falls back to the translation.                 |

| Method             | Notes                                                        |
| ------------------ | ------------------------------------------------------------ |
| `close()`          | Closes and gives focus back to what held it before the open. |
| `resetPlacement()` | Docks the panel again at its default place and size.         |

Geometry tokens: `--floating-panel-width`, `--floating-panel-min-width`,
`--floating-panel-min-height`, `--floating-panel-grip-size`.

## Copy

Scope `floatingPanel`: `close`, `move`, `moveHint`. Each key is overridable through
`@util/ui-copy`.

## Accessibility

- `role="dialog"` without `aria-modal`, named by its heading. The page stays in the tab order.
- On open, focus moves to the first control of the body, else to the panel.
- Escape inside the panel and the close button close it and return focus to the trigger. Escape
  stops there, so a surface around the panel keeps its own.
- The grip in the header is the keyboard path: the arrow keys move the panel and Shift with the
  arrow keys resizes it. Its description says so. The edge grips are pointer only and
  `aria-hidden`.

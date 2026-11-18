# shared-ui-bottom-sheet

A sheet pinned to the bottom edge that is never absent: collapsed it shows a peek bar, expanded
it shows the full content over a backdrop. Import from `@ui/bottom-sheet`.

```ts
import { BottomSheet } from '@ui/bottom-sheet';
```

```html
<lib-bottom-sheet [(expanded)]="open" [toggleLabel]="label()">
  <div libBottomSheetPeek>one line, always on screen</div>
  <button libBottomSheetTrailing type="button">a control at the end of the bar</button>
  <div libBottomSheetActions>the actions, also always on screen</div>
  <p>the detail, revealed when expanded</p>
</lib-bottom-sheet>
```

Four slots. `[libBottomSheetPeek]` is the bar's content and is always visible.
`[libBottomSheetActions]` is a row for controls the page must be able to reach without
expanding the sheet: collapsed it sits under the bar, expanded it is the sheet's footer. The
default slot is the panel: it scrolls, and it is `inert` while collapsed so a keyboard user
never tabs into content they cannot see. `[libBottomSheetTrailing]` is the one place a control
may sit inside the bar — see below.

**A consumer that uses the actions slot must declare its height** with
`--bottom-sheet-actions-height`. The collapsed travel and the page's bottom padding are both
that value plus `--bottom-sheet-peek-height`; leave it unset and the actions ride below the fold.

It expands by a tap on the bar and by a drag on the bar or the grip above it.

## API

| Input         | Type              | Meaning                                                   |
| ------------- | ----------------- | --------------------------------------------------------- |
| `expanded`    | `boolean` (model) | Which state the sheet is in. A tap or a drag writes back. |
| `toggleLabel` | `string`          | Names the toggle. Falls back to a translated default.     |
| `lockScroll`  | `boolean`         | Locks page scrolling while expanded. Default `true`.      |
| `collapsible` | `boolean`         | Whether the customer may close it. Default `true`.        |

## Why this is not `@ui/drawer`

A drawer is binary — `visible` false means gone. It has no state in which it occupies the page
while closed, no peek, no drag and no snap points. Consumers that want a dismissible overlay
panel should still use the drawer; this is for a surface that must stay on screen.

## Why it moves by `transform` alone

The surface is laid out where it belongs when expanded and pushed down by
`calc(100% - var(--bottom-sheet-peek-height))` when collapsed. `100%` is the element's own
height, so nothing has to measure the panel to know how far that is — no `ResizeObserver`, no
inline height, and no layout animation. The global reduced-motion rule collapses the travel
while the state still changes.

A drag writes `--drag` on the surface and `data-dragging` cuts the transition, because easing
the sheet toward the finger lags it.

**A drag is clamped to the distance between the two resting places**, measured once per grab as
the surface less the visible band. One direction is not enough: a collapsed sheet dragged far
enough up translates past zero, lifts off the bottom edge and leaves a gap under itself. Where
nothing has been laid out — jsdom, a server render — the measurement is skipped rather than
read as zero, which would pin the sheet.

## Why the actions row moves

Collapsed, the row has to be inside the visible band, which is the top of the surface. Expanded,
an action row directly under the bar reads as belonging to the bar, with the content the
customer opened the sheet for pushed below it. `order` on the one element gives both, so there
is no second slot and nothing is rendered twice.

## Pinning it open

`[collapsible]="false"` removes every way to close the sheet: no toggle, no scrim, no `Escape`
and no drag. The grip is hidden but keeps its box, because the peek height is a contract. For a
screen whose whole content is the sheet, where collapsing would leave an empty page behind it.

**It does not open the sheet.** `expanded` is still the consumer's, and pinning a collapsed
sheet open is not this input's job.

## Why the bar is one empty button

The toggle is a single `<button>` laid over the whole bar. Wrapping the projected peek content
in a button would nest whatever the consumer projects inside an interactive element.

It paints nothing — no chevron. The grip above the bar is the affordance, the whole bar is the
target, and `aria-expanded` plus `aria-label` carry the state and the name. Its focus ring is
drawn inset, because the bar reaches both edges of the surface and a ring with spread would
paint over the grip and the actions row.

A drag ends with a `click` on that button, so `onToggleClick` skips the press that follows a
drag — the release already decided the state, and acting again would undo it.

Because the button covers the bar, **a control projected into the peek slot is unreachable**.
`[libBottomSheetTrailing]` is the way to put one there: it renders after the toggle and is
positioned, so it paints above it and takes the press. It also stops `pointerdown`, or the
header's grab handler would read a press on it as the start of a drag.

## Why the grab area excludes the panel and the actions

`pointerdown` is bound to the header, not the surface. The panel scrolls, and a drag started
there is a scroll. The actions row sits outside the header for the same reason in reverse: a
press on a button there must be a press, not the start of a gesture that swallows it.

## The height is a contract

The bar is `--bottom-sheet-peek-height` tall. **Page content must reserve that much bottom
padding**, or the bar covers whatever sits at the end of the page.

## Accessibility

- The toggle carries `aria-expanded` and `aria-controls`, and keeps a stable name across both
  states — a name that flips under focus is re-announced mid-interaction.
- Focus moves into the panel when it becomes readable and returns to the bar when it goes inert.
  Neither happens on first paint.
- `Escape` collapses, and the key is stopped only while expanded, so it still reaches an
  enclosing dialog when the sheet has nothing to close.

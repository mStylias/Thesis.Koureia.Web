# @ui/button

Shared button styling for native `<button>` and `<a>` elements in the design system.

## Usage

```ts
import { Button } from '@ui/button';
```

```html
<button libButton>Book now</button>
<button libButton severity="error" variant="outlined">Cancel booking</button>
<a libButton href="/booking" severity="secondary">View booking</a>
```

## Why an attribute component

Buttons and links already provide the correct native semantics, keyboard
behavior, form participation, and browser affordances. `libButton` decorates
those elements instead of replacing them with a wrapper. Disabled anchors are
handled explicitly because HTML has no native disabled state for `<a>`.

## API

- `severity`: `primary | secondary | success | info | warning | error`;
  defaults to `primary`.
- `variant`: `filled | outlined | text`; defaults to `filled`.
- `size`: `sm | md | lg`; defaults to `md`.
- `iconOnly`: equal-width icon control; provide an accessible name.
- `rounded`: pill shape, or circular when combined with `iconOnly`.
- `raised`: adds elevation.
- `disabled`: blocks interaction on buttons and anchors.
- `loading`: an action of this button's is in flight. Draws a spinner in the
  `libButtonIcon`'s place, reports `aria-busy`, and blocks interaction — a
  consumer never has to set `disabled` as well.

All severity and variant combinations retain their foreground color while
pressed; the pressed background and subtle scale provide the interaction
feedback without reducing text contrast.

### Loading

```html
<button libButton [loading]="form().submitting()" (click)="save()">
  <svg lucideSave libButtonIcon aria-hidden="true"></svg>
  Save
</button>
```

`libButtonIcon` marks the icon the spinner replaces. Mark it, or the spinner is
drawn _before_ the icon and the button grows by one icon mid-action, nudging its
caption and whatever sits beside it.

**The caption does not change.** The button holds focus after a press, and an
accessible name that changes there is re-announced mid-interaction — so the state
rides on `aria-busy` and the disabled state, not on a "Saving…" caption. Anything
a user must read instead of the caption belongs in a toast.

The spinner is `aria-hidden` decoration sized in `em`, so it follows the font
size each `size` already sets. The base layer's `prefers-reduced-motion` rule
stops the spin, so there is no query here.

One consequence of replacing rather than joining: the icon slot sits in an
`@else`, and content projected into a block that never renders is never created.
A button born `loading` therefore has no icon until `loading` first goes false —
which is when the icon is wanted anyway.

### Tuning the padding of one axis

`--btn-pad-y` and `--btn-pad-x` override a size's own padding. Set them on the
button, or on an ancestor:

```scss
// A taller sm button, keeping the sm font and width.
.my-toolbar button {
  --btn-pad-y: var(--space-2);
}
```

A size sets `--btn-size-pad-y` / `--btn-size-pad-x` and the host rule reads
`var(--btn-pad-y, var(--btn-size-pad-y))`, so the override is declared nowhere
in the component and a consumer rule reaches it. The two cannot share one name:
a custom property set on the element beats one inherited from an ancestor, and
`:host([data-size='sm'])` outranks anything written from outside the component,
so a single name would make the override unreachable at any specificity. An
icon-only button stays square through an override — its horizontal padding
follows the vertical one.

## Accessibility

Use `<button>` for actions and `<a>` for navigation. Icon-only controls require
an `aria-label` or another accessible name. Disabled anchors receive
`aria-disabled="true"`, leave the tab order, and block pointer and keyboard
activation. Focus indication and theme-aware colors come from the shared design
system.

## Testing

Run `nx test shared-ui-button`.

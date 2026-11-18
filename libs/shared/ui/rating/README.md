# shared-ui-rating

The star rating of the design system: a score from 1 to `max` (5 by default) for
review forms, and a read-only display of a score that is already given. Import
from `@ui/rating`.

```html
<!-- Interactive -->
<lib-rating [(value)]="score" />

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-rating [formField]="reviewForm.score" />

<!-- Read-only display, announced as "4 of 5 stars" -->
<lib-rating [value]="review.score" readonly size="sm" />
```

## Why star buttons and not native radios

A rating reads left to right as "up to here", so every star at or below the value
is filled, and a hover previews that fill before the click. Native radios carry
one checked input and no notion of "below the checked one", and their arrow keys
wrap from the last star to the first, which is wrong for a score. The stars are
`<button type="button" role="radio">` in a `role="radiogroup"`, with a roving
tab stop the component owns. A disabled star is a native disabled button, so it
takes no click, no key and no tab stop.

## Why read-only is one image

A score on a review card is a fact, not a control. It renders `role="img"` with
the summary as its name ("4 of 5 stars"), so a screen reader reads one phrase
and the tab order skips it. A fractional value (an average) rounds to whole
stars, in the fill and in the summary.

## API

- `value`: two-way `number | null` (default `null`, nothing rated)
- `max`: number of stars (default `5`). Normalized to a whole number from 1 to 10.
- `readonly`: static display, `role="img"`
- `size`: `sm` | `md` (default) | `lg`, following `--icon-size-*`
- `disabled`, `invalid`, `touched`, `required`, `errors`: bound by `[formField]`
- `ariaLabel`: names the group (default "Rating"). Read-only, it replaces the summary.
- `ariaLabelledby`: labels the group. Interactive mode only.
- `ariaDescribedby`: passed through to the group or the image
- `(touch)`: emitted once focus leaves the control
- `focus(options?)`: focuses the checked star, or the first. Does nothing when
  disabled or read-only.

`max` and `readonly` are also `FormValueControl` members. When the field has a
`max()` or `readonly()` rule, `[formField]` binds it, and it wins over a value
written in the template. Give the score `max(path.score, 5)` and the star count
follows the schema.

Host attributes: `data-size`, `data-disabled`, `data-invalid`, `data-readonly`,
`data-filled`.

## Copy

Scope `rating`: `rating.label`, `rating.star.one`, `rating.star.other`,
`rating.summary`. Each key is read through `uiCopy`, so a page can override it
with `provideUiCopy`. All are neutral labels, so the customer pages need no
override.

## Accessibility

- Each star is named "1 star", "2 stars"… and the selected one has
  `aria-checked="true"`.
- Keys: `ArrowRight`/`ArrowUp` add one star, `ArrowLeft`/`ArrowDown` remove one,
  both stop at the ends. `Home` and `End` jump. `Space` and `Enter` select the
  focused star. Focus follows the value.
- `aria-invalid` and `aria-required` sit on the group. `required` is never the
  native attribute, which blocks the submit event.
- `touch` fires only when focus leaves the host, not when it moves between stars.
- A filled star is the selected state and an outlined star the empty one, so the
  state is never color alone. A `forced-colors` block re-states fill and focus.
- Focus is the global 2px `--focus-ring`.

## Running unit tests

Run `nx test shared-ui-rating` to execute the unit tests.

# pages/

Styles that apply to **one specific page only** — one partial per page
(`_home.scss`, `_shop.scss`, `_booking.scss`, `_confirmation.scss`, …). Currently
empty: the design system ships foundations only.

## What goes here

- Page-scoped tweaks that don't generalize: a hero treatment unique to the landing
  page, a special section layout on the confirmation screen
- Wrap rules in a page root class (e.g. `.page-home { … }`) so they can't leak

## What does NOT go here

- Anything used on two or more pages — promote it to `components/` or `layout/`
- Styles an Angular routed component can own privately — prefer that; in an Angular
  app this folder should stay close to empty, since routed components already scope
  and lazy-load their own styles

This is deliberately the least-used folder. If a partial here keeps growing, it's a
sign something wants to be extracted into `components/`.

Register any new partial in `_index.scss`.

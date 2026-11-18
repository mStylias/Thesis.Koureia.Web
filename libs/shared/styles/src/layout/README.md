# layout/

The macro-level structure of the app — the chrome that frames page content, not the
content itself. Currently empty: the design system ships foundations only.

## What goes here

One partial per structural region, e.g.:

- `_header.scss` — the sticky top bar (translucent surface + `backdrop-filter` blur
  is the one place the design allows it)
- `_footer.scss`
- `_navigation.scss`
- `_grid.scss` / `_container.scss` — the content column (design maxes it around
  1040px) and shared page gutters
- `_sidebar.scss` — e.g. the sticky booking-summary rail that collapses to a fixed
  bottom bar on mobile

Register each new partial in `_index.scss`.

## What does NOT go here

- Reusable widgets (a button, a card) → `components/`
- Styles for one specific page → `pages/`
- Anything an Angular component can own privately → keep it in the component;
  put layout styles here only when they are genuinely global (e.g. the app shell)

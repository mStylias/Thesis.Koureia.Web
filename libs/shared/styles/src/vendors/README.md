# vendors/

Third-party CSS and our overrides of it. Currently empty.

## What goes here

- Stylesheets shipped by external libraries that we choose to bundle globally
  (a datepicker, a carousel, a map widget…)
- Our overrides of that vendor CSS — put them in a separate partial named after the
  vendor (e.g. `_flatpickr-overrides.scss`) rather than editing the vendor file, so
  vendor updates stay drop-in

Register each file in `_index.scss`, vendor stylesheet first, overrides after.

## Why Tailwind is NOT here

Tailwind v4 must be processed by **PostCSS**, and this tree is compiled by **Sass**
(`@import 'tailwindcss'` would fail inside a `.scss` file). Tailwind therefore has
its own shared global entry, `tailwind.css`, listed before `main.scss`. Its
`@theme inline` block consumes the design tokens defined here in SCSS.

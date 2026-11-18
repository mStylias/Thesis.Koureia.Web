# Design system core (7-1 Sass pattern)

The **brand-neutral** half of the design system, organized with the
[7-1 pattern](https://sass-guidelin.es/#the-7-1-pattern): folders with one
responsibility each, pulled together by one entry file ([_core.scss](_core.scss)).

`_core.scss` is not what gets compiled. A **theme** is
(`libs/themes/<brand>/src/main.scss`) — it `@use`s this core, then emits its own
token values. That is the seam that makes a second brand possible.

```
styles/                 ← CORE: no colours, no type faces, no elevation tint
├── abstracts/    Sass-only: structural tokens, functions, mixins → emits NO CSS
├── vendors/      third-party styles and overrides
├── base/         token-emission MIXINS, element defaults, type classes
├── layout/       structural chrome: header, footer, nav, grid
├── components/   global partials for DOM encapsulation can't reach
├── pages/        page-specific styles
├── _core.scss    @uses one index per folder; a theme @uses this
└── tailwind.css  PostCSS entry; reads the theme's custom properties

libs/themes/koureia/    ← BRAND
├── src/_tokens.scss       ramps, hues, faces, leading/weight/tracking, shadows
├── src/_root.scss         :root { scale-vars + brand-vars }
├── src/_light.scss        semantic aliases (the base theme)
├── src/_dark.scss         dark overrides
├── src/_surface-dark.scss a permanently-dark subtree context
└── src/main.scss          the compiled entry: core + all of the above
```

## How it fits together

1. **`abstracts/_scale.scss`** holds _structural_ tokens as Sass maps, plus the
   mixins/functions. Importing it never produces CSS — it is pure vocabulary.
2. **`base/_emit.scss`** declares two mixins rather than emitting anything:
   `scale-vars` (structure, every map an overridable argument) and `brand-vars`
   (identity, no defaults — a theme that forgets a ramp fails to compile).
3. **A theme** calls both inside its own `:root`, then defines the _semantic_
   aliases (`--bg`, `--surface`, `--accent`, `--text-primary`, …). Light is the
   default; dark activates via `data-theme="dark"` on `<html>`. A theme also owns
   **surface contexts** — the same aliases re-pointed for a _subtree_ via
   `data-surface="dark"`, which is how a dark band gets correct nested components
   with no band-specific token names. See
   [libs/themes/koureia/README.md](../../../../themes/koureia/README.md).
4. Everything downstream (base element styles, layout/components/pages, and Angular
   component styles) consumes the **CSS custom properties**, so it stays both
   theme-aware and brand-agnostic at runtime with no extra work.

Why the split falls where it does: `$breakpoints` is the one map read as a literal
Sass value (inside `@media`), and component stylesheets compile independently of any
theme — so it must be in core. Everything else reaches a component only as a
`var()`, which is what makes it swappable.

## Rules of the road

- **Every partial starts with `_`** (e.g. `_scale.scss`) so Sass never compiles it
  standalone. Each folder has an `_index.scss` that `@use`s / `@forward`s its
  siblings; `_core.scss` only references folders, never individual partials.
- **Use `@use`, never `@import`** (Sass `@import` is deprecated).
- **New global style?** Pick the folder by responsibility (see each folder's README),
  add a `_name.scss` partial, and register it in that folder's `_index.scss`. Never
  add it to `_core.scss` directly.
- **No colour values in this package.** A hex, a ramp, a font stack or a shadow tint
  here would be one brand leaking into shared code. They belong to a theme.
- **Angular component styles** should stay in the component. To access the mixins and
  functions from a component stylesheet:
  ```scss
  @use 'abstracts' as a;

  h2 {
    @include a.t-h2;
  }
  .card {
    padding: a.space(6);
    border-radius: a.radius(lg);
  }
  ```
- **Prefer the CSS variables** (`var(--accent)`) over raw hex values or Sass map
  lookups — that is what keeps light/dark switching, and re-branding, free.
- **Tokenize design decisions, not mechanics.** Repeated/public component
  dimensions belong in `$component-size`; intrinsic `0`/`100%`, viewport bounds,
  ratios and pixel-alignment corrections may remain local literals.

## Relationship to Tailwind

Tailwind v4 lives in `tailwind.css` (the first shared global entry)
because Tailwind must be processed by PostCSS, not Sass. Its `@theme inline` block
maps our CSS custom properties into Tailwind, so utilities like `bg-brand-500`,
`text-accent-text`, `text-error-text`, `bg-surface-2`, `font-display`, `rounded-pill`, and `shadow-accent`
resolve to the same tokens and follow theme switches. The `dark:` variant is remapped
to `data-theme="dark"`. Tokens are defined **once**, here in SCSS.

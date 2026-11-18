# base/

The boilerplate layer: what every page gets before any layout or component is
styled. Rules here target **element selectors, `:root`, and foundational utility
classes** — never a specific screen or widget.

| File               | Contents                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_emit.scss`       | The `scale-vars` / `brand-vars` **mixins** — the bridge from Sass vocabulary to runtime CSS. Emits nothing by itself: core decides _which_ custom properties exist, a theme calls these inside its own `:root` and supplies the values. Every structural map is an overridable argument. |
| `_base.scss`       | Element defaults: body surface/type, global `:focus-visible` ring (WCAG 2.4.7), `prefers-reduced-motion` guard. No reset — Tailwind's preflight covers that.                                                                                                                             |
| `_scrollbars.scss` | Themed scrollbars. Two mutually exclusive paths behind a `@supports` guard: `::-webkit-scrollbar` where it exists, the standard `scrollbar-width`/`scrollbar-color` elsewhere. Setting `scrollbar-color` makes Blink ignore the pseudo-elements, so they must never both apply.          |
| `_typography.scss` | The global semantic type classes `.t-display`, `.t-h1`–`.t-h3`, `.t-title`, `.t-body`, `.t-body-sm`, `.t-label`, `.t-field-label`, `.t-caption`, `.t-mono`, composed from the mixins in `abstracts/`.                                                                                    |
| `_index.scss`      | Registers the partials above.                                                                                                                                                                                                                                                            |

## What goes here

- New token groups: add the map to `abstracts/_scale.scss` (structural) or to a
  theme's `_tokens.scss` (brand), then emit it from the matching mixin in
  `_emit.scss`
- Default styling for bare HTML elements (`a`, `hr`, `::selection`, …)
- Small global utility classes that are part of the foundation (like `.t-*`)

## What does NOT go here

- Anything scoped to a page, layout region, or component
- Theme-dependent _values_ — semantic aliases like `--bg` and `--accent` are set in
  `libs/themes/<brand>/`; base rules only **consume** them (`background: var(--bg)`)
- Any actual token value. This folder is brand-neutral.

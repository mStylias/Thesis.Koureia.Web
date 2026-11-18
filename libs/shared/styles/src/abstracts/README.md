# abstracts/

Sass-only tools and vocabulary. **Nothing in this folder may emit CSS** — importing
it from a hundred files must not add a single byte to the output. If a partial here
would produce a selector or a declaration, it belongs in another folder.

| File              | Contents                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_scale.scss`     | **Structural** tokens as Sass maps: spacing, breakpoints, component dimensions, container, radii, border widths, type _scale_, motion, state, iconography, z-index. Brand-neutral — no colours, faces or elevation tint; those live in a theme's `_tokens.scss`. Type and spacing are in `rem` so they honor the user's font-size preference. |
| `_functions.scss` | Validated token accessors — `space(4)`, `radius(md)`, `z(modal)`. They error at compile time on unknown keys but return the `var(--…)` reference so values stay theme-aware at runtime. There are deliberately **no** accessors for the `$brand`/`$neutral` ramps: reaching into them is what the semantic layer exists to prevent.           |
| `_mixins.scss`    | The semantic type styles (`t-display` … `t-mono`) and shared rules: `respond(md)`, `respond-down(lg)`, `respond-between(md, xl)`, `container`, `focus-ring`, `disabled`, `tag`, and the `detail-*` recipe for read-only details panels. Breakpoint ranges match Tailwind without overlap.                                                     |
| `_index.scss`     | `@forward`s everything so consumers need a single `@use`.                                                                                                                                                                                                                                                                                     |

## What goes here

- New **structural** token groups: add a map to `_scale.scss`, then emit it from
  `base/_emit.scss`'s `scale-vars`. Brand values go in `libs/themes/<brand>/src/_tokens.scss`
  instead. Breakpoints are never emitted — `var()` doesn't work inside `@media`, which
  is exactly why they must live here rather than in a theme.
- Mixins and functions reused across components

## Usage

```scss
@use 'abstracts' as a; // resolved through the shared Sass include path
// or, from a sibling styles/ folder:
@use '../abstracts' as a;

.summary {
  @include a.t-title;
  padding: a.space(6);
  border-radius: a.radius(lg);
  z-index: a.z(sticky);

  @include a.respond(lg) {
    position: sticky;
  }

  @include a.respond-between(md, xl) {
    max-width: var(--container-max);
  }
}
```

Change a structural token **here** (and, for new ones, emit it from
`base/_emit.scss`); never hard-code values downstream.

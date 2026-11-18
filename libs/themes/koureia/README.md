# themes/koureia

**Koureia's brand.** One of potentially several theme packages; the brand-neutral
design system it plugs into lives in `libs/shared/styles/`.

This package — not the core — is what an app's build actually compiles:

```jsonc
// apps/koureia/project.json
"styles": ["libs/shared/styles/src/tailwind.css", "libs/themes/koureia/src/main.scss"],
"stylePreprocessorOptions": { "includePaths": ["libs/shared/styles/src"] }
```

`main.scss` `@use`s the core, so a second brand is a sibling folder plus a
one-line change to one build config. Nothing in `libs/shared/ui/` or
`libs/features/` refers to it, and the `type:theme` Nx tag enforces that: no
`type:ui` or `type:feature` library may depend on a brand.

| File                     | Contents                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/_tokens.scss`       | The brand: `$brand` + `$neutral` ramps, `$paper`, `$semantic` hues, three font stacks, `$leading`/`$weight`/`$tracking`, `$shadow`.                                          |
| `src/_root.scss`         | `:root { scale-vars + brand-vars }` — hands those maps to the core's emit mixins.                                                                                            |
| `src/_light.scss`        | Default theme (`:root, [data-theme='light']`) — warm paper surfaces, copper accent.                                                                                          |
| `src/_dark.scss`         | Deep espresso surfaces; copper accent pops. A mixin applied to `[data-theme='dark']` and, for OS auto-dark, to `:root:not([data-theme])` under `prefers-color-scheme: dark`. |
| `src/_surface-dark.scss` | A **surface context** — a permanently-dark subtree inside either theme. See below.                                                                                           |
| `src/main.scss`          | The compiled entry: core, then all of the above in cascade order.                                                                                                            |

## What a theme may change

Everything in `_tokens.scss`, plus any _structural_ map, by passing it at the emit
call. Koureia takes the core's structure unchanged; a brand that wants tighter
corners or a denser sidebar overrides just that map:

```scss
@include emit.scale-vars($radius: t.$radius, $component-size: t.$component-size);
```

`brand-vars` has no defaults — every argument is required, so a theme cannot
half-declare its identity and silently inherit Koureia's colours.

**Out of reach:** `$breakpoints` (read as a literal Sass value inside `@media`, and
component stylesheets compile without a theme) and the `t-*` type _hierarchy_ (which
element uses which size is fixed in the core's mixins; a brand changes what
`--text-2xl` and `--font-display` are, not that `h2` uses them).

## Semantic tokens

The aliases the rest of the app is written against. A theme never invents new
primitives; it maps its own ramps (and a few theme-specific hexes) onto meaning:

| Group     | Tokens                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces  | `--bg`, `--surface`, `--surface-2`, `--surface-sunken`                                                                                                  |
| Lines     | `--border`, `--border-subtle`, `--border-strong`                                                                                                        |
| Text      | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`                                                                                  |
| Accent    | `--accent` (fill/border), `--accent-text` (foreground), `--accent-hover`, `--accent-active`, `--accent-fg`, `--accent-subtle`, `--accent-subtle-border` |
| Severity  | `--on-success`, `--on-info`, `--on-warning`, `--on-error` — foreground on a _filled_ semantic surface                                                   |
| Status    | `--success-text`, `--warning-text`, `--error-text`, `--info-text` — a semantic hue as text, AA on every surface and on its own `-bg` tint               |
| Focus     | `--focus-ring`                                                                                                                                          |
| Scrim     | `--scrim` (modal backdrop)                                                                                                                              |
| Overrides | dark mode also re-values `--success-bg`/`--warning-bg`/`--error-bg`/`--info-bg` and the shadows                                                         |

`--on-*` is a _pairing_, not a colour: it is whatever passes WCAG AA against the hue
next to it. Koureia's four hues are all dark enough to take white text, so every
`--on-*` is white. A brand that re-values a hue must recheck its pairing.

## Surface contexts (`_surface-dark.scss`)

A theme applies to the whole document. A **surface context** applies to a subtree:
put `data-surface="dark"` on an element and every token in the table above is
re-pointed for it and everything inside it.

```html
<section class="cta" data-surface="dark">
  <h2>…</h2>
  <!-- var(--text-primary) → paper -->
  <a libButton severity="secondary">…</a>
  <!-- correct with zero overrides -->
</section>
```

That second line is the whole point. Components already read semantic tokens, so a
shared component dropped into a dark band comes out right without the band knowing
anything about that component's internals — and without the component knowing it is
on a dark band. Before this existed, the landing header hand-set `--btn-plain-fg`,
`--btn-outline-border` and `--btn-subtle` on two buttons, twice each, once per scroll
state; all six declarations are now `severity="secondary"` plus the context.

Used by the landing page's editorial bands (hero, "how it works", CTA, footer) and by
the fixed header while it sits over the hero photograph — the header toggles the
attribute on scroll, which is the whole of its light/dark behaviour.

**It is theme-stable.** These bands are dark in light mode _and_ dark mode, so
`[data-theme='dark']` deliberately does not touch them. `_surface-dark.scss` starts
from `_dark.scss`'s `dark-tokens` mixin — so accents, focus ring, semantic
backgrounds and near-black shadows are the values already reasoned about for a dark
ground — then states only where an editorial band differs: brighter, warmer text and
a brighter ground (it competes with photography), and translucent panels, so the
band colour reads through instead of being restated as opaque espresso.

**It is not `--text-inverse`.** "Inverse" means _the opposite of the current theme_
and flips with it — the tooltip is ink-on-paper in light mode and paper-on-espresso
in dark. A dark surface context means _dark, always_.

It also owns `--media-scrim` / `--media-scrim-soft`: the photo overlay that _creates_
the dark ground where there is an image behind it rather than a flat fill. Derived
from `--bg`, so a brand sets the band colour once. `-soft` is the wider-viewport
variant, where more of the photograph is worth seeing and less ink still holds
contrast.

Contexts nest, so a light island inside a dark band is a future `data-surface="light"`
away. Two cautions:

- Tailwind's `dark:` variant keys off `data-theme`, not `data-surface`, so utilities
  do not follow a context. Nothing on the landing page uses colour utilities — write
  SCSS against the tokens.
- Declare the context on the element that _is_ the surface, not reflexively on the
  component host. `lib-landing-header` puts it on its inner `<header>` precisely so
  the sibling `lib-drawer` does not inherit it, and `lib-landing-how-it-works` puts
  it on its intro `<section>` because the rest of that page is light.

## How theme switching works

- **No `data-theme` attribute** → follows the OS (`prefers-color-scheme`).
- **`data-theme="dark"` / `data-theme="light"` on `<html>`** → explicit choice,
  always wins over the OS preference.

Tailwind's `dark:` variant (remapped in `tailwind.css`) follows the exact same
logic. Because every downstream rule (SCSS, `.t-*` classes, and Tailwind utilities
via `@theme inline`) reads these custom properties, the whole app re-themes with no
additional CSS. Each theme also sets `color-scheme` so native form controls and
scrollbars follow.

## Rules

- Write app styles against **semantic** tokens (`var(--surface)`), never against
  primitives (`var(--neutral-50)`, `var(--brand-300)`, `var(--paper)`). A primitive read
  from outside this package is a bug even when it looks right: it is a value that has
  escaped the layer where re-theming happens, so the next brand or theme changes
  around it silently. If the token you need does not exist, **add one here** — do not
  reach past the layer.
- Adding a semantic token = add it to **both** `_light.scss` and `_dark.scss`, and
  map it in the `@theme inline` block of the core's `tailwind.css` if Tailwind should
  see it. Keep the sets symmetric: those two files must define the same custom
  properties.
- A semantic token is a **cross-brand contract**. The moment a shared component reads
  `var(--some-new-token)`, every theme package owes it a value — a theme that lacks
  one fails silently, as an unresolved `var()`. Add it to every
  `libs/themes/*/` before the component ships.
- **Prefer a surface context over a new token family.** If a subtree needs different
  colours, that is almost always a context (`data-surface="…"`) re-pointing the
  existing tokens, not a parallel set of names for components to learn. A new token
  earns its place when it names something the vocabulary genuinely lacks — a _pairing_
  like `--on-warning`, or a specific material like `--media-scrim` — not when it is
  "`--surface`, but over there".

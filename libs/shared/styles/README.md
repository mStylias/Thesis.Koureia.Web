# shared styles — design system core

The **brand-neutral** visual foundation shared by every app and the component
Storybook. There are no colour values, type faces or elevation tints in here: those
are one brand's identity and live in a theme package, `libs/themes/<brand>/`.

A host loads two ordered global entries:

1. `src/tailwind.css` — Tailwind v4, theme-aware utility mappings and preflight.
2. `libs/themes/<brand>/src/main.scss` — the **theme**, which `@use`s this core and
   then emits its own tokens. An app never points at this library directly.

```
apps/<app>/project.json
  styles:       [ core tailwind.css, libs/themes/<brand>/src/main.scss ]
  includePaths: [ libs/shared/styles/src ]     ← how `@use 'core'` and
                                                    `@use 'abstracts'` resolve
```

That include path is the _only_ thing tying an app to this library, and there is no
TypeScript path alias for it. Swapping the design system is therefore a build-config
change — no import anywhere has to move.

## The core/theme boundary

| Core owns                                                                                                                  | A theme owns                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Which custom properties exist (`base/_emit.scss`)                                                                          | What values they hold                                                                                      |
| Structure: spacing grid, type **scale**, radii, borders, motion, breakpoints, layout measures, component geometry, z-index | Identity: brand + neutral ramps, semantic hues, paper, type faces, leading/weight/tracking, elevation tint |
| Element defaults, `.t-*` type classes, global component partials, vendor styles                                            | Semantic aliases per theme (`_light.scss`, `_dark.scss`) and surface contexts (`_surface-dark.scss`)       |

The split is by **consumption mode**, which is what actually constrains it:
`$breakpoints` is read as a literal Sass value inside `@media`, and component
stylesheets compile independently of any theme, so it has to stay in core. Everything
else reaches components only as a CSS custom property — and a theme may override any
structural map at the emit call, so per-brand density stays reachable:

```scss
@include emit.scale-vars($radius: t.$radius); // tighter corners, core spacing
```

Component Sass resolves `@use 'abstracts' as a` through the shared include path and
pulls only structure — `respond()`, the `t-*` mixins, `radius()`, `z()`, `container`,
`focus-ring`. No reusable UI library depends on an application-owned stylesheet, and
none of them can reach a brand value.

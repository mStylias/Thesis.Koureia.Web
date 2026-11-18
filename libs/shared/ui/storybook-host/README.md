# shared-ui-storybook-host

The single Storybook for the design system. It globs stories
from every component library under `libs/shared/ui/*`, so new component
libs need no Storybook setup of their own — just add a `*.stories.ts`
file next to the component.

- `pnpm storybook` — dev server on port 4400
- `pnpm build-storybook` — static build to `dist/storybook/shared-ui-storybook-host`

The preview loads the design-system global styles
(`libs/shared/styles/src/tailwind.css` then `main.scss`), the brand fonts, and a
light/dark theme toolbar toggle.

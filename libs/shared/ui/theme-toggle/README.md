# @ui/theme-toggle

Flips the interface between light and dark.

```ts
import { ThemeToggle } from '@ui/theme-toggle';
```

```html
<lib-theme-toggle size="sm" />
```

## Why a toggle and not a three-way control

`ThemeService` understands `system` as well, and it is the _initial_ state for anyone who has
never chosen — an absent `data-theme` is what hands control to `prefers-color-scheme`. This
control does not offer it as a destination. Someone reaching for a theme switch wants a
specific theme, and a third option whose label has to explain itself earns nothing in a
header. Anyone who wants the OS to decide has never touched this, which is the state they are
already in.

## Why the accessible name does not change

It is always "dark theme"; whether that is on rides on `aria-pressed`. A name flipping
between "switch to dark" and "switch to light" would be re-announced by the very interaction
that changed it — describing the control instead of its state. The icon still swaps, because
that is a visual affordance and not the name.

## API

| Input       | Type                   | Default | Notes                                                               |
| ----------- | ---------------------- | ------- | ------------------------------------------------------------------- |
| `size`      | `'sm' \| 'md' \| 'lg'` | `'md'`  | Matches the surrounding controls.                                   |
| `ariaLabel` | `string`               | `''`    | Overrides the translated name; empty falls back to the translation. |

It owns no state of its own — `ThemeService` in `@util/brand` holds the preference and owns
the `data-theme` attribute. Read `resolved()` there if a sibling needs the current theme.

## Accessibility

- A real `<button type="button">` with a stable accessible name and `aria-pressed`.
- The icon is `aria-hidden`; state is never carried by the icon alone.
- Focus is the global 2px accent ring.

## SSR

Safe to render on the server, but the server cannot know a visitor's stored choice, so it
renders the brand's `defaultTheme`. Each app's `index.html` carries a pre-paint script that
applies the stored value before the first frame; its key must match `THEME_STORAGE_KEY`.

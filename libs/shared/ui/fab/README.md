# shared-ui-fab

A floating action button: the one action a screen is for, as an elevated square
icon button in the corner. Import from `@ui/fab`.

```html
<lib-fab-group>
  <button libFab type="button" size="sm" severity="secondary" aria-label="Change view">
    <svg lucideCalendarDays aria-hidden="true"></svg>
  </button>
  <button libFab type="button" aria-label="New appointment">
    <svg lucidePlus aria-hidden="true"></svg>
  </button>
</lib-fab-group>
```

## Why not `libButton`

A button in a bar sits in the flow and matches the controls beside it. A FAB
floats over the content, so it needs elevation, a fixed square size and a larger
icon, and it has no caption. These rules have nothing in common with the
button's severity and variant matrix.

## Why the group owns the position

Each page that floats a button needs the same corner, the same safe-area inset
and the same layer under the overlays. `lib-fab-group` keeps these in one
place. `position="absolute"` pins the group to a positioned container instead of
the viewport, for a widget that fills only part of the page.

## API

`button[libFab]`

| Input      | Type                       | Default     | Description                            |
| ---------- | -------------------------- | ----------- | -------------------------------------- |
| `size`     | `'sm' \| 'md' \| 'lg'`     | `'md'`      | 2.5rem, 3.5rem or 6rem square.         |
| `severity` | `'primary' \| 'secondary'` | `'primary'` | The brand accent, or a raised surface. |

`lib-fab-group`

| Input      | Type                    | Default   | Description                                      |
| ---------- | ----------------------- | --------- | ------------------------------------------------ |
| `position` | `'fixed' \| 'absolute'` | `'fixed'` | Pin to the viewport, or to the nearest ancestor. |

## Accessibility

- The button holds only an icon. Give it an `aria-label`, and keep the icon
  `aria-hidden`. A `libTooltip` with the same text helps pointer users.
- The group stacks in DOM order, which is also the tab order. Put the main
  action last, nearest the corner.
- The group sits at `--z-sticky`, under drawers and dialogs, so an overlay
  covers it.

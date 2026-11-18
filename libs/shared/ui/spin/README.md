# shared-ui-spin

Turns an icon while work runs. When the work ends, the icon finishes the turn in
progress and comes to rest where it started. It never snaps back. Import from
`@ui/spin`.

```html
<button libButton iconOnly [attr.aria-busy]="loading() || null" aria-label="Refresh">
  <svg lucideRefreshCw [libSpin]="loading()" aria-hidden="true"></svg>
</button>
```

## Motion

- The first turn eases out (`--ease-out-cubic`), so the icon moves on the frame
  of the press.
- Each turn after it eases in and out (`--ease-in-out-quad`) and ends at rest.
- One turn takes `--dur-spin` (800ms). A load shorter than that still gets one
  full turn.
- The spin stops only on a turn boundary, where the icon is still.

## Why a directive and a global partial

A directive goes on any icon, a Lucide `<svg>` or a dynamic `[lucideIcon]`. It
adds no wrapper. A directive has no stylesheet, so the animation is in
`libs/shared/styles/src/components/_spin.scss`.

## Why `libSpin` is not `libButton`'s `loading`

`loading` replaces the icon with a generic spinner and disables the button. Use
`libSpin` when the icon itself shows the action, as a refresh icon does. The
button then stays enabled and keeps focus. Guard a second press in the handler.

## API

| Input     | Type      | Default | Description                                     |
| --------- | --------- | ------- | ----------------------------------------------- |
| `libSpin` | `boolean` | `false` | Work runs. When false, the turn finishes first. |

## Accessibility

- The icon is decoration: keep it `aria-hidden`. Put `aria-busy` on the control.
- Under `prefers-reduced-motion` the icon does not turn, and `aria-busy` carries
  the state alone.

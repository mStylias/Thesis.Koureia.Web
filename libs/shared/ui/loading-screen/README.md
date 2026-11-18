# @ui/loading-screen

Covers the first load of a client-rendered area with the brand mark and a sweeping indicator.

```ts
import { LoadingScreen } from '@ui/loading-screen';
```

```html
<lib-loading-screen [loading]="entering()" [logo]="brand.logo" />
```

## Why the minimum duration is a floor and not a delay

The splash goes down at the later of "loading finished" and "the floor elapsed". A 900ms load
shows it for 900ms; a 60ms load shows it for the 500ms floor. Adding the floor _on top_ of the
wait would make every fast load slower for no reason, and dropping the floor makes a fast load
flash for two frames, which reads as a glitch rather than as feedback.

## Why `loading` is an input and not the consumer's `@if`

The component owns the floor, so it has to outlive the flag that raised it. Keep it mounted and
bind the flag; with the flag down and the floor spent it renders an empty host.

## Why it belongs to the shell and not to the area it covers

The thing being waited for cannot draw the wait. Put it in the root component, above the router
outlet, and import it eagerly — a deferred splash would fetch its own chunk at the one moment it
has to appear instantly.

## Why the styles are global

They live in `libs/shared/styles/src/components/_loading-screen.scss`, not in a `styleUrl`.

A client-rendered address paints nothing until the bundle boots, and on a cold load that is the
longest part of the wait — the part no component can reach, because Angular does not exist yet.
An app answers it by writing this same markup into `index.html`. One stylesheet drawing both
copies is what makes the handover invisible; two would drift.

Handing over:

```html
<!-- index.html, inside <app-root> so a server render replaces it -->
<div class="loading-screen" id="app-splash" role="status">
  <img class="loading-screen-logo loading-screen-logo-enter" src="brand/icon.png" alt="" />
  <div class="loading-screen-bar" aria-hidden="true">
    <div class="loading-screen-bar-fill"></div>
  </div>
</div>
```

The app raises `loading` before the first render, passes `[animateLogo]="false"` so the mark does
not enter twice, sets `minDuration` to what is left of the floor, and removes `#app-splash` in
`afterNextRender` — after the component's copy is painted, never before. `apps/koureia` does all
four; copy it.

## Why the backdrop has no entrance

On a cold load it is the first thing on the screen. Fading it in would delay the only feedback
there is. The mark animates instead, and the whole surface fades on the way out.

## API

| Input         | Type      | Default | Notes                                                                                               |
| ------------- | --------- | ------- | --------------------------------------------------------------------------------------------------- |
| `loading`     | `boolean` | `false` | Whether the covered work is still running. Raising it shows the splash.                             |
| `logo`        | `string`  | `''`    | Brand mark path from `BRAND`. Square; a wider file is letterboxed. Empty draws the indicator alone. |
| `minDuration` | `number`  | `500`   | Floor on the total time up, in milliseconds. Zero or less means no floor.                           |
| `animateLogo` | `boolean` | `true`  | Play the mark's entrance. `false` when taking over a splash already on the screen.                  |
| `ariaLabel`   | `string`  | `''`    | Overrides the announced name; empty falls back to the translation.                                  |

`loadingScreenTranslocoScope` and `loadingScreenInlineLoader` are exported for an app that
preloads the dictionary rather than letting the pipe fetch it.

## Accessibility

- `role="status"` on the backdrop, named by a clipped span, so the wait is announced and not
  only drawn.
- The mark is decorative (`alt=""`) and the indicator is `aria-hidden`; neither carries meaning
  the name does not.
- Nothing here takes focus. The splash is transient and has no controls, so focus stays where
  the navigation left it.
- `@media (forced-colors: active)` keeps the sliver apart from its track.
- Under `prefers-reduced-motion` the sweep stops and the sliver parks centred. The global rule
  would otherwise collapse the loop to 0.01ms and leave an empty track.

## SSR

Safe to render on the server, and inert there: the floor timer is browser-only, so a server
render can never be held back by it. Nothing needs a splash on the server in any case — a
server-rendered page arrives built, which is why the pre-bootstrap copy belongs inside
`<app-root>`, where a render replaces it.

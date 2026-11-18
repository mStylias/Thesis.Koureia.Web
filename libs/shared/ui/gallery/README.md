# shared-ui-gallery

A set of photos led by one main photo, with a full-screen viewer. Import from `@ui/gallery`.

```ts
import { Gallery, type GalleryImage } from '@ui/gallery';
```

```html
<lib-gallery [images]="photos" ariaLabel="Photos of the barbershop" />
```

- **Wide screens (`md` and up):** a mosaic of the main photo and up to four more. When there
  are more photos than tiles, a **Show all photos (N)** button opens the viewer.
- **Phones:** one photo at a time in a sideways scroller, with a `1 / N` counter.
- **Viewer:** any photo opens it at that photo. Previous and next buttons, the arrow keys and a
  sideways swipe step through it. `Escape`, the close button and the browser back gesture close
  it.

The first photo is the main one. It loads at high priority, because it is usually the largest
thing on the page. Every other photo loads lazily. An empty `images` renders nothing, so the
consumer owns the placeholder.

## Why the viewer is `lib-dialog`

The viewer is `lib-dialog` in `fullScreen` mode with a headless template. The native `<dialog>`
gives focus containment, background inertness, `Escape` and focus return to the opening tile.
The viewer adds the photo stage, the steps and a dark surface (`data-surface="dark"`).

A pipe inside the headless template resolves against the dialog's own Transloco scope and renders
an empty string. The viewer resolves every string with `@let` in its own template and passes it
in.

## Why both layouts are in the markup

The mosaic and the strip are both rendered, and CSS shows one. The server cannot know the
viewport, so choosing in TypeScript would render one layout on the server and swap it after
hydration. A hidden lazy image is never fetched, so the hidden layout costs no downloads.

## Why the phone strip uses scroll snapping

The swipe is the browser's own scroll with `scroll-snap-type: x mandatory`. No script tracks the
pointer, so momentum, overscroll and accessibility settings behave as they do everywhere else.
The counter reads the scroll position.

## Why the viewer pushes a history entry

On a phone the viewer covers the page, and the back gesture must close it rather than leave the
page. Opening pushes an entry at the same URL. Any other close spends that entry again, so the
next back gesture does not land on a viewer that is already shut.

## API

- `images`: `readonly GalleryImage[]`, required. Main photo first.
  - `src`, `alt`, and optional `width` and `height`, which reserve the space before the photo
    loads.
- `ariaLabel`: the accessible name of the gallery. Falls back to the translated "Photos".
- `open(index = 0)`: opens the viewer at a photo.

## Accessibility

- Each tile is a `<button>` named after its photo (`View full screen: {alt}`). The image inside
  is decorative, so the name is read once.
- The viewer is a modal dialog with a translated name. The position (`Photo 3 of 39`) is
  announced through a polite live region.
- Previous and next use `aria-disabled`, not `disabled`, at either end. A native disabled button
  drops the focus it holds.
- The step buttons stay visible on every screen size, so the swipe is never the only way.
- The focus ring of a tile sits inside the tile, because the mosaic's rounded frame clips a ring
  outside it.

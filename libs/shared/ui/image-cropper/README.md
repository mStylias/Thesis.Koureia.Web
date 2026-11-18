# shared-ui-image-cropper

Crops an image to a square. Drag or arrow keys move it, the slider or `+`/`-` zoom it, and
`crop()` returns the kept square as a `Blob`. Import from `@ui/image-cropper`.

```html
<lib-image-cropper #cropper [source]="file" shape="circle" [outputSize]="1024" />
<button libButton [disabled]="!cropper.ready()" (click)="save(cropper)">Save</button>
```

```ts
const square = await cropper.crop(); // WebP, or JPEG where the browser cannot encode WebP
```

## Why the view is a center and a zoom

The crop is held as its center in the image's own pixels and a zoom. At zoom 1 the square's side is
the image's shorter side, so the image always covers the square and the side in image pixels is
`min(width, height) / zoom` whatever the size on screen. The layout is therefore percentages of
the square, with no measuring and no resize observer. Only a drag converts screen pixels, reading
the square's width when the pointer moves. The geometry is pure, in `core/crop-geometry.ts`.

## Why no EXIF code

Browsers apply a photo's EXIF orientation to `<img>` and to `drawImage` from it, so a phone
picture is upright on screen and in the output. A server that stores the image must still decode,
crop and re-encode it: the output is a convenience, not a guarantee.

## Why WebP with a JPEG fallback

Safari before 17 answers a WebP request with a PNG, which is far larger than a JPEG of the same
photo. `crop()` asks for WebP and falls back to JPEG when the blob is not WebP.

## API

| Input           | Type                   | Default    | Description                                     |
| --------------- | ---------------------- | ---------- | ----------------------------------------------- |
| `source`        | `Blob \| null`         | `null`     | The image. A new one starts centered, at zoom 1 |
| `shape`         | `'circle' \| 'square'` | `'circle'` | The mask. The output is a square either way     |
| `outputSize`    | `number`               | `1024`     | The side of the square `crop()` returns         |
| `maxZoom`       | `number`               | `4`        | The furthest the slider zooms in                |
| `ariaLabel`     | `string`               | translated | Name of the crop area                           |
| `hint`          | `string`               | translated | The instructions under the area                 |
| `zoomAriaLabel` | `string`               | translated | Name of the zoom slider                         |

`ready` and `failed` are signals. `crop()` resolves `null` before an image loads.

## Accessibility

The square is a focusable `group`, named and described by the visible instructions. Arrow keys move
it by a twentieth of its side and `+`/`-` zoom, so nothing needs a pointer. The slider is a native
range input. Every string comes through `uiCopy`, and the customer dictionary holds the singular
hint.

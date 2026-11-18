# @ui/card

Semantic, projection-based card structure for the design system. The
components decorate consumer-authored elements, providing the visual frame and
layout without changing document semantics or adding interaction.

## Usage

```ts
import {
  Card,
  CardBody,
  CardContent,
  CardFooter,
  CardHeader,
  CardMedia,
  CardSubtitle,
  CardTitle,
} from '@ui/card';
```

```html
<article libCard appearance="elevated">
  <figure libCardMedia>
    <img src="shop.webp" alt="Inside Acme Barbers" />
  </figure>
  <div libCardBody>
    <header libCardHeader>
      <div>
        <h2 libCardTitle><a href="/barbershops/acme">Acme Barbers</a></h2>
        <p libCardSubtitle>Κουκάκι · 0,8 km</p>
      </div>
    </header>
    <div libCardContent>★ 4,8 · 127 αξιολογήσεις</div>
    <footer libCardFooter>Από €18</footer>
  </div>
</article>
```

## Why attribute components

A card has no universal native element: a standalone result may be an
`<article>`, while a grouped item may be a `<li>` or a plain `<div>`. Attribute
components preserve that consumer-selected host while still allowing each
structural part to own encapsulated styles. The family deliberately does not
make the entire surface clickable; navigation belongs on real anchors and
actions on native buttons.

## API

`Card` accepts `appearance: 'outlined' | 'elevated'`, defaulting to `outlined`.
The remaining components are styling markers with no inputs:

- `CardMedia` — edge-to-edge visual or fallback region.
- `CardBody` — padded content layout.
- `CardHeader` — title group and optional supporting action.
- `CardTitle` — decoration for the consumer's correct heading level.
- `CardSubtitle` — supporting title copy.
- `CardContent` — main descriptive content.
- `CardFooter` — metadata and actions row.

The frame exposes `--card-padding`, `--card-gap`, and
`--card-media-aspect-ratio` for composition-level adjustments.

## Accessibility

The library adds no role, accessible name, focusability, or activation
behavior. Choose the semantic host and heading level that match the surrounding
document. Give images useful alternative text (or an empty `alt` when they are
decorative), use anchors for navigation, and use buttons for actions. Do not
nest one interactive element inside another or simulate a clickable card with
`role="button"`.

## Testing

Run `nx test shared-ui-card`.

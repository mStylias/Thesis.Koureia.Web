# @ui/stat

Figures on tiles: a large value with its label below, in a row of equal tiles that wraps
on a narrow screen. Use it for a few headline counts, such as a member's completed and
upcoming appointments and their rating.

```ts
import { Stat, StatGroup } from '@ui/stat';
```

```html
<h3 id="figures">Figures</h3>
<lib-stat-group aria-labelledby="figures">
  <lib-stat [value]="completed" label="Completed" />
  <lib-stat [value]="upcoming" label="Upcoming" />
  <lib-stat [value]="rating" [label]="reviewsText">
    <svg lucideStar aria-hidden="true"></svg>
  </lib-stat>
</lib-stat-group>
```

## Why the value is text

`value` takes a string or a number, already formatted. The tile does not know the
language, the unit or the precision, so the consumer formats it (`4.0`, `€1,250`).

## Why projected content is unstyled

Content projects after the value, for a unit or an icon. Emulated encapsulation cannot
reach projected nodes, so the consumer sizes and colors its own icon.

## Why the value size is a custom property

A long figure, such as `123.456,70 €`, can be wider than a narrow tile. Only the consumer knows
how wide its figures get and how wide its tiles are, so the consumer sets the size. A
container unit lets the figure follow the tile:

```scss
.tile {
  container-type: inline-size;
}

lib-stat {
  --stat-value-size: clamp(var(--text-lg), 20cqi, var(--text-xl));
}
```

## Why a label word stays whole

The label wraps between words. A word breaks only when it alone is wider than the tile, so a
label never reads as two half-words on a narrow tile.

## API

`lib-stat-group` has no inputs. Name it with `aria-label` or `aria-labelledby` on the host.

| Custom property     | Default          | On         | Notes                          |
| ------------------- | ---------------- | ---------- | ------------------------------ |
| `--stat-min-width`  | `7rem`           | group host | The narrowest tile in the row. |
| `--stat-value-size` | `var(--text-xl)` | stat host  | The font size of the value.    |

| `lib-stat` input | Type               | Notes                      |
| ---------------- | ------------------ | -------------------------- |
| `value`          | `string \| number` | Required. The figure.      |
| `label`          | `string`           | Required. What it counts.  |
| `labelFirst`     | `boolean`          | The label above the value. |

## Accessibility

- The group is a `list` and each tile in it a `listitem`. A tile outside a group has no role.
- A screen reader reads the value, then the label: "12 Completed". `labelFirst` changes only
  the visual order.
- Mark a projected icon `aria-hidden="true"`. The label must carry its meaning.
- In forced colors each tile gets a border, since its background disappears. A consumer that
  draws its own edge around the stat sets `border: 0` on it in its own forced-colors block.

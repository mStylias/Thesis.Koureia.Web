# shared-ui-progress

The progress indicators of the design system: a linear `lib-progress-bar`
and a circular `lib-progress-spinner`. Both track a known percentage
(`determinate`) or animate for work of unknown length (`indeterminate`), share
the same `tone`/`size` scales, and carry full `progressbar` ARIA semantics.
Import from `@ui/progress`.

```html
<lib-progress-bar [value]="uploaded()" ariaLabel="Upload progress" />
<lib-progress-spinner ariaLabel="Loading" />
```

## `lib-progress-bar`

- `[value]` (default `0`) — completion percentage, `0`–100. Clamped; ignored
  while indeterminate.
- `[mode]` (default `'determinate'`) — `'determinate'` fills to `value`;
  `'indeterminate'` animates a travelling segment.
- `[tone]` (default `'accent'`) — `accent` | `success` | `warning` | `error` |
  `info`.
- `[size]` (default `'md'`) — `sm` | `md` | `lg` track height.
- `[showValue]` (default `true`) — show the built-in percentage label
  (determinate only).
- `[unit]` (default `'%'`) — appended to the built-in label.
- `[ariaLabel]` / `[ariaLabelledby]` — accessible name. The visible percentage
  is a value, not a name; with neither, the bar names itself from the lib's
  translations (see [Accessibility](#accessibility)).

Project content to replace the built-in label:

```html
<lib-progress-bar [value]="done()" ariaLabel="Sync">
  {{ done() }} of {{ total() }} files
</lib-progress-bar>
```

## `lib-progress-spinner`

Same `value`, `tone`, `size`, `showValue`, `unit`, `ariaLabel`, and
`ariaLabelledby` inputs as the bar, with two differences:

- `[mode]` **defaults to `'indeterminate'`** (a rotating arc). In
  `'determinate'` mode the ring is **still** and filled to the exact percentage
  via `stroke-dashoffset`.
- `[spin]` (default `'linear'`) — indeterminate motion style: `'linear'` is a
  steady rotation; `'ease'` is the organic Material-style spin where the arc
  grows, shrinks, and changes pace as it turns. Ignored while determinate.
- `[showValue]` **defaults to `false`**; when `true` (determinate) it prints a
  centred label. Projected content overrides it — and does **not** need
  `showValue`: the input governs the built-in percentage, not the slot.

```html
<lib-progress-spinner mode="determinate" [value]="75" showValue ariaLabel="Upload" />
```

## Shared types

```ts
type ProgressTone = 'accent' | 'success' | 'warning' | 'error' | 'info';
type ProgressSize = 'sm' | 'md' | 'lg';
type ProgressMode = 'determinate' | 'indeterminate';
type ProgressSpin = 'linear' | 'ease';
```

Only these tones are exposed — the design system runs on one accent, so
arbitrary colours are intentionally not an option.

## Motion

GPU-only `transform`/`opacity`,
`--ease-standard` for on-screen movement, documented exceptions noted below.

- **Bar, determinate** — the fill `scaleX`-eases from its leading edge to the
  new value on `value` changes (GPU `transform`; the track's pill clip keeps the
  caps crisp).
- **Bar, indeterminate** — a segment `translateX`-travels across the track (GPU
  `transform`).
- **Spinner, `spin="linear"`** — a steady GPU `transform` rotation.
- **Spinner, `spin="ease"`** — a steady rotation plus an eased
  `stroke-dasharray`/`-dashoffset` morph (the arc grow/shrink). Animating the
  dash is a deliberate exception to the transform/opacity rule — there's no
  transform-based way to morph an arc's length — kept cheap on one tiny stroke.
- **Spinner, determinate** — `stroke-dashoffset` eases on `value` changes (same
  documented exception; discrete, low-frequency updates only).
- A status spinner is the accepted exception to "no infinite loops" — it signals
  ongoing work.
- **`prefers-reduced-motion`** — every animation is disabled: the determinate
  fill/ring snap to value, and indeterminate degrades to a static state (a
  dimmed full track / a still quarter arc).

## Accessibility

- The host is `role="progressbar"` with `aria-valuemin="0"`,
  `aria-valuemax="100"`, and `aria-valuenow` (omitted while indeterminate).
- **Name every indicator** via `ariaLabel` or `ariaLabelledby` — a
  `progressbar` takes its name from the author only, so nothing on the page can
  supply one for it.
- With neither, the indicator names **itself** from the lib's own `progress`
  Transloco scope (`Progress` while determinate, `Loading` while not) instead
  of reporting nothing and failing AXE's `aria-progressbar-name`. The text is a
  clipped `aria-hidden` span referenced by `aria-labelledby`, because a host
  binding cannot run a translation pipe and only a transformed pipe registers
  the scope's lazy loader.
- Passing **both** `ariaLabel` and `ariaLabelledby` is not a way to say more:
  `aria-labelledby` wins the name computation, so `aria-label` is dropped
  rather than left to compete.
- The spinner `<svg>` is `aria-hidden` and `focusable="false"`, leaving the host
  as the single source of state.
- Colours meet **WCAG AA** contrast in both light and dark themes. Under a
  forced palette — which would otherwise repaint track and fill, or ring and
  arc, in one colour — the filled part switches to `Highlight` so the
  proportion stays readable.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-progress` to execute the unit tests.

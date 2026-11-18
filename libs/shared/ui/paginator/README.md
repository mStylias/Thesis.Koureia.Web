# shared-ui-paginator

The paginator of the design system. A composable page navigator: one
`layout` input decides which controls appear and in what order, so the same
component is a bare prev/next bar, a full numbered strip, or a data-grid footer
with a rows-per-page dropdown and a jump-to-page field. Import from
`@ui/paginator`.

```html
<lib-paginator
  [(page)]="page"
  [(rows)]="rows"
  [totalRecords]="total()"
  [rowsPerPageOptions]="[10, 20, 50]"
  [layout]="['first', 'prev', 'pages', 'next', 'last', 'rowsPerPage', 'currentReport']"
  (paginate)="load($event)"
/>
```

## `lib-paginator`

- `[(page)]` — current page, **1-based**. Two-way.
- `[(rows)]` — rows per page. Two-way. Changing it keeps the first visible
  record on screen (the page is recomputed around it).
- `[totalRecords]` — total records across all pages. Anything unusable (`NaN`
  from an unparseable attribute, or a negative) is treated as `0`.
- `[rowsPerPageOptions]` — `number[]` for the `rowsPerPage` dropdown. Empty ⇒ the
  dropdown renders nothing even if it's in the layout.
- `[layout]` — ordered `PaginatorSection[]` (see below). Defaults to
  `['first', 'prev', 'pages', 'next', 'last']`.
- `[pageLinkSize]` (default `5`) — target width of the centred window in the
  numbered `pages` strip. Floored at `1`.
- `[currentPageReportTemplate]` — placeholders: `{currentPage}`,
  `{totalPages}`, `{first}`, `{last}`, `{rows}`, `{totalRecords}`
  (`{first}`/`{last}` are 1-based, human-facing). Empty by default, which uses
  the translated `paginator.currentReportTemplate` (`{currentPage} of
  {totalPages}` in English).
- `[alwaysShow]` (default `true`) — when `false`, the paginator hides itself if
  there is one page or fewer.
- `[disabled]` — disables every control.
- `[ariaLabel]` — accessible name for the `navigation` landmark. Empty by
  default, which uses the translated `paginator.ariaLabel`.
- `(paginate)` — emits the full `PaginatorState` on every user-driven page or
  rows change.

### `PaginatorState`

```ts
interface PaginatorState {
  page: number; // 1-based
  rows: number;
  first: number; // 0-based index of the first row on the page
  last: number; // exclusive end index, clamped to total
  pageCount: number; // at least 1
  totalRecords: number;
}
```

`first`/`last` are array indices, so the current slice is
`rows.slice(state.first, state.last)`.

### Sections (`layout`)

`first` · `prev` · `pages` · `next` · `last` · `rowsPerPage` · `currentReport`
· `jumpToPageInput` · `jumpToPageDropdown`.

The `pages` strip uses a boundary + ellipsis window (`1 … 4 5 6 … 20`); tune the
window with `pageLinkSize`.

## Template slots

Override any section's rendered content with an `<ng-template libPaginatorTemplate>`
carrying the section name. The template receives the current `PaginatorState`:

```html
<lib-paginator [(page)]="page" [rows]="10" [totalRecords]="120">
  <ng-template libPaginatorTemplate="currentReport" let-s>
    Showing {{ s.first + 1 }}–{{ s.last }} of {{ s.totalRecords }}
  </ng-template>
</lib-paginator>
```

Use the special `container` slot to replace the entire body and lay the pieces
out yourself.

## Motion

Deliberately restrained — the paginator is a high-frequency control, so most
of it never animates. The whole bar fades + rises in (and reverses ~20% faster
out) when it appears or disappears via `alwaysShow` (`animate.enter`/`leave`,
`--ease-out`; the base layer neutralises it under `prefers-reduced-motion`).
The entrance is withheld on the first paint — `animate.enter` fires on initial
insertion too, and a bar that animates on every page load is motion nobody
asked for. Everything else stays instant; hover, press (`scale .97`), and the
active-page highlight cross-fade come from the underlying `libButton`.

## Sizing

Three named dimensions in `$component-size`, overridable per instance:
`--paginator-link-size` (numbered links stay square so digits don't shift the
strip), `--paginator-select-width`, `--paginator-jump-width`.

## Accessibility

- Renders a `navigation` landmark named by `ariaLabel`.
- Every button carries a translated `aria-label` (Transloco `paginator` scope,
  Greek + English shipped); the numbered strip is a labelled `group`. Nothing
  is hardcoded English — the landmark name and the report template fall back to
  the scope, and both are overridable per instance.
- The active page link is marked `aria-current="page"`.
- Boundary/step buttons are disabled at the ends; the report is an
  `aria-live="polite"` region.
- Focus is Tab-based — every control is individually reachable.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-paginator` to execute the unit tests.

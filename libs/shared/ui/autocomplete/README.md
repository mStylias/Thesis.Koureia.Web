# shared-ui-autocomplete

Editable, selection-only combobox over a local array or a remote
`DataSource<T>`, built on the headless `@angular/aria` combobox + listbox
pattern. Import from `@ui/autocomplete`.

```html
<!-- A local array is a source. Nothing else changes. -->
<lib-autocomplete
  [source]="roles"
  key="id"
  [displayWith]="roleName"
  [(value)]="roleId"
  ariaLabel="Role"
/>

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-autocomplete
  [source]="rolesSource"
  key="id"
  [displayWith]="roleName"
  [formField]="form.roleId"
/>
```

The `source` input takes `readonly T[] | DataSource<T>` from `@ui/data-source`.
An array is wrapped in a source that searches, pages and resolves keys locally,
so the control has **one** load path rather than a local branch and a remote
branch.

## Why the value is a key, not the item

A form field persists an id. Holding the item would make the control's value
change identity every time a page reloads it, and `===` against a
freshly-deserialized object never matches — the defect the select family's
reference-equality watchpoint describes. The value is a `DataKey` derived by the
`key` input, so a round trip through the server preserves it.

The cost is that the control must be able to turn a key back into display text,
which is what `DataSource.byKeys` is for.

## Why a persisted key survives a source that cannot display it

A form loaded with `roleId: 42` must not silently become empty because the role
is soft-deleted, the source has no `byKeys`, or the lookup call failed. The
control **keeps the value** and reports why it cannot render it:
`resolutionFailed` emits, `data-unresolved` appears on the host, and a message
is rendered and named by `aria-describedby`. Clearing the field stays the user's
decision. Saving the form writes back the id it was given.

## Why the panel asks for one row more than it shows

`take` is `pageSize + 1`. The extra row is a probe: it proves another page
exists without a `$count` the source may not support. The row itself is
discarded, and the probe **outranks** whatever `hasMore` the source reported —
a source computing `hasMore` over the rows it returned answers `false` on the
very page whose extra row was withheld, which strands the last item.

## Why the debounce lives here and not in the source

A source is shared. The datagrid must not debounce; this control must. Putting
the delay in the control keeps one source usable by both. The first load of a
panel is immediate — the delay applies to typing, not to opening.

## Why typed text is draft state

The value only changes on an explicit commit (clicking an option, or `Enter` on
the active one). Typing that matches nothing and then losing focus restores the
committed item's text. A combobox that committed on blur would let a typo
silently replace a valid selection.

## Why the field action is an input pair and not a projected slot

`actionIcon` + `(action)` renders the button inside the library's own template.
Projected content keeps the **consumer's** encapsulation attribute, so a
projected `<button>` could not be reached by this library's styles and would
need a global partial to look like the field it sits in. The icon is a
`LucideIconInput`, so the caller still chooses the glyph.

Pressing it collapses the panel. A field action takes over from the suggestion
list, so leaving the list open would hang stale suggestions over whatever the
action produced.

It sits **last in the field, past the clear slot**: the × belongs to the text and
stays next to what it empties, while the action belongs to the field. The field's
trailing padding moves to whichever of the two is actually last. Being icon-only,
it always carries a tooltip — `actionTooltip`, defaulting to `actionAriaLabel`,
which repeats the accessible name rather than replacing it.

## API

- `source`: `readonly T[] | DataSource<T>` — required
- `key`: `KeySpec<T>` — a field name, dot path, field list, or function; required
- `displayWith`: `(item: T) => string` — plain text for the input and for
  assistive technology; required
- `searchWith`: text the local array path matches against; defaults to
  `displayWith`
- `optionDisabled`: `(item: T) => boolean`
- `value`: two-way `DataKey`; `''` while nothing is selected
- `size`: `sm` | `md` (default) | `lg`
- `pageSize` (default 20), `debounceMs` (default 250)
- `showClear`, `frameless`, `placeholder`
- `leadingIcon`: `LucideIconInput | null` — replaces the default search glyph
- `actionIcon`, `actionAriaLabel`, `actionTooltip`, `actionPending`,
  `actionDisabled` — one button inside the field, after the clear slot. It is
  rendered only while `actionIcon` **and** `actionAriaLabel` are both set, and is
  withheld entirely while the control is `disabled` or `readonly`
- `disabled`, `readonly`, `invalid`, `touched`, `required`, `errors` — all bound
  automatically by `[formField]`
- `inputId`, `name`, `autocomplete`, `ariaLabel`, `ariaLabelledby`,
  `ariaDescribedby`
- `noDataMessage`, `loadErrorMessage`, `unavailableMessage`,
  `resolutionErrorMessage`, `clearAriaLabel` — each falls back to the lib's
  `autocomplete` Transloco scope (el/en) when left empty
- `(queryChange)`: draft search text, not the value
- `(selectionChange)`: `{ key, item }`, or `undefined` on clear
- `(resolutionFailed)`: `{ key, reason, cause? }` where reason is `notFound`,
  `loadFailed` or `unsupported`
- `(action)`: the field action button was pressed
- `(touch)`: marks the field touched once focus leaves the whole control
- `focus(options?)`, `reload()`, `clear()`
- Custom option rows via `<ng-template libAutocompleteOption let-item
  let-query="query">`; a presentation-only panel footer via
  `<ng-template libAutocompleteFooter let-query="query">`, for the attribution a
  third-party suggestion provider requires

Signal Forms: implements `FormValueControl<DataKey>`, so `[formField]` syncs
value, disabled, invalid, required and touched.

Float/IFTA labels: sets `data-filled` and consumes `--field-pad-top`, so it
composes with `libFloatLabel` / `libIftaLabel` from `@ui/form-field`.

## Accessibility

- The input is the only tab stop. The listbox uses
  `focusMode="activedescendant"`, so arrow keys move the active option while
  focus stays where the user is typing.
- The clear × is a real `<button type="button">` with an accessible name — it
  sits outside the combobox element, so the role restriction that forces the
  select family to use a decorative `<svg>` does not apply here.
- The field action button is a real `<button type="button">` too, for the same
  reason, and `actionAriaLabel` is mandatory: an action with no accessible name
  is not rendered at all rather than rendered nameless. Its tooltip repeats that
  name and never stands in for it.
- Every edit path re-checks `disabled` and `readonly`: the clear and action
  buttons are withheld, the panel refuses to open, and the handlers guard again
  against a stale click.
- `required` is exposed as `aria-required`, never the native attribute.
- Errors appear only once the field is touched or blurred **and** the initial
  key has finished resolving, so a value the user has not touched cannot accuse
  them of a mistake.
- `aria-describedby` composes the consumer's ids with the control's own error
  and resolution messages.
- Result counts, no-results and load failures are announced through one polite
  live region rather than per keystroke.

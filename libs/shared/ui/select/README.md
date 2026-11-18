# shared-ui-select

The single-value select (dropdown) of the design system, built on the
headless `@angular/aria` combobox + listbox pattern (keyboard navigation,
typeahead, and the ARIA contract for free). Import from `@ui/select`.

```html
<lib-select
  [options]="cities"
  [(value)]="selectedCity"
  placeholder="Select a city"
  ariaLabel="City"
/>

<!-- Signal Forms binds value, disabled, invalid, required and touch -->
<lib-select [formField]="bookingForm.barber" [options]="barbers" />
```

## Reading from a data source

Bind `source` instead of `options` to read from a `DataSource<TItem>`
(`@ui/data-source`) — the contract `@data/odata-source` and any other transport
implement. `options` wins when both are bound, so adding a source can never make
an already-populated select fetch.

```html
<lib-select
  [source]="roles"
  key="id"
  [displayWith]="roleName"
  [(value)]="roleId"
  ariaLabel="Role"
/>
```

Four things change, and nothing else does.

**`value` is the item's declared key, never the item.** `SelectOption.value` is
compared with `===`, so a lookup that returns freshly deserialized objects would
produce a value the control never matches again — it would silently lose its own
selection. Keying off `key` is what makes a persisted id survive a round trip.

**`byKeys` resolves a value no page has loaded.** A select bound to role 31
renders "Role 31" without fetching the collection. A value the source **cannot**
display is kept, not cleared: the host still has to save the id back. The
trigger shows `unavailableMessage`, the host carries `data-unresolved`, and
`(resolutionFailed)` reports `notFound`, `unsupported` or `loadFailed`.

**Typing queries the source.** The select-only combobox pattern answers a typed
character with a local typeahead; one loaded page is the wrong set to jump
inside, so the same characters become the query instead — debounced by
`debounceMs`, aborting the request they supersede. Focus never leaves the
trigger, so the ARIA contract is untouched; the panel's search row displays the
query and `Backspace` edits it. The local typeahead stays for the `options` path.

**The panel pages as it scrolls**, asking for one row more than it shows so it
learns whether another page exists without a `$count` the endpoint may not opt
into.

**The panel opens upward** when the room under the trigger would cut it off,
and grows out of the trigger either way. It is measured as it mounts, so the
side is right on the first frame — a select at the bottom edge of a page, or in
a table footer, needs nothing from the caller.

## Why the clear × is `aria-hidden` and pointer-only

`role="combobox"` is role-restricted: a nested `<button>` inside the trigger
breaks its ARIA contract and trips `aria-required-children`. So the clear × is a
decorative `<svg>` that only responds to a pointer, and the keyboard path is the
one the pattern already provides — `Delete`/`Backspace` on the closed trigger.

Because it never reaches the accessibility tree, its label is a **`title`
tooltip, not an `aria-label`** (same conclusion as multi-select and tabs). An
`aria-label` on an `aria-hidden` element is dead markup.

## Why the modality flag is set on the trigger, not the host

`data-modality` mirrors `:focus-visible` for the `aria-activedescendant` ring.
`@angular/aria`'s `KeyboardEventManager` defaults to `stopPropagation`, so every
key it handles — the arrows that move the active option included — never reaches
an ancestor. A host-level `(keydown)` therefore never fired and the ring stayed
suppressed for the rest of a pointer-started interaction. A sibling listener on
the trigger itself still runs, so that is where the keyboard half lives.

## API

- `options`: `SelectOption<T, TItem>[]` — `{ label, value, disabled?, item? }`;
  values are compared by reference
- `value`: two-way; `undefined` while nothing is selected
- `size`: `sm` | `md` (default) | `lg`
- `showClear`: × affordance in the trigger; keyboard users clear with
  `Delete`/`Backspace`
- `loading`: spinner in place of the chevron
- `disabled`, `invalid`, `required` — all bound automatically by `[formField]`
- `frameless`: hides the trigger's border, background and focus ring so a parent
  can draw one frame around a group — a scope chooser beside a search box, a
  boolean editor beside an operation chooser. Two frames a hairline apart read
  as two controls. The **leading** inline padding goes too, since the parent's
  frame supplies that inset; the trailing padding stays so the chevron is held
  off the frame. The `invalid` border goes too — the frame must paint the error
  state, or the user loses a state they must notice.
- `source`: `DataSource<TItem>` — remote options; see above
- `key`: `KeySpec<TItem>` — required with `source`; a field name, dot path,
  field list or function
- `displayWith`: `(item: TItem) => string` — option text for a source item
- `optionDisabled`: `(item: TItem) => boolean`
- `pageSize` (default 20), `debounceMs` (default 250) — source path only
- `loadErrorMessage`, `unavailableMessage`, `searchHint` — fall back to the
  `select` scope
- `(resolutionFailed)`: a bound value was kept but could not be displayed
- `reload()`: re-runs the active source query
- `placeholder`, `inputId`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `emptyMessage`, `clearAriaLabel` — both fall back to the lib's `select`
  Transloco scope (el/en) when left empty
- `(touch)`: marks the field touched for Signal Forms once focus leaves
- `focus(options?)`: focuses the trigger
- Custom option rows via `<ng-template libSelectOption let-option>`; custom
  trigger content via `<ng-template libSelectedItem let-option>`

Signal Forms: implements `FormValueControl<T | undefined>`, so it binds directly
with `[formField]="form.city"` — value, disabled, invalid and required states are
synced automatically and blur marks the field touched.

Float/IFTA labels: sets the `data-filled` host attribute and consumes
`--field-pad-top`, so it composes with `libFloatLabel` / `libIftaLabel` from
`@ui/form-field`.

Drawing something over the closed field — a per-item menu button, say — set
`--select-value-inset-end` on the select to the width of what you draw. It
shortens the line box, so the ellipsis lands in front of your control instead of
under it, and it does so for **all three** things the closed field can hold: the
selected item, the `placeholder` and `unavailableMessage`. Padding your own
`libSelectedItem` content covers only the first, which is how the Greek
placeholder in `@ui/datagrid`'s compact views bar came to run under its menu
glyph.

## Accessibility

- Give the trigger an accessible name via `ariaLabel`, `ariaLabelledby`, or an
  external `<label for>` targeting `inputId`.
- The trigger exposes the **combobox** role and toggles `aria-expanded`; the
  panel is a **listbox** of `option`s, with the chosen row marked
  `aria-selected`. Focus stays on the trigger and moves through
  `aria-activedescendant`.
- `required` is exposed as **`aria-required`**, never the native attribute: the
  native one blocks the submit event outright and raises an OS-locale bubble
  over the form's own translated message. Submit through Signal Forms'
  `submit()`.
- `ariaDescribedby` is passed through untouched — the control renders no error
  text of its own.
- A **disabled** control withholds the × _and_ ignores the `Delete`/`Backspace`
  shortcut. The pattern disables through `aria-disabled`, so the trigger keeps
  DOM focus and would otherwise still be editable from the keyboard.
- The active-option ring only renders during keyboard interaction (the host
  mirrors `:focus-visible` through `data-modality`).
- With a `source` bound, the panel's search row is presentational: focus stays
  on the trigger and the row only displays what was typed, so the combobox keeps
  a single tab stop and its `aria-activedescendant`. Result counts, no-results
  and load failures are announced through one polite live region.
- Selection carries a bold weight as well as a background, so it never rests on
  colour alone, and a `forced-colors` block re-states the focus ring, the active
  option and the selected row that a forced palette would otherwise drop along
  with the box-shadows.

## Running unit tests

Run `nx test shared-ui-select` to execute the unit tests.

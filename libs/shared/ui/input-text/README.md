# Text input

The text field of the design system, applied as an **attribute on a
native `<input>`** — so native semantics, autofill, IME, and form participation
stay intact, and Signal Forms binds straight to the element. Import from
`@ui/input-text`.

```html
<input libInputText placeholder="Full name" />
<input libInputText size="sm" invalid />

<!-- Signal Forms: binds to the real input, nothing extra needed -->
<input libInputText [formField]="form.name" />
```

## Why an attribute and not an element

There is no wrapper and no inner input to keep in sync: the host _is_ the
control. That is what keeps browser autofill, password managers, IME
composition, and `<form>` submission working without any bridging code, and it
is why `disabled` and `readonly` are just the native attributes rather than
component inputs.

The price is that a control needing sibling DOM cannot be built this way — hence
the separate `libIconField` wrapper below.

## API

- `size`: `sm` | `md` (default) | `lg` (shadows the unused native `size`
  attribute)
- `invalid`: error border, also reflected as `aria-invalid`; with Signal Forms
  bind it to the field state, e.g.
  `[invalid]="form.name().touched() && form.name().invalid()"`
- `disabled` / `readonly`: the native attributes — nothing custom. Read-only
  drops the hover border, since hover promises an edit.
- `frameless`: hides the border, background and focus ring so a parent can draw
  one frame around a group — an editor beside an operation chooser, an input
  beside a unit select. The parent then owns the resting border and the
  `:focus-within` ring. Two frames a hairline apart read as two controls, which
  is the whole reason this exists. It also drops the **leading** inline
  padding, since the parent's frame supplies that inset — keeping both opens a
  gap the value looks lost in; the trailing padding stays so a clear button is
  still held off the frame. The `invalid` border goes too — the frame must paint
  the error state, or the user loses a state they must notice.

## Icons and clearing

Icons inside the box and a clear (×) affordance come from the `libIconField`
wrapper:

```html
<div libIconField showClear>
  <span libInputIcon><svg lucideSearch></svg></span>
  <input libInputText placeholder="Search" />
</div>
```

- `iconPosition`: `left` (default) | `right`; the `libInputIcon` element is
  decorative (`aria-hidden`, no pointer events)
- `showClear`: a real focusable × button while the input has a value. On a
  `type="search"` input it also suppresses the browser's own clear button, which
  would otherwise sit beside it. Clearing
  dispatches a native `input` event so `[formField]` stays in sync, then
  refocuses the input; `(cleared)` emits afterwards
- `clearAriaLabel`: overrides the button's name, which otherwise comes from the
  lib's `iconField` Transloco scope (Greek first, English fallback)
- The button is **withheld while the input is `disabled` or `readonly`**, and the
  handler re-checks both as a stale-click guard — a control the user cannot edit
  must not offer a control that edits it
- Icon and clear can combine; the paddings stack automatically

## Composing with labels

Float/IFTA labels (`@ui/form-field`) compose directly, and the input
consumes `--field-pad-top` for the `in`/IFTA variants.

- A **direct-child** input needs `placeholder=" "` so the label can detect a
  value through `:placeholder-shown`.
- Wrapped in `libIconField`, the input is no longer a direct child, so the
  wrapper reports the `data-filled` contract instead — which the label wrappers
  match at any depth, and which also survives programmatic writes.

## Accessibility

- The host is a native `<input>`, so role, focus behaviour, autofill, and
  keyboard handling come for free — but it still needs a name: a `<label for>`
  (see the label wrappers) or an `aria-label`. A `placeholder` is not a label.
- `invalid` reflects `aria-invalid="true"`. Pair it with a message referenced
  from `aria-describedby`; the attribute selector has no DOM of its own to render
  one in, and the state must never be colour alone.
- Focus is the 2px accent border rather than the global focus glow, and both it
  and the resting border are restated in system colours under `forced-colors`.

## Running unit tests

Run `nx test shared-ui-input-text` to execute the unit tests.

# shared-ui-form-field

The form layer of the design system: one field of a form — its label, control, hint and message, or
the same field read as text — plus the label decorations any control can wear. Import from
`@ui/form-field`.

- [`lib-field` and friends](#a-field) render what `@util/forms` decides.
- [`libFloatLabel` / `libIftaLabel`](#label-wrappers) are layout-only and work with any control.

## A field

```html
<form [libForm]="editor">
  <lib-form-errors />

  <lib-field [field]="editor.form.name">
    <ng-template libFieldEditor>
      <input libInputText libFieldControl placeholder=" " [formField]="editor.form.name" />
    </ng-template>
  </lib-field>
</form>
```

That is the whole of it. The label, the hint, the required mark, the message, the generated `id`,
the composed `aria-describedby` and — in view mode — the value as text all come from the field
itself, through the spec it was declared with in `@util/forms`. Turning a form into a read-only
view of the same record costs no markup: `lib-field` reads the mode from the `libForm` on the
enclosing `<form>`.

### Why the control lives in a template

View mode must not instantiate it. Projected content is created by the consumer's template whether
this component renders it or not, so a read-only field would still build a control nobody can see —
and a picker or an autocomplete brings an overlay, a resource and a keyboard contract with it.
`libFieldEditor` also hands out the `id` and `aria-describedby` as context, for a control that
cannot take `libFieldControl`:
`<ng-template libFieldEditor let-id let-describedBy="describedBy">`.

### Why `libFieldControl` binds so little

`[formField]` owns `required`, `readonly`, `min`, `max`, `minlength`, `maxlength`, `name` and the
value; binding any of them again is both a conflict and an NG8022. The directive therefore sets only
the `id` and an `aria-describedby` **composed** with whatever the consumer already wrote — never
replacing it.

### Why `libForm` and not `[formRoot]`

`[formRoot]` calls `submit()` itself, and the editor must open its validation gate _before_ the
form's validity is read. `libForm` owns the submit event instead, and adds `novalidate`: the
required marker reaches a native input as the native attribute from the first render, and the
browser would otherwise refuse the submit with its own untranslated bubble over the message the
field is about to show.

### Messages

A message is a **translation key**, and a key the dictionary does not hold renders as itself — which
is what puts a server's own sentence on the field that earned it. A rule that declares no key falls
back to this library's own copy, keyed by the error's `kind` (`field.errors.required`,
`field.errors.maxLength`, …), with the limit interpolated.

### API

| Export            | What it does                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib-field`       | one field. `field` (required), `labelStyle` (`ifta` default, `float`, `plain`), `label`, `hint`, `inputId`, `mode` |
| `libFieldEditor`  | the template holding the control                                                                                   |
| `libFieldView`    | the template reading the value, when text is not enough                                                            |
| `libFieldControl` | on the control: the `id` and the composed description                                                              |
| `libForm`         | on the `<form>`: carries the editor, commits on submit, `novalidate`                                               |
| `lib-form-errors` | what a refused write said that no field owns                                                                       |

## Label wrappers

Both are attribute-selector components applied to the wrapper you already write — no extra DOM:

```html
<!-- Float label: floats away on focus/fill -->
<div libFloatLabel variant="in">
  <lib-select inputId="city" [options]="cities" [(value)]="city" />
  <label for="city">City</label>
</div>

<!-- IFTA label: always small at the top of the control -->
<div libIftaLabel>
  <input id="email" type="email" placeholder=" " />
  <label for="email">Email</label>
</div>
```

### Why attribute selectors and pure CSS

An element component would have to own the control, the label and their
association; instead the consumer keeps writing the `<label for>`/`id` pair
they would write anyway, and the wrapper only positions it. Because every
state is read from CSS rather than from an input, the wrappers work with
native controls, design-system controls and third-party ones alike — nothing has to
be taught about the label.

### API

- `libFloatLabel` `variant`: `over` (default, lifts above the border) | `in` (tucks into the control) | `on` (sits on the border line)
- `libIftaLabel` takes no inputs

### State detection

| State   | Detected from                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| focus   | `:focus-within`                                                                                                              |
| filled  | a **direct-child** `input`/`textarea` with `placeholder=" "`, or the `data-filled` host attribute design-system controls set |
| invalid | `aria-invalid="true"` or the `data-invalid` host attribute                                                                   |

The `:placeholder-shown` trick matches direct children only. An input carrying
no `placeholder` attribute at all never matches `:placeholder-shown` — read as
a descendant, that made the inner `<input>` of controls like `input-otp` and
`phone-input` look permanently filled and stranded the label in its floated
position. design-system controls report through `data-filled` instead, which is safe
to match at any depth.

### Custom properties

Set these **on the wrapper**, never on a control's `:host`: the label is the
control's sibling, and custom properties only inherit downward, so a control
cannot reach it.

| Property              | Default                   | Purpose                                                                                                                |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `--field-label-inset` | `--space-3`               | Horizontal offset, to line the label up with a `sm`/`lg` field's own padding                                           |
| `--field-label-bg`    | `--surface`               | Mask behind the `on` variant's notch, for a field that does not sit on `--surface`                                     |
| `--field-pad-top`     | `--space-6` (`in` + IFTA) | Room the control makes for the label; design-system controls consume it, direct-child inputs/textareas are padded here |

### Route your own top padding through `--field-pad-top`

The wrapper's `[libIftaLabel] > input { padding-top: var(--field-pad-top) }` has
the same specificity as a component-scoped `input { … }` rule and is injected
first, so **any `padding` shorthand in a component's own styles wins** — and the
label then sits on top of the value instead of above it. Declare the top padding
through the property, the way every design-system control does:

```scss
// Right — the wrapper can make room for the label
padding: var(--field-pad-top, var(--input-pad-y)) var(--input-pad-x) var(--input-pad-y);

// Wrong — clobbers the wrapper and overlaps the label
padding: var(--input-pad-y) var(--input-pad-x);
```

## Accessibility

- `lib-field` labels the control through the `for`/`id` pair it generates, so clicking the label
  focuses it. The required mark is `aria-hidden` — the control already reports required through
  `aria-required` or the native attribute, and a mark read twice is noise.
- A message is a `role="alert"` region referenced from the control's `aria-describedby`, so it is
  announced when it appears and reachable afterwards.
- View mode renders no control at all. Nothing there can be focused, so nothing reads as a control
  the user is being refused.
- Both wrappers are layout-only: the accessible name comes from the `<label for>`/`id` pair you write, so clicking the label focuses the control.
- The label text is a persistent visible name in every variant — it is not a placeholder that disappears once the user types.
- The invalid state is carried by `aria-invalid="true"` (or `data-invalid`), not by the label colour alone.
- The label is `pointer-events: none` while overlapping the control, so a click on the overlapped area reaches the control rather than being swallowed.

## Running unit tests

Run `nx test shared-ui-form-field` to execute the unit tests.

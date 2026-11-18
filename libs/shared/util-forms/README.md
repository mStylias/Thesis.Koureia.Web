# shared-util-forms

The app's editing policy around a Signal Form. Import from `@util/forms`.

No DOM and no HTTP: `@ui/form-field` renders what this decides, and `@synax/forms` turns a refused
write into something it can place.

```ts
// roles.form.ts — the fields, declared once
export const ROLE_FIELDS = fields<RoleFormValue>({
  name: field({
    label: 'managementRoles.name',
    required: 'managementRoles.details.nameRequired',
    maxLength: [64, 'managementRoles.details.nameTooLong'],
  }),
  description: field({
    label: 'managementRoles.description',
    empty: 'managementRoles.details.noDescription',
  }),
});

// the component
protected readonly editor = formEditor({
  model: this.model,                                     // the caller keeps owning it
  fields: ROLE_FIELDS,
  resetOn: () => this.roleId(),                          // a new address is a new editor
  mode: (id) => (id === NEW_ROLE ? 'create' : 'view'),
  action: () => this.write(),                            // returns a FormFailure or undefined
});
```

## The UX it enforces

1. **A field reports nothing until the user asks for the form to be saved.** Not even after being
   left empty — a field the user is on their way past is not a mistake yet.
2. **The first commit validates client-side first.** If the form is invalid the write never runs,
   the messages appear, and focus lands on the first field with something wrong with it. From then
   on validation is live: messages come and go as the user types, with no second press.
3. **What a write refuses goes back where it came from.** A failure naming a property lands on that
   field and clears when that field is edited; the rest sit in `generalErrors` until the next
   commit.

## Why the gate is in the schema

`[formField]` pushes `invalid`, `errors`, `required` and the limits from the field state straight
into a control's matching inputs. A control cannot withhold them and a competing binding races the
directive, so **error visibility cannot be gated at render time**. Every validator therefore sits
behind one `applyWhen(root, committed)`: until the first commit the form has no errors at all,
rather than hidden ones.

`commit()` opens the gate **before** it calls `submit()`, because `submit` reads the form's validity
to decide whether to run the action. Set the other way round, the first press would send a form
nothing had validated. This is also why Signal Forms' own `[formRoot]` is not used — it calls
`submit()` itself — and why a submit button may never be disabled by validity.

## Why markers are outside the gate

`required(path, {when})` computes the `REQUIRED` metadata from `when`, so gating validation would
also drop `aria-required` and `maxlength` until the first press. The spec's constraints are
therefore applied twice: once as ungated marker metadata (`REQUIRED`, `MIN_LENGTH`, `MAX_LENGTH`,
`PATTERN`, whose reducers make the second contribution a no-op) and once as gated validators.

A native input then carries the native `required` attribute from the first render, so the form it
sits in **must** carry `novalidate` — which `libForm` does. Without it the browser refuses the
submit with its own untranslated bubble over the message the field is about to show.

`min`, `max` and `email` have no marker: their metadata is selected indirectly through a limit
selection key, and with native validation off the only thing it carries is a number input's spinner
bounds.

## API

| Export                                                    | What it does                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `field(spec)`                                             | declares one field: `label`, `hint`, `empty`, `view`, `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `rules` |
| `group(fields)`                                           | declares a nested object of fields                                                                                                    |
| `fields(specs)`                                           | identity, so a spec tree outside a component stays typed against its model                                                            |
| `formEditor(config)`                                      | the form plus the policy — see the table below                                                                                        |
| `FIELD_SPEC`, `fieldSpec(state)`, `viewText(spec, value)` | how a renderer reads a field's spec back                                                                                              |
| `placeServerErrors(form, errors)`                         | sorts failures into field-scoped and general                                                                                          |
| `resolveField(form, segments)`                            | walks `['items', 2, 'name']` down a field tree                                                                                        |
| `focusFirstInvalid(form)`                                 | focuses the first field with an error                                                                                                 |

`formEditor` returns `form` (the plain `FieldTree` — nothing is wrapped or hidden), `mode`
(writable) with `editing`/`viewing`/`creating`, `committed`, `submitting`, `generalErrors`,
`commit()` and `reset(value?)`.

Messages are **translation keys**, never copy: this library holds no dictionary, and `lib-field`
resolves them. A key the dictionary does not hold renders as itself, which is what puts a server's
own sentence on the field that earned it.

## Limits

- Models must never hold `null` or `undefined` — `''`, `0`, `[]`. Signal Forms requires it, and the
  view formatting is written against empty values rather than nullish ones.
- Array fields are not declared by a spec yet. Use `rules`/`liveRules` with `applyEach` for those.
- `rules` is gated with the spec. `disabled`, `readonly`, `hidden` and `debounce` belong in
  `liveRules`, or they would only take effect after a commit.

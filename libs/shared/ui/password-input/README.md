# shared-ui-password-input

The password field of the design system: masked input, reveal toggle, strength meter and requirements checklist. Import from `@ui/password-input`.

```html
<!-- Plain masked field -->
<lib-password-input [(value)]="password" ariaLabel="Password" />

<!-- Sign-up: meter + checklist floating while the field has focus -->
<lib-password-input
  [formField]="signUpForm.password"
  feedback="popover"
  autocomplete="new-password"
/>
```

## Why one rule set instead of two

The usual arrangement (PrimeNG's included) drives the strength meter off a pair of regexes and leaves the requirements checklist to the consumer, so the meter can read "Strong" while the checklist still shows an unmet rule — and neither is connected to the form's validators.

Here a single `PasswordRule[]` drives all three:

- the **checklist** renders it;
- the **meter** draws one segment per rule, so each requirement satisfied lights exactly one more;
- `defaultPasswordStrength` **scores** against it on a five-point scale — very weak, weak, fair, good, strong — reserving the top rating for a complete checklist, so "Strong" always means every rule passed;
- `validatePassword(path, rules)` turns the same array into **schema validation**.

Pass the same array to the control and to the schema and they cannot disagree.

```ts
const RULES = passwordRules({ minLength: 10, special: false });

const signUpForm = form(model, (signUp) => {
  required(signUp.password);
  validatePassword(signUp.password, RULES);
});
```

```html
<lib-password-input [formField]="signUpForm.password" [rules]="RULES" feedback="popover" />
```

Validation lives in the schema, not the control: the control receives the results through the auto-bound `errors`/`touched` inputs and renders a translated message once the field is touched.

## API

- `value`: two-way `string`
- `size`: `sm|md|lg` (default `md`), `disabled`, `invalid`, `placeholder`
- `autocomplete`: `current-password` (default) | `new-password` | `off` — use `new-password` on sign-up and reset forms so managers offer to generate one
- `showToggle`: reveal toggle, **on by default**; `showClear`: clear button, off by default. Both are withheld while `disabled`
- `revealed`: two-way `boolean` — bind it to unmask several fields from one switch
- `feedback`: `none` (default) | `inline` (in flow, pushes layout) | `popover` (CDK overlay under the field while focused) | `side` (the same overlay, beside the field)
- `showStrength` / `showRequirements`: what the feedback area contains; both on by default
- `rules`: `PasswordRule[]`, defaults to `DEFAULT_PASSWORD_RULES` (12 characters, uppercase, lowercase, digit, symbol)
- `strengthScorer`: `(value, rules) => 0..5`, defaults to `defaultPasswordStrength`
- `inputId`, `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`, `toggleAriaLabel`, `clearAriaLabel`
- `(touch)`: marks the field touched for Signal Forms once focus leaves

Also exported: `passwordRules(options)`, `DEFAULT_PASSWORD_RULES`, `DEFAULT_PASSWORD_MIN_LENGTH`, `defaultPasswordStrength`, `PASSWORD_STRENGTH_LEVELS`, `validatePassword`.

### The meter

A shield-and-label row over a segmented bar, with the rating as a tag on the right — never colour alone, so the state survives a monochrome or forced-colours rendering. The five levels take the five semantic hues in order:

| Level | Word      | Colour      |
| ----- | --------- | ----------- |
| 1     | Very weak | `--error`   |
| 2     | Weak      | `--warning` |
| 3     | Fair      | `--info`    |
| 4     | Good      | `--accent`  |
| 5     | Strong    | `--success` |

**The bar adapts to the rule count.** There is one segment per rule, lit by how many are satisfied — five rules give the one-level-per-rule progression above, three rules give three segments that fill one at a time while the rating takes bigger steps up the same five-point scale (weak → good → strong). The wording and colour therefore stay comparable across forms whatever the rule count. A control with no rules at all is being rated by a custom `strengthScorer`, so it falls back to five segments driven by the score itself.

Rules are Unicode-aware — `Καλημέρα` satisfies the upper- and lowercase rules — and length counts code points, so an emoji is one character rather than two.

## The popover

`feedback="popover"` renders the panel through `PopoverService` from `@ui/popover`, deliberately **not** `[libPopoverTriggerFor]`, which moves focus into the panel on open. Nothing here may take focus away from a field the user is typing into.

- opens on `focusin`, so the requirements are visible before the first keystroke;
- survives focus moving to the reveal or clear button (containment is checked on the host, not the input);
- closes on blur and on `Escape`, which is only swallowed while the panel is open so the key still reaches a surrounding dialog otherwise;
- outside-pointer dismissal is off — the adornment buttons are outside the pane and would otherwise close it on use;
- being an overlay, it escapes `overflow: hidden` ancestors and flips above the field near the viewport bottom.

Panel styles stay in the component's own SCSS: a CDK `TemplatePortal` keeps the declaring component's encapsulation attribute, so no global partial is needed.

### `feedback="side"`

The same overlay, placed beside the field and top-aligned with it rather than under it. A panel under the field covers whatever follows it — the confirm-password field, the terms checkbox, the submit button — for as long as the field has focus. Beside it, nothing the user is working through is hidden.

Everything else is identical: it opens on `focusin`, takes no focus, and closes on blur or `Escape`.

- **Placement adapts.** The end side is preferred, the start side is the first fallback for a field near that edge of the viewport, and the last two fallbacks are the `popover` positions. A viewport too narrow for a panel beside the field therefore stacks it rather than letting the CDK push it over the control — a phone gets the `popover` behaviour without the consumer switching modes.
- **The entrance follows the placement.** The panel slides out of the edge it actually landed on, so a flip reverses the direction with it. The landed position is read from the `PopoverRef.position()` signal, which is why the ref is held in a signal rather than a plain field.
- **The panel does not take the field's width.** Only the stacked placement lines up with the field; a side panel that copied a wide field would reach the viewport edge, so it keeps its own `--password-panel-min-width` floor and content width.

## Accessibility

Telling a screen-reader user how they are doing, without narrating every keystroke:

- **On focus** — `aria-describedby` points at a visually-hidden sentence built from the rules, so the requirements arrive before typing even in popover mode, where the visual panel lives at the end of `<body>`. A consumer-supplied `ariaDescribedby` is preserved and the control's ids are appended to it.
- **While typing** — a visually-hidden `role="status"` region announces a summary debounced to ~600ms of idle: _"Strength: Good. 3 of 5 requirements met. Missing: at least 12 characters, a special character."_ It stays silent while the field is empty and until the lazy translations arrive.
- **The visual panel is `aria-hidden`** — it repeats both of the above.

The reveal toggle is a real `<button>` named "Show password" in **both** states, with the state on `aria-pressed`: a label that flips while the button has focus gets re-announced mid-interaction. The strength meter is four `aria-hidden` segments plus the rating as plain text, not a `role="progressbar"` — "Password strength 75%" is noise for a qualitative rating.

| Key               | Action                                                      |
| ----------------- | ----------------------------------------------------------- |
| `Tab`             | Input → clear → reveal toggle                               |
| `Enter` / `Space` | Activates the focused button                                |
| `Escape`          | Closes the feedback panel; passes through when it is closed |

Focus is the 2px accent border on the field (error tokens when invalid), every string is Transloco-scoped (`passwordInput`, Greek and English shipped), and the segments stay legible under `forced-colors`.

Signal Forms: implements `FormValueControl<string>`, so `[formField]="signUpForm.password"` binds value, disabled, invalid, touched, required and errors, and exposes `focus()` for the framework to call.

`required` is exposed as `aria-required`, never as the native `required` attribute. The native one hands validation to the browser, which blocks submit and shows an un-styleable bubble in the **OS** locale — on top of the translated message this control already renders. The consequence is that nothing validates the form for you, so submit through Signal Forms' `submit()` rather than a hand-rolled `(submit)` handler: it marks the form touched, so errors surface for a field the user never focused.

```ts
protected async send(): Promise<void> {
  const ok = await submit(this.signUpForm, () => this.api.signUp(this.model()));
}
```

Float/IFTA labels work as-is — wrap in `[libFloatLabel]` or `[libIftaLabel]` from `@ui/form-field`. The control sets `data-filled`/`data-invalid` and consumes `--field-pad-top`, so the wrappers need no knowledge of it. The label is a sibling of the control rather than a descendant, so the control cannot set `--field-label-inset` for it; at `sm` and `lg` set it on the wrapper to match the field's horizontal padding.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-password-input` to execute the unit tests.

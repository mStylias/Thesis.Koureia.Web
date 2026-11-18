# OTP input

The one-time-password input of the design system. Import from `@ui/input-otp`.

```html
<lib-input-otp [(value)]="code" [length]="6" ariaLabel="Verification code" />
<lib-input-otp [(value)]="code" [length]="6" [separatorAfter]="[3]" mask />
```

## Why one input instead of one per digit

Most OTP components render N `<input maxlength="1">` and hand-roll the focus movement. This one renders a **single real input laid transparently over the drawn cells** — the same shape the Checkbox uses for its box.

- Assistive technology gets **one named control with one tab stop**, not N unnamed textboxes whose auto-advance cuts off the character echo.
- `autocomplete="one-time-code"` autofill works the way the spec intends: one field holding the whole code.
- Arrow keys, `Home`/`End`, `Backspace`, `Delete`, selection, paste, and undo are the browser's own behaviour, not re-implemented keyboard code.

Two behaviors are layered on top, both matching what people expect from split cells:

- typing over a filled cell **replaces** that character instead of shifting the rest of the code right (or being swallowed once `maxlength` is reached);
- focusing an **already-complete** code selects it, so retyping starts over instead of dead-ending.

## API

- `value`: two-way `string`, always sanitized to `charset` and `length` — **including a value set from outside**, which is written back to the model so a consumer never reads a code longer or dirtier than the control is showing
- `length`: cell count, default `4`; a zero, negative, or fractional value falls back to `4`
- `charset`: `numeric` (default, `0-9`, `inputmode="numeric"`) | `alphanumeric` (also `A-Z`/`a-z`, standard keyboard, case preserved)
- `mask`: draws `•` per character. Visual only — the field stays a text input, so `inputmode`, autofill, and paste keep working and no password manager offers to save the code
- `separatorAfter`: one-based positions to break the code at, e.g. `[3]` on six cells. Positions outside the code are ignored
- `size`: `sm|md|lg`, `disabled`, `readonly`, `invalid`, `touched`, `required`, `errors`, `autoFocus`
- `inputId`, `name`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`
- `(completed)`: emits the code after any edit that leaves every cell filled — including a correction to an already-complete code, so an auto-submitting screen re-submits
- `(touch)`: marks the field touched for Signal Forms once focus leaves
- a public `focus(options?)`, which Signal Forms uses on submit errors

Pasting is forgiving: `123-456` becomes `123456`, and anything past the last cell is dropped.

## Disabled and read-only

`disabled` removes the control from operation. `readonly` keeps the code
readable, focusable and copyable but refuses every edit — no typing, no paste,
no caret placement by pointer. Both are re-checked inside the handlers, so a
programmatic `beforeinput` cannot slip past the native attribute.

## Templating

`<ng-template libInputOtpCell>` replaces the cell **contents** — context `$implicit` (the glyph to show, already masked), `char`, `index`, `filled`, `active`. The cell box, focus ring, and caret stay with the component, so a custom renderer can change how the code looks but never how it behaves. `<ng-template libInputOtpSeparator>` does the same for group dividers (`$implicit` is the one-based position it follows), which default to an en dash.

```html
<lib-input-otp [(value)]="code" [length]="6" [separatorAfter]="[3]">
  <ng-template libInputOtpCell let-char let-filled="filled">
    {{ filled ? char : '·' }}
  </ng-template>
</lib-input-otp>
```

## Accessibility

One `<input>` carries the accessible name; the cells are `aria-hidden` decoration. Name it with `ariaLabel`, or `inputId` + an external `<label for>` plus `ariaLabelledby`, and point `ariaDescribedby` at the "we sent a code to …" hint — the control appends its own error id rather than overwriting yours. Failing all of those, the name falls back to the lib's `inputOtp` Transloco scope (Greek first, English fallback) so the field is never unnamed.

| Key                    | Action                                          |
| ---------------------- | ----------------------------------------------- |
| `Tab`                  | Into the code, then straight out of it          |
| `←` / `→`              | Move the caret between cells                    |
| `Home` / `End`         | Jump to the first or last cell                  |
| `Backspace` / `Delete` | Remove a character                              |
| `Ctrl`/`Cmd` + `A`     | Select the whole code                           |
| `Ctrl`/`Cmd` + `V`     | Paste; anything outside the charset is stripped |
| Any allowed character  | Overwrites the cell under the caret             |

Focus is a solid 2px accent ring on the active cell (the input's own ring is invisible at `opacity: 0`), the caret stand-in is static rather than blinking because the design system rules out infinite loops, cells shrink to keep the code on one row at 320px and 400% zoom, because a wrapped code reads as two codes, and every state is re-drawn against system colours under `forced-colors`.

Required is exposed as `aria-required`, never the native attribute, so the browser cannot block `submit()` with an untranslated bubble.

Signal Forms: implements `FormValueControl<string>`, so `[formField]="verifyForm.code"` binds value, disabled, invalid, touched, required and errors automatically. The control renders the first error itself in a `role="alert"`, held back until the field is touched or blurred so a pre-filled invalid code never accuses the user up front — `required`, `minLength` and `pattern` get translated messages, anything else falls back to a generic one, and a validator's own `message` always wins. That also keeps the invalid state from being carried by the cell border colour alone.

Float/IFTA labels are deliberately not supported — a floating label has nowhere sane to sit over a row of cells. Use an external `<label>` above the control.

## Running unit tests

Run `nx test shared-ui-input-otp` to execute the unit tests.

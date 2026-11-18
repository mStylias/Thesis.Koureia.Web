# shared-ui-confirmation-dialog

The confirmation dialog of the design system: a yes/no prompt in a native
`<dialog>`, opened imperatively and awaited. Import from
`@ui/confirmation-dialog`.

Nothing goes in the app shell — inject `ConfirmationService` and await the
result:

```ts
private readonly confirmation = inject(ConfirmationService);

const result = await this.confirmation.open({
  title: 'Cancel booking?',
  message: 'Friday at 17:30 with Kimonas will be freed up.',
  severity: 'error',
  confirmLabel: 'Cancel booking',
  cancelLabel: 'Keep it',
});
if (result === 'confirmed') { … }
```

For anything with its own content, form or footer, use
[`@ui/dialog`](../dialog/README.md) instead.

## Why a service rather than a component in the template

A confirmation is a question asked at one point in a flow, and its answer is the
next line of code. A declarative dialog forces that into a `visible` signal plus
two output handlers plus a variable to remember what was being confirmed. Here
the dialog is created on demand, appended to `<body>`, awaited, and destroyed
when it closes — `open()` resolves with `'confirmed'`, `'cancelled'` or
`'dismissed'`, so the decision reads as one `await`.

## Why the defaults carry no copy

`CONFIRMATION_DEFAULTS` holds behaviour only. A module-level constant cannot
translate, so English defaults would have been frozen into every call site that
omitted a label. Instead the component renders its own Transloco copy
(`confirmationDialog` scope, `el` + `en`) for anything the caller omits, and a
generic prompt follows the active language.

That leaves a distinction worth knowing: **omitted** falls back to the
translation, an explicit **`''`** drops the element entirely. So
`{ title: '' }` gives a message-only prompt, while `{}` gives a translated
"Confirm action".

## Copy overrides reach the dialog through the caller's injector

Every default string reads through `@util/ui-copy` (`confirmationDialog.title`, `.message`,
`.confirmLabel`, `.cancelLabel`, `.closeDialog`). The service is a root service and creates the
dialog from the root environment, so a `provideUiCopy` on a route or a component does not reach
it. Pass the caller's injector as the second argument:

```ts
private readonly injector = inject(Injector);

await this.confirmation.open({ severity: 'error' }, this.injector);
```

The service reads `UI_COPY` from that injector and gives the dialog only that value. The
caller's other providers do not reach the dialog. Without an injector, the dialog uses the root
overrides, or its own copy when there are none.

## API

`ConfirmationService.open(config?, injector?)` → `Promise<ConfirmationResult>`

- `title`, `message`: omit for the translated default, `''` to drop the element
- `severity`: `primary` | `secondary` | `success` | `info` | `warning`
  (default) | `error` — colours both the icon badge and the confirm button
- `showIcon`: the severity badge (default `true`)
- `confirmLabel`, `cancelLabel`: omit for the translated defaults
- `showCancel`: `false` gives an acknowledge-only dialog with one button
- `dismissible`: `false` (default) requires a deliberate choice; `true` adds a ×
  button and allows `Escape` / backdrop-click, all resolving `'dismissed'`

`ConfirmationResult` is `'confirmed' | 'cancelled' | 'dismissed'`.
`CONFIRMATION_DEFAULTS` is exported for consumers that want to read or spread
the behavioural defaults.

## Accessibility

- `showModal()` supplies focus containment, background inertness and top-layer
  stacking; the native `close()` restores focus to whatever opened the dialog.
- The heading names the dialog via `aria-labelledby` and the message describes it
  via `aria-describedby`. Dropping the heading with `title: ''` does **not**
  leave the dialog nameless — the translated default title becomes its
  `aria-label` instead.
- When the cancel action is shown it carries `autofocus`, so `showModal()` lands
  initial focus on the non-destructive choice.
- When not `dismissible`, `Escape` is intercepted rather than allowed to close:
  the dialog is asking for a choice, and dismissing without one is not an
  answer. There is then no × button either, so the affordance matches the
  behaviour.
- The severity badge is `aria-hidden` decoration and the × icon is too — the
  meaning is in the copy and the button's translated name, never in the colour
  or the glyph.
- Every close path resolves the promise exactly once, so a caller can never be
  left awaiting a dialog the user has already dismissed.
- Motion is CSS-driven, so the base layer collapses it under
  `prefers-reduced-motion` with no per-component query.

## Running unit tests

Run `nx test shared-ui-confirmation-dialog` to execute the unit tests.

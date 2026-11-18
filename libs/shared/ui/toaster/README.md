# shared-ui-toaster

The toaster of the design system — a signal-based [sonner](https://sonner.emilkowal.ski/) port. Import from `@ui/toaster`.

Place `<lib-toaster />` once in the app shell, then fire toasts from anywhere through `ToasterService`.

```html
<!-- app shell -->
<lib-toaster position="bottom-right" />
```

```ts
private readonly toaster = inject(ToasterService);

this.toaster.success('Booking confirmed for Friday at 17:30');
this.toaster.error('That slot was just taken', 'Booking failed');

const id = this.toaster.loading('Confirming your booking…');
this.toaster.dismiss(id);

await this.toaster.promise(save(), {
  loading: { message: 'Confirming your booking…' },
  success: { message: 'Booking confirmed', title: 'All set' },
  error: { message: 'Could not confirm booking' },
});
```

## Why a service and a single stack

A toast is a response to something the app just did, and the code that did it is rarely the code that owns a corner of the screen — so the queue is a **root service** and the component is a passive renderer of it. One `<lib-toaster>` per app: two would each render the same queue.

The component **re-parents itself to `<body>`** on first render. A transform or `overflow` anywhere in the shell would otherwise trap a `position: fixed` stack inside it, and the stack must overlay the whole viewport.

The stacking mechanics — the collapsed peek, the height morph, swipe-to-dismiss, the pausable timer — are ported from sonner@2.0.7 rather than reinvented, and the CSS keeps its variable names so the two can be diffed.

**Auto-dismiss toasts never show a close button** (`closeButton` only affects sticky ones): a control that removes something already leaving is noise, and the toast is dismissible by swipe regardless. Anything the user must be able to dismiss on their own terms should be `sticky: true`.

## API

`ToasterService`

- `success` / `info` / `warning` / `error`: `(message, title?) => string` — returns the toast id
- `loading(message, title?)` — a sticky spinner toast that never auto-dismisses; resolve it with `dismiss()` or use `promise()`
- `show(options: ToastOptions)` — the full form: `severity`, `title`, `message`, `life`, `sticky`, `closable`, `action`
- `promise(task, { loading, success, error })` — one toast that becomes a success or error toast; rethrows what `task` rejected with
- `dismiss(id)` / `dismissAll()` — animate out; `remove(id)` — drop immediately, no exit
- `toasts` — the queue, newest first; `defaultLife` — kept in step with `<lib-toaster [life]>`

`ToastOptions.life` is the auto-dismiss delay in ms; **`0` means never**. `sticky` also disables auto-dismiss, and is what earns a close button.

`<lib-toaster>`

- `position` (default `bottom-right`) — any of the six corners
- `life` (default `4000`) — the delay for toasts that don't set their own
- `visibleToasts` (default `3`) — how many stay on screen before the rest collapse behind them
- `gap` (default `14`) — px between stacked toasts
- `closeButton` (default `true`) — whether **sticky** toasts show one
- `expand` — keep the stack always open instead of collapsing behind the front toast
- `ariaLabel` / `closeAriaLabel` — override the stack's and the close button's names; both fall back to the lib's `toaster` Transloco scope

## Accessibility

- The stack is an `aria-live="polite"` list, so a toast is **announced without moving focus** — the user's current task is never interrupted. `role="list"` is restated explicitly because `list-style: none` drops list semantics in WebKit.
- **Nothing depends on colour**: the severity is carried by the icon's shape as much as its fill, and the message says what happened. Both buttons keep a `forced-colors` border, since a forced palette repaints their backgrounds in the same colour as the toast behind them.
- Auto-dismiss **pauses while the stack is hovered, while a toast holds keyboard focus, and while the tab is hidden**. Focus counts because a toast that vanishes from under the keyboard takes the user's place in the page with it.
- **A dismissed toast hands focus on** rather than dropping it on `<body>`: to the next toast still on screen, or else back to whatever had focus before the user moved into the stack. `focusin`'s `relatedTarget` is what records that origin.
- Toasts past `visibleToasts` are faded out, non-interactive **and out of the tab order** — their own buttons included, so tabbing never lands on something invisible.
- Every visible toast is a tab stop, which is what makes its action and close buttons reachable at all.
- Text and icon contrast meet **WCAG AA** in both themes across every severity.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-toaster` to execute the unit tests.

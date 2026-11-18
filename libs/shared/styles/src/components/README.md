# components/

Small, self-contained, reusable UI pieces — one partial per widget (`_button.scss`,
`_card.scss`, `_badge.scss`, `_input.scss`, …).

## Angular first

In this codebase most component styles should live **with the Angular component**
(inline styles or a co-located `.scss`), where they are encapsulated and lazy-loaded
with the component. Use this folder only for styles that must be **global**, e.g.:

- classes applied to content Angular doesn't own (CMS/innerHTML output)
- styling that must pierce many components uniformly (e.g. a global `.btn` used in
  static markup)
- overlay/portal content rendered outside component encapsulation (dialogs, toasts)
- projected content or DOM injected by third-party libraries (`_float-label.scss`,
  `_icon-field.scss`, `_phone-input.scss`) — `ViewEncapsulation.None` and
  `::ng-deep` are forbidden; a partial here, scoped under the component's
  selector, is the sanctioned escape hatch

Angular component stylesheets can still reuse the system's vocabulary:

```scss
@use 'abstracts' as a;

.btn-primary {
  @include a.t-title;
  background: var(--accent);
  color: var(--accent-fg);
  border-radius: a.radius(md);
  box-shadow: var(--shadow-accent);
  transition: background var(--dur-base) var(--ease-standard);
}
```

## Rules

- One partial = one component; register it in `_index.scss`
- Consume tokens for reusable design decisions. Intrinsic CSS mechanics may stay
  literal; public/repeated component dimensions belong in `$component-size`.
- A component partial must not depend on where the component sits on the page;
  positioning context belongs to `layout/` or `pages/`

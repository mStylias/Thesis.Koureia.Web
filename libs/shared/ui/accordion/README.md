# @ui/accordion

Accessible, controlled accordions built on the headless `@angular/aria`
accordion pattern.

```ts
import {
  Accordion,
  AccordionContent,
  AccordionHeading,
  AccordionPanel,
  AccordionPanelBody,
  AccordionTrigger,
} from '@ui/accordion';
```

```html
<lib-accordion [(value)]="active">
  <section>
    <h3 libAccordionHeading>
      <button libAccordionTrigger value="account" [panel]="accountPanel">Account</button>
    </h3>

    <div libAccordionPanel #accountPanel="ngAccordionPanel">
      <ng-template libAccordionContent>
        <div libAccordionPanelBody>Account details</div>
      </ng-template>
    </div>
  </section>
</lib-accordion>
```

## Why these decisions

- **The consumer authors the heading level.** `libAccordionHeading` is an
  attribute component on `h2`–`h6` rather than an element that picks a level
  for you, because the right level depends on the surrounding document
  outline — and getting it wrong breaks heading navigation.
- **The trigger is a real `<button>`.** An attribute selector keeps native
  activation, focus, and form behaviour instead of re-implementing them.
- **`multiple` is enforced here, not by the headless group.** The group's own
  `multiExpandable` cannot be driven from `hostDirectives` — Angular can only
  _re-expose_ a host directive's input, never bind one — and forwarding it
  would hand consumers the group's default (`true`), flipping this component
  from single to multiple expansion. So the group is left permissive and the
  reconciling effect, which owns `value` anyway, enforces the mode.
- **`libAccordionPanelBody` is required.** The panel host is a CSS grid whose
  single row animates from `1fr` to `0fr`; padding on that row would give the
  collapsing track a non-zero floor, so it lives on an inner wrapper instead.
- **Clicks fall through to the button.** The label and indicator are
  `pointer-events: none`, because the aria pattern resolves the clicked trigger
  by matching `event.target` or walking up to `[ngAccordionTrigger]` — an
  attribute that never reaches the DOM, since the pattern is applied as a host
  directive. A click landing on an inner node would otherwise be lost.
- **Item dividers are global.** The element separating one item from the next
  belongs to the consumer, which emulated encapsulation cannot reach, so the
  rule lives in `styles/src/components/_accordion.scss`.

## API

### `lib-accordion`

- `[(value)]` — the expanded trigger's `value`, or `null`. With `multiple`,
  a `readonly string[]`.
- `[multiple]` — allow more than one expanded panel.
- `[disabled]` · `[softDisabled]` · `[wrap]` — forwarded to the headless group
  (`softDisabled` keeps disabled triggers focusable; `wrap` wraps arrow-key
  navigation from last to first).
- `expandAll()` — no-op unless `multiple`. `collapseAll()`.

### `button[libAccordionTrigger]`

- `[value]` — required, identifies the trigger in the root's `value`.
- `[panel]` — required, the `libAccordionPanel` template reference.
- `[(expanded)]` · `[disabled]` · `[id]`.

### `[libAccordionPanel]`

- `[preserveContent]` (default `true`) — keep instantiated content mounted
  after collapse, preserving local state. Set `false` to destroy it.
- `[id]`.

### Others

`h2..h6[libAccordionHeading]` · `ng-template[libAccordionContent]` (content is
created on first expansion) · `[libAccordionPanelBody]` (required direct child
of the content) · `[libAccordionIndicator]` — project an element with it to
replace the default chevron.

## Accessibility

- The trigger/region relationship (`aria-expanded`, `aria-controls`,
  `role="region"`, `aria-labelledby`) comes from `@angular/aria`, as does
  roving focus and Enter, Space, Arrow, Home, and End support.
- Collapsed panels are `inert`, so their content leaves the tab order and the
  accessibility tree.
- Disabled triggers are `aria-disabled` and are not activatable; the semantic
  heading level stays the consumer's choice.
- The indicator is decorative and `aria-hidden`; it rotates from the trigger's
  own `aria-expanded`, so state is never carried by the icon alone.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test shared-ui-accordion` to execute the unit tests.

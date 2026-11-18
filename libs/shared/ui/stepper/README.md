# shared-ui-stepper

A linear progress indicator for a multi-step flow. Import from `@ui/stepper`.

```ts
import { Stepper, type StepperStep } from '@ui/stepper';
```

```html
<lib-stepper
  [steps]="steps()"
  [(activeStep)]="step"
  [completedSteps]="done()"
  (stepSelected)="goTo($event)"
>
  <!-- the active step's body, owned by the caller -->
</lib-stepper>
```

- **Wide screens (`md` and up):** a rail of numbered markers with labels beside them and a
  connector between them.
- **Phones:** the same rail, with each label above its own marker and the steps spread evenly,
  under a compact header that carries `Step 3 of 5` and a progress bar. Every step is named at
  every width, and the markers stay activatable, so going back is still one tap.

Keep the labels short. A narrow column is about a fifth of the screen, and a long label wraps
there. A step's `summary` is the wide presentation only.

The component is presentational. It renders the list, reports activations, and projects the
active step's body. It does not decide what "complete" means and holds none of the flow's data.

## API

| Input            | Type                         | Meaning                                                    |
| ---------------- | ---------------------------- | ---------------------------------------------------------- |
| `steps`          | `readonly StepperStep[]`     | The steps, in order. Required.                             |
| `activeStep`     | `string` (model)             | The step showing now, by `id`. Required.                   |
| `completedSteps` | `readonly string[]`          | The ids the flow considers done.                           |
| `orientation`    | `'horizontal' \| 'vertical'` | Wide-screen layout. The narrow one is the same either way. |
| `ariaLabel`      | `string`                     | Names the list. Falls back to a translated default.        |

| Output         | Carries                                           |
| -------------- | ------------------------------------------------- |
| `stepSelected` | The `id` of the completed step that was activated |

A `StepperStep` is `{ id, label, summary?, locked? }`.

## Why only a completed step is a button

An upcoming step is inert markup, so a keyboard user never lands on a step the flow is not
ready for and no one clicks something that silently does nothing. `locked` is the other half of
that rule: a step the flow decided before the stepper appeared renders as done and is also
inert, which is honest about there being nothing to go back to.

`select()` re-checks the state inside the handler rather than trusting the template that drew
the button, because the step list can change between the render and the click.

## Why the compact header is `aria-hidden`

The list below it already carries the position and the label to assistive technology. Leaving
both readable announces every step twice. The header does not repeat the active step's name
either, for the same reason a reader would hear it: the rail already says it.

## Why the active marker grows a ring instead of a thicker border

A border that thickens changes the marker's size, which nudges every step along the rail as the
flow advances. The ring is `box-shadow`, so it paints outside the box and moves nothing.

## Accessibility

- The list is an `<ol>` with an accessible name; the active step carries `aria-current="step"`.
- Completion is carried as visually-hidden text beside the tick, never by its colour alone.
- A `forced-colors` block keeps the three marker states distinguishable.

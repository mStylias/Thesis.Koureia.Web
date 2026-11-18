import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal, model, output } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideCheck } from '@lucide/angular';

import { RenderedStep, StepperOrientation, StepperStep, StepperStepState } from './stepper.types';

/**
 * A linear progress indicator for a multi-step flow.
 *
 * ```ts
 * import { Stepper } from '@ui/stepper';
 * ```
 *
 * ```html
 * <lib-stepper
 *   [steps]="steps()"
 *   [(activeStep)]="step"
 *   [completedSteps]="done()"
 *   (stepSelected)="onStepSelected($event)"
 * >
 *   <!-- the active step's body, owned by the caller -->
 * </lib-stepper>
 * ```
 *
 * It is presentational: it renders the list and reports activations. It does not
 * decide what "complete" means, does not hold the flow's data, and projects the
 * active step's body rather than owning it.
 *
 * **Only a completed step is activatable.** An upcoming step is inert markup and
 * cannot take focus, so a keyboard user never lands on a step the flow is not
 * ready for. A step marked `locked` renders as done and is also inert — for a
 * choice the flow made before the stepper appeared.
 *
 * **Every step is named at every width.** On a narrow screen the label sits above
 * its marker instead of beside it, and a compact header above the rail carries the
 * position and the progress. A step's `summary` is the wide presentation only —
 * the narrow columns have no room for a second line.
 */
@Component({
  selector: 'lib-stepper',
  imports: [LucideCheck, NgTemplateOutlet, TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'stepper',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './stepper.html',
  styleUrl: './stepper.scss',
  host: {
    '[attr.data-orientation]': 'orientation()',
  },
})
export class Stepper {
  /** The steps, in the order they are walked. */
  readonly steps = input.required<readonly StepperStep[]>();

  /** The step showing now, as its `id`. Two-way, so an activation writes back. */
  readonly activeStep = model.required<string>();

  /** The ids the flow considers done. Order does not matter. */
  readonly completedSteps = input<readonly string[]>([]);

  /**
   * `horizontal` lays the steps in a row, `vertical` in a column. The narrow-screen
   * presentation is the same either way, so a caller that wants one per breakpoint
   * switches this itself.
   */
  readonly orientation = input<StepperOrientation>('horizontal');

  /** Names the list for assistive technology. Falls back to a translated default. */
  readonly ariaLabel = input('');

  /** A completed step's header was activated. Carries its `id`. */
  readonly stepSelected = output<string>();

  protected readonly activeIndex = computed(() => {
    const index = this.steps().findIndex((step) => step.id === this.activeStep());
    return index === -1 ? 0 : index;
  });

  /**
   * Fills to the end of the active step, so the last step reads as finished.
   *
   * A scale factor rather than a width: the bar is a direct answer to a press, and a
   * transition on `inline-size` lays the row out again on every frame.
   */
  protected readonly progressScale = computed(() => {
    const total = this.steps().length;
    return total === 0 ? 0 : (this.activeIndex() + 1) / total;
  });

  /**
   * The ids that became done in the last change, so only their ticks animate.
   *
   * A step that turns from `completed` to `locked` swaps its button for a plain header, which
   * builds a new tick. Keyed on the id, that tick arrives still. Empty on the first paint too,
   * so a flow resumed three steps in does not pop every tick it arrived with.
   */
  private readonly newlyDone = linkedSignal<readonly RenderedStep[], ReadonlySet<string>>({
    source: () => this.orderedSteps(),
    computation: (steps, previous) => {
      if (previous === undefined) return new Set();
      const before = new Set(previous.source.filter(isDone).map((step) => step.id));
      return new Set(
        steps.filter((step) => isDone(step) && !before.has(step.id)).map((step) => step.id),
      );
    },
  });

  protected tickEnter(id: string): string {
    return this.newlyDone().has(id) ? 'stepper__tick--in' : '';
  }

  protected readonly orderedSteps = computed<readonly RenderedStep[]>(() => {
    const active = this.activeStep();
    const completed = new Set(this.completedSteps());

    return this.steps().map((step, index) => {
      const state = resolveState(step, active, completed);
      return {
        id: step.id,
        label: step.label,
        summary: step.summary,
        position: index + 1,
        state,
        activatable: state === 'completed',
      };
    });
  });

  protected select(id: string): void {
    // Re-checked here rather than trusted from the template: the list can change
    // between the render that drew the button and the click that reaches it.
    const step = this.orderedSteps().find((candidate) => candidate.id === id);
    if (!step?.activatable) return;

    this.activeStep.set(id);
    this.stepSelected.emit(id);
  }
}

function isDone(step: RenderedStep): boolean {
  return step.state === 'completed' || step.state === 'locked';
}

function resolveState(
  step: StepperStep,
  active: string,
  completed: ReadonlySet<string>,
): StepperStepState {
  if (step.locked === true) return 'locked';
  if (step.id === active) return 'active';
  return completed.has(step.id) ? 'completed' : 'upcoming';
}

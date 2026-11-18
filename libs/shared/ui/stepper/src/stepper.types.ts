/** Which way the step list runs. The responsive choice is the caller's. */
export type StepperOrientation = 'horizontal' | 'vertical';

/** One step in the list. */
export interface StepperStep {
  /** Stable across renders. What `activeStep` and `completedSteps` name. */
  readonly id: string;
  readonly label: string;
  /**
   * The choice made in this step, shown under the label. Omit it when another
   * surface already carries the choices — showing them twice on one screen is
   * worse than showing them once.
   */
  readonly summary?: string;
  /**
   * Complete, and never activatable. For a step the flow decided before the
   * stepper appeared. A locked step renders as done and is not a button, so it
   * never looks clickable and does nothing.
   */
  readonly locked?: boolean;
}

/** What a step renders as. Drives both the markup and `data-state`. */
export type StepperStepState = 'active' | 'completed' | 'locked' | 'upcoming';

/** One step with everything the template needs already resolved. Internal to the component. */
export interface RenderedStep {
  readonly id: string;
  readonly label: string;
  readonly summary?: string;
  readonly position: number;
  readonly state: StepperStepState;
  readonly activatable: boolean;
}

import { afterNextRender, type ElementRef, type Injector } from '@angular/core';
import type {
  FormFieldState,
  UserProfileFormService,
} from '@keycloakify/angular/login/services/user-profile-form';

/**
 * Makes every profile field show what is wrong with it, then focuses the first offender.
 *
 * A refused submit is silent otherwise: the fields hold their errors back until the person has
 * been given a chance to type, and by then the button has already been pressed. Both pages that
 * render the user profile call this from their submit handler.
 */
export function revealProfileErrors(params: {
  userProfile: UserProfileFormService;
  fields: readonly FormFieldState[];
  form: ElementRef<HTMLFormElement>;
  injector: Injector;
}): void {
  for (const field of params.fields) {
    params.userProfile.dispatchFormAction({
      action: 'update',
      name: field.attribute.name,
      valueOrValues: field.valueOrValues,
      displayErrorsImmediately: true,
    });
  }

  /*
   * `afterNextRender` and not `requestAnimationFrame`: the dispatches above are what *cause*
   * `aria-invalid` to be written, and the app is zoneless — a frame callback can run before
   * Angular has rendered, and then this query finds nothing and focus silently stays put.
   * This waits for the render those dispatches scheduled.
   */
  afterNextRender(
    () => {
      params.form.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    },
    { injector: params.injector },
  );
}

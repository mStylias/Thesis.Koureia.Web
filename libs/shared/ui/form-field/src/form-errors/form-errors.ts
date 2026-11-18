import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import type { FormMessage } from '@util/forms';
import { FORM_FIELD_TRANSLOCO_SCOPE } from '../form-field.i18n';
import { FormHost } from '../form-host/form-host';

/**
 * What a refused write said that no field owns.
 *
 * ```html
 * <form [libForm]="editor">
 *   <lib-form-errors />
 *   …
 * </form>
 * ```
 *
 * It reads the enclosing `libForm`, so a form declares the area once and never wires it. The
 * messages survive a keystroke on purpose: the editor keeps them until the next commit, because a
 * failure about the whole submission is not answered by editing one field.
 */
@Component({
  selector: 'lib-form-errors',
  imports: [TranslocoPipe, UiCopyPipe],
  templateUrl: './form-errors.html',
  styleUrl: './form-errors.scss',
  providers: [FORM_FIELD_TRANSLOCO_SCOPE],
  host: {
    // An empty host is still a box, and in a grid it is still a row. `hidden` removes it, and
    // takes it out of the accessibility tree with it.
    '[hidden]': 'messages().length === 0',
  },
})
export class FormErrors {
  /** Messages to show instead of the enclosing form's, for a caller that keeps its own. */
  readonly errors = input<readonly FormMessage[] | undefined>(undefined);

  private readonly host = inject<FormHost | null>(FormHost, { optional: true });

  protected readonly messages = computed(
    () => this.errors() ?? this.host?.editor().generalErrors() ?? [],
  );
}

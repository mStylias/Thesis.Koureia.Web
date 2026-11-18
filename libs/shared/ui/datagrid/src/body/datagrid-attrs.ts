import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Writes a map of attributes onto the host element.
 *
 * A template can bind one class list and one style object, but there is no
 * binding for a map of attributes — and the ARIA a `Decoration` contributes is
 * exactly that. Attributes a later map drops are removed, so a decoration that
 * stops describing a state stops saying so.
 */
@Directive({ selector: '[libDatagridAttrs]' })
export class DatagridAttrs {
  readonly libDatagridAttrs = input<Readonly<Record<string, string>> | null>(null);

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private applied: readonly string[] = [];

  constructor() {
    effect(() => {
      const next = this.libDatagridAttrs() ?? {};
      const element = this.hostRef.nativeElement;
      for (const name of this.applied) {
        if (!(name in next)) {
          element.removeAttribute(name);
        }
      }
      for (const [name, value] of Object.entries(next)) {
        element.setAttribute(name, value);
      }
      this.applied = Object.keys(next);
    });
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideScissors } from '@lucide/angular';

/**
 * One shop's pin on the map.
 *
 * A component and not a hand-built element, because MapLibre moves the node into its own
 * container: a component created with `createComponent` carries its emulated-encapsulation
 * attribute with it, so these styles keep working there and re-theme like everything else. A
 * `circle` layer could not — its paint is JSON, and every color would have to be read out of
 * `getComputedStyle` and rewritten whenever the theme flips.
 *
 * The pin is a real `<button>`, so it is reachable and operable from the keyboard.
 */
@Component({
  selector: 'lib-barbershop-marker',
  imports: [LucideScissors],
  template: `
    <button
      type="button"
      class="marker"
      [class.marker--selected]="selected()"
      [attr.aria-label]="name()"
      [attr.aria-pressed]="selected()"
      (click)="onActivate($event)"
    >
      <svg lucideScissors aria-hidden="true"></svg>
    </button>
  `,
  styleUrl: './barbershop-marker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopMarker {
  readonly name = input('');

  readonly selected = input(false);

  readonly activate = output();

  /**
   * A marker sits inside MapLibre's own canvas container, so a click on it bubbles to the map
   * and raises a map `click`. Left alone, the popup's `closeOnClick` would shut the popup this
   * very click is opening.
   */
  protected onActivate(event: MouseEvent): void {
    event.stopPropagation();
    this.activate.emit();
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The point the list is ordered from.
 *
 * Not a button. It is a reference point, not a place to book, and a second interactive pin
 * competing with the shops would suggest otherwise. The label is carried in the open rather
 * than behind a hover, because there is only ever one of these on the map.
 *
 * A component and not a hand-built element for the reason {@link BarbershopMarker} gives:
 * MapLibre moves the node into its own container, and only a component takes its emulated
 * encapsulation attribute with it.
 */
@Component({
  selector: 'lib-origin-marker',
  template: `
    <span class="origin">
      <span class="origin__dot" aria-hidden="true"></span>
      <span class="origin__label">{{ label() }}</span>
    </span>
  `,
  styleUrl: './origin-marker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OriginMarker {
  /** The chosen place's name, or what to call the device's own position. */
  readonly label = input('');
}

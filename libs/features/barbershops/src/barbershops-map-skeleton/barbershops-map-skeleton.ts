import { booleanAttribute, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'lib-barbershops-map-skeleton',
  imports: [TranslocoPipe],
  template: `
    <div class="map-skeleton__badge" [class.map-skeleton__badge--enter]="entrance()">
      <span class="map-skeleton__pin" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      {{ 'barbershops.map.loading' | transloco }}
    </div>

    <div class="map-skeleton__controls" aria-hidden="true">
      <span>+</span>
      <span>−</span>
    </div>
  `,
  styleUrl: './barbershops-map-skeleton.scss',
  host: { role: 'status' },
})
export class BarbershopsMapSkeleton {
  /**
   * The skeleton is rendered twice in a row (defer placeholder, then inside
   * the map component); only the first instance should play the entrance.
   */
  readonly entrance = input(true, { transform: booleanAttribute });
}

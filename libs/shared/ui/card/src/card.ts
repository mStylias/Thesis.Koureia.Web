import { Component, input } from '@angular/core';

export type CardAppearance = 'outlined' | 'elevated';

/**
 * Design-system card frame. Apply it to the semantic container that
 * best describes the content, usually an `<article>` for a standalone result.
 *
 * The card is deliberately presentational: it adds no role, focusability, or
 * activation behavior. Put navigation on a real anchor and actions on native
 * buttons inside the card.
 *
 * ```html
 * <article libCard>
 *   <div libCardBody>
 *     <h2 libCardTitle>Barbershop name</h2>
 *     <div libCardContent>Address and services</div>
 *   </div>
 * </article>
 * ```
 */

@Component({
  // A card decorates the consumer's semantic container rather than adding a
  // wrapper element of its own.
  selector: '[libCard]',
  template: '<ng-content />',
  styleUrl: './card.scss',
  host: {
    class: 'card',
    '[attr.data-appearance]': 'appearance()',
  },
})
export class Card {
  /** Surface treatment. Outlined is the quieter default for result lists. */
  readonly appearance = input<CardAppearance>('outlined');
}

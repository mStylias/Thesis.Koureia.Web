import { Component, computed, input, numberAttribute, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { Card, CardBody, CardHeader, CardSubtitle, CardTitle } from '@ui/card';

import { trackPageLoading } from './page-loading';
import type { PageSectionState } from './page-section.types';

/**
 * The frame of one card on a management page of cards: the heading, an optional hint, the actions
 * slot, and the card's own loading and failure states.
 *
 * ```html
 * <lib-page-section sectionId="profile" [heading]="…" [state]="state()" (retry)="retry()">
 *   <button libButton libPageSectionActions>…</button>
 *   …content…
 * </lib-page-section>
 * ```
 *
 * The host carries `sectionId` as its `id`, so `/management/<page>#<sectionId>` scrolls to it. The
 * page loads this lib's dictionary with `loadPageSectionsDictionaries`.
 */
@Component({
  selector: 'lib-page-section',
  imports: [Button, Card, CardBody, CardHeader, CardSubtitle, CardTitle, TranslocoPipe],
  templateUrl: './page-section.html',
  styleUrl: './page-section.scss',
  host: { '[attr.id]': 'sectionId()' },
})
export class PageSection {
  /** The fragment that opens the page at this card. Also the base of the heading id. */
  readonly sectionId = input.required<string>();

  /** The card's heading, already translated. */
  readonly heading = input.required<string>();

  /** One line under the heading, already translated. */
  readonly hint = input('');

  /** Ids of text that describes the whole card. */
  readonly describedBy = input('');

  readonly state = input<PageSectionState>('ready');

  /** Rows in the loading skeleton. Match the loaded card, so the page does not jump. */
  readonly skeletonRows = input(3, { transform: numberAttribute });

  /** The person asked to load the card again. */
  readonly retry = output();

  protected readonly titleId = computed(() => `${this.sectionId()}-title`);

  protected readonly rows = computed(() =>
    Array.from({ length: Math.max(1, Math.floor(this.skeletonRows()) || 1) }, (_, i) => i),
  );

  constructor() {
    trackPageLoading(computed(() => this.state() === 'loading'));
  }
}

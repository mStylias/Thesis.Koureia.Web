import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActiveLanguage } from '@util/language';

import type {
  CompanyServiceCategoryViewDto,
  CompanyServiceViewDto,
} from '../../data/barbershops.api.types';
import { formatDuration } from '../format/format-duration';
import { formatPrice } from '../format/format-price';
import type { ServiceGroup, ServiceItem } from './barbershop-services.types';

/**
 * Every service a shop offers, with its base price and duration.
 *
 * Grouped under one heading per category, in the order the API sends, with the uncategorized
 * services last. When no service has a category the headings would say nothing, so the list is
 * flat. Services are not links: booking one is the booking page's job.
 */
@Component({
  selector: 'lib-barbershop-services',
  imports: [TranslocoPipe],
  templateUrl: './barbershop-services.html',
  styleUrl: './barbershop-services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopServices {
  private readonly language = inject(ActiveLanguage).value;

  readonly categories = input.required<readonly CompanyServiceCategoryViewDto[]>();
  readonly uncategorized = input.required<readonly CompanyServiceViewDto[]>();
  /** ISO 4217. Every price is in it. */
  readonly currency = input.required<string>();

  /** Whether the list carries category headings at all. */
  protected readonly grouped = computed(() => this.categories().length > 0);

  /**
   * The groups to render. The uncategorized group has no name: the template gives it the
   * translated "other services" heading, or none at all in a flat list.
   */
  protected readonly groups = computed<readonly ServiceGroup[]>(() => {
    const groups: ServiceGroup[] = this.categories().map((category) => ({
      id: category.id,
      name: category.name,
      services: category.services.map((service) => this.toItem(service)),
    }));

    const rest = this.uncategorized();
    if (rest.length > 0) {
      groups.push({ id: null, name: null, services: rest.map((service) => this.toItem(service)) });
    }
    return groups;
  });

  private toItem(service: CompanyServiceViewDto): ServiceItem {
    const language = this.language();
    return {
      id: service.id,
      name: service.name,
      price: formatPrice(service.price, this.currency(), language),
      duration: formatDuration(service.durationMinutes, language),
    };
  }
}

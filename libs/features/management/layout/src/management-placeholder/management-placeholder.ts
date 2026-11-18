import { Component } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';

import { managementTranslocoScope } from '../management.i18n';

/**
 * Stands in for every management page until each one is built. It carries no heading of its
 * own: the top bar already names the page.
 */
@Component({
  selector: 'lib-management-placeholder',
  imports: [TranslocoPipe],
  template: `
    <p class="placeholder-title">{{ 'management.placeholder.title' | transloco }}</p>
    <p class="placeholder-lead">{{ 'management.placeholder.lead' | transloco }}</p>
  `,
  styleUrl: './management-placeholder.scss',
  providers: [provideTranslocoScope(managementTranslocoScope)],
})
export class ManagementPlaceholder {}

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  PlatformCompaniesApi,
  StaffAccessStore,
  WorkspaceCompanyChoice,
  type CompanyODataResponse,
} from '@auth/data-access';
import { odataSource } from '@data/odata-source';
import { Select, SelectOptionTemplate } from '@ui/select';

import { MANAGEMENT_BASE_PATH } from '../management-pages';

/**
 * The superadmin's shop picker in the management top bar. The shell shows it to a superadmin
 * only. The API ignores the pick from anyone else.
 *
 * A pick stores the shop, reads the workspace again and opens the home page. Page stores key
 * their resources on the workspace's shop, so each page reads the new shop.
 */
@Component({
  selector: 'lib-workspace-shop-picker',
  imports: [Select, SelectOptionTemplate, TranslocoPipe],
  templateUrl: './workspace-shop-picker.html',
  styleUrl: './workspace-shop-picker.scss',
})
export class WorkspaceShopPicker {
  private readonly api = inject(PlatformCompaniesApi);
  private readonly access = inject(StaffAccessStore);
  private readonly choice = inject(WorkspaceCompanyChoice);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Rebuilt per language, because the endpoint names each shop in the language it is asked for. */
  protected readonly source = computed(() => {
    const language = this.language();
    return odataSource<CompanyODataResponse>({
      fetch: (query) =>
        this.api.companies({ ...query, orderBy: query.orderBy ?? 'name' }, language),
      key: { selector: 'id', type: 'uuid' },
      searchFields: ['name'],
    });
  });

  /** The shop the API resolved, not the stored pick. The two differ while a pick is read. */
  protected readonly value = computed(() => this.access.company()?.id);

  protected readonly needsShop = computed(() => this.access.company() === null);

  protected readonly switching = signal(false);

  protected readonly shopName = (company: CompanyODataResponse): string => company.name;

  protected isInactive(item: unknown): boolean {
    return (
      typeof item === 'object' &&
      item !== null &&
      (item as Partial<CompanyODataResponse>).isActive === false
    );
  }

  protected async pick(companyId: unknown): Promise<void> {
    if (typeof companyId !== 'string' || companyId === this.value()) return;

    this.switching.set(true);
    try {
      this.choice.set(companyId);
      await this.access.reload();
      await this.router.navigateByUrl(MANAGEMENT_BASE_PATH);
    } finally {
      this.switching.set(false);
    }
  }
}

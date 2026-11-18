import { Component, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';
import type { ServiceODataResponse } from '@api/services';
import { StaffAccessStore } from '@auth/data-access';
import {
  Datagrid,
  filterBuilder,
  filterRow,
  gridViews,
  headerFilters,
  type ColumnDef,
  type DataConfig,
  type DatagridFeature,
  type GridConfig,
  type ToolbarConfig,
  type ToolbarItem,
} from '@ui/datagrid';

import { NEW_SERVICE } from '../details/service-details.constants';
import { serviceColumns } from '../services.columns';
import { servicesTranslocoScope } from '../services.i18n';
import { ServicesStore } from '../services.store';

/**
 * The shop's services, as a grid the endpoint filters, sorts and pages. The name opens the
 * service in the drawer, a child route that draws over this page.
 */
@Component({
  selector: 'lib-services-page',
  imports: [Datagrid, RouterOutlet, TranslocoPipe],
  template: `
    <lib-datagrid
      #grid
      class="services-grid"
      [columns]="columns()"
      [data]="data"
      fitColumns="true"
      view="auto"
      key="id"
      pagingMode="pager"
      [pageSize]="25"
      [pageSizes]="pageSizes"
      [showRowNumbers]="true"
      [toolbar]="toolbar()"
      [features]="features"
      [config]="config()"
      [ariaLabel]="'managementServices.gridLabel' | transloco"
      (primaryCellActivated)="openService($event.row)"
    />

    <router-outlet />
  `,
  styleUrl: './services-list.scss',
  providers: [provideTranslocoScope(servicesTranslocoScope), ServicesStore],
})
export class ServicesList {
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ServicesStore);
  private readonly access = inject(StaffAccessStore);
  private readonly grid = viewChild.required<Datagrid<ServiceODataResponse>>('grid');

  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Held, not written inline: a fresh array would rebuild the selector under the pointer. */
  protected readonly pageSizes: readonly number[] = [10, 25, 50, 100];

  /** Held: a fresh object per change detection would restart the load. */
  protected readonly data: DataConfig<ServiceODataResponse> = {
    remote: true,
    source: this.store.services,
  };

  protected readonly features: readonly DatagridFeature[] = [
    filterRow(),
    headerFilters({ pageSize: 20 }),
    filterBuilder(),
    gridViews({ key: 'services_main_grid' }),
  ];

  protected readonly config = computed<Partial<GridConfig<ServiceODataResponse>>>(() => ({
    export: { formats: ['xlsx', 'pdf', 'csv'], fileName: 'services' },
    locale: { language: this.transloco.getActiveLang() },
  }));

  /** Rebuilt per language and when the options land: captions and filter lists come from them. */
  protected readonly columns = computed<readonly ColumnDef<ServiceODataResponse>[]>(() =>
    serviceColumns({
      translate: (key, params) => this.transloco.translate(key, params),
      language: this.transloco.getActiveLang(),
      currency: this.store.currency(),
      categories: this.store.categories(),
      barbers: this.store.barbers,
    }),
  );

  protected readonly toolbar = computed<ToolbarConfig>(() => {
    this.transloco.getActiveLang();

    const add: readonly ToolbarItem[] = this.access.has('services:create')
      ? [
          {
            id: 'add',
            location: 'end',
            label: this.transloco.translate('managementServices.add'),
            icon: LucidePlus,
            variant: 'primary',
            iconOnly: false,
            onClick: () => {
              void this.router.navigate([NEW_SERVICE], { relativeTo: this.route });
            },
          },
        ]
      : [];

    return {
      iconOnly: true,
      items: [
        ...add,
        { name: 'sortMenu', location: 'end' },
        { name: 'filterBuilder', location: 'end' },
        {
          id: 'refresh',
          location: 'end',
          label: this.transloco.translate('managementServices.refresh'),
          icon: LucideRefreshCw,
          busy: 'reload',
          onClick: () => {
            this.store.reload();
          },
        },
        { name: 'resetArrangement', location: 'end' },
        { name: 'clearSelection', location: 'end' },
        { name: 'columnChooser', location: 'end' },
        { name: 'export', location: 'end' },
      ],
    };
  });

  constructor() {
    // Beside the grid's first load. Until they land, the Category and Barbers lists are empty.
    void this.store.loadOptions();

    // A write in the drawer, or a refresh. The first revision is the grid's own first load.
    effect(() => {
      if (this.store.revision() > 0) {
        this.grid().reload();
      }
    });

    // A superadmin's shop change keeps this page, and the options name categories in the page
    // language, so both changes read the options and the rows again.
    let seen: string | undefined;
    effect(() => {
      const current = `${this.access.company()?.id ?? ''}|${this.language()}`;
      if (seen !== undefined && current !== seen) {
        untracked(() => {
          void this.store.loadOptions().then(() => {
            this.store.reload();
          });
        });
      }
      seen = current;
    });
  }

  /** Opens one service. The primary cell, not the row, so a click elsewhere can select. */
  protected openService(service: ServiceODataResponse): void {
    void this.router.navigate([service.id], { relativeTo: this.route });
  }
}

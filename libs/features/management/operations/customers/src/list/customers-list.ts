import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideRefreshCw } from '@lucide/angular';
import type { CustomerODataResponse } from '@api/customers';
import { StaffAccessStore } from '@auth/data-access';
import { APPOINTMENT_PANEL_HOST } from '@features/management-shared-appointments';
import {
  Datagrid,
  filterBuilder,
  filterRow,
  gridViews,
  headerFilters,
  type ColumnDef,
  type DataConfig,
  type DatagridFeature,
  type Decoration,
  type GridConfig,
  type ToolbarConfig,
  type ToolbarItem,
} from '@ui/datagrid';
import { provideUiCopy } from '@util/ui-copy';

import { COLUMN, NO_SHOW_WARNING, customerColumns } from '../customers.columns';
import { customersTranslocoScope } from '../customers.i18n';
import { CustomersStore } from '../customers.store';
import { customersPanelHost } from './customers-panel-host';
import { NotBackFilter, readNotBack, writeNotBack } from './not-back-filter';
import type { NotBackDays } from './not-back-filter.types';

/** The warning tone of a no-show count. Inline, since the cell is the grid's DOM. */
const NO_SHOW_DECORATION: Decoration = {
  styles: { color: 'var(--warning-text)', 'font-weight': 'var(--weight-bold)' },
};

/**
 * The shop's customers, as a grid the endpoint filters, sorts and pages. The name opens the
 * customer in the drawer, a child route that draws over this page. An appointment of the customer
 * opens in the same place, so the page provides the appointment drawer's host.
 *
 * A customer appears with their first appointment, so there is no create button.
 */
@Component({
  selector: 'lib-customers-page',
  imports: [Datagrid, NotBackFilter, RouterOutlet, TranslocoPipe],
  template: `
    <lib-datagrid
      #grid
      class="customers-grid"
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
      [ariaLabel]="'managementCustomers.gridLabel' | transloco"
      (primaryCellActivated)="openCustomer($event.row)"
      (stateChanged)="readQuickFilter()"
    />

    <ng-template #notBack>
      <lib-customers-not-back-filter
        [value]="notBackDays()"
        [language]="language()"
        (choose)="setNotBack($event)"
      />
    </ng-template>

    <router-outlet />
  `,
  styleUrl: './customers-list.scss',
  providers: [
    provideTranslocoScope(customersTranslocoScope),
    provideUiCopy({ 'datagrid.search.placeholder': 'managementCustomers.searchPlaceholder' }),
    CustomersStore,
    { provide: APPOINTMENT_PANEL_HOST, useFactory: customersPanelHost },
  ],
})
export class CustomersList {
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(CustomersStore);
  private readonly access = inject(StaffAccessStore);
  private readonly grid = viewChild.required<Datagrid<CustomerODataResponse>>('grid');
  private readonly notBackTemplate = viewChild.required<TemplateRef<unknown>>('notBack');

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Held, not written inline: a fresh array would rebuild the selector under the pointer. */
  protected readonly pageSizes: readonly number[] = [10, 25, 50, 100];

  /** Held: a fresh object per change detection would restart the load. */
  protected readonly data: DataConfig<CustomerODataResponse> = {
    remote: true,
    source: this.store.customers,
  };

  protected readonly features: readonly DatagridFeature[] = [
    filterRow(),
    headerFilters({ pageSize: 20 }),
    filterBuilder(),
    gridViews({ key: 'customers_main_grid' }),
  ];

  /** The quick filter's choice, read back from the grid's filters after every change. */
  protected readonly notBackDays = signal<NotBackDays | null>(null);

  private readonly canExport = computed(() => this.access.has('customers:export'));

  /** The shop's zone and the page's language, so a date is not written in the browser's. */
  protected readonly config = computed<Partial<GridConfig<CustomerODataResponse>>>(() => ({
    ...(this.canExport()
      ? { export: { formats: ['xlsx', 'pdf', 'csv'], fileName: 'customers' } }
      : {}),
    locale: { timezone: this.store.timezone(), language: this.language() },
    decorateCell: (row, columnId) =>
      columnId === COLUMN.noShows && row.noShowCount >= NO_SHOW_WARNING ? NO_SHOW_DECORATION : null,
  }));

  /** Rebuilt per language and per right: captions are translated here, spend needs a right. */
  protected readonly columns = computed<readonly ColumnDef<CustomerODataResponse>[]>(() =>
    customerColumns({
      translate: (key, params) => this.transloco.translate(key, params),
      language: this.language(),
      timezone: this.store.timezone(),
      staff: this.store.staff(),
      canSeeSpend: this.store.canSeeSpend(),
    }),
  );

  protected readonly toolbar = computed<ToolbarConfig>(() => {
    this.language();

    // The search and the quick filter do not fit beside each other on a phone, so the cards
    // leave both out.
    const notBack: ToolbarItem = {
      id: 'notBack',
      location: 'start',
      overflow: 'never',
      hideInCards: true,
      renderer: this.notBackTemplate(),
    };

    return {
      iconOnly: true,
      items: [
        { name: 'search', hideInCards: true },
        notBack,
        { name: 'sortMenu', location: 'end' },
        { name: 'filterBuilder', location: 'end' },
        {
          id: 'refresh',
          location: 'end',
          label: this.transloco.translate('managementCustomers.refresh'),
          icon: LucideRefreshCw,
          busy: 'reload',
          onClick: () => {
            this.store.reload();
          },
        },
        { name: 'resetArrangement', location: 'end' },
        { name: 'clearSelection', location: 'end' },
        { name: 'columnChooser', location: 'end' },
        ...(this.canExport() ? [{ name: 'export', location: 'end' } as const] : []),
      ],
    };
  });

  constructor() {
    // A write in the drawer, or a refresh. The first revision is the grid's own first load.
    effect(() => {
      if (this.store.revision() > 0) {
        this.grid().reload();
      }
    });

    // A superadmin's shop change keeps this page, so the rows are read again.
    let shop: string | null | undefined;
    effect(() => {
      const current = this.access.company()?.id ?? null;
      if (shop !== undefined && current !== shop) {
        untracked(() => {
          this.store.reload();
        });
      }
      shop = current;
    });
  }

  /** Opens one customer. The primary cell, not the row, so a click elsewhere can select. */
  protected openCustomer(customer: CustomerODataResponse): void {
    void this.router.navigate([customer.id], { relativeTo: this.route });
  }

  protected readQuickFilter(): void {
    this.notBackDays.set(readNotBack(this.grid().api()));
  }

  protected setNotBack(days: NotBackDays | null): void {
    writeNotBack(this.grid().api(), days);
    this.readQuickFilter();
  }
}

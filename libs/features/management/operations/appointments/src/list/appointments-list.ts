import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';
import { skip } from 'rxjs';
import type { AppointmentODataResponse } from '@api/appointments';
import { StaffAccessStore } from '@auth/data-access';
import {
  APPOINTMENT_PANEL_HOST,
  CUSTOMER_PARAM,
  appointmentsTranslocoScope,
} from '@features/management-shared-appointments';
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
  type GridTemporaryView,
  type ToolbarConfig,
} from '@ui/datagrid';

import { appointmentColumns } from '../appointments.columns';
import { appointmentsGridTranslocoScope } from '../appointments.i18n';
import { AppointmentsStore } from '../appointments.store';
import { customerViewState } from '../customer-view';
import { appointmentsPanelHost } from './appointments-panel-host';

/** The id of the one temporary view this page opens. A new customer replaces it. */
const CUSTOMER_VIEW_ID = 'customer';

/**
 * The shop's appointments, as a grid the endpoint filters, sorts and pages.
 *
 * The page opens on the upcoming appointments: Date & time carries "from today" as an initial
 * filter, in the filter row where the reader can change it, and Reset returns to it.
 *
 * `?customer=<id>` opens a temporary view on that customer instead, built before the first
 * query, so the grid queries once. See `customerView`.
 */
@Component({
  selector: 'lib-appointments-page',
  imports: [Datagrid, RouterOutlet, TranslocoPipe],
  template: `
    <lib-datagrid
      #grid
      class="appointments-grid"
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
      [ariaLabel]="'managementAppointmentsGrid.gridLabel' | transloco"
      (primaryCellActivated)="openAppointment($event.row)"
    />

    <!-- The drawer, a route of its own that draws over this page. -->
    <router-outlet />
  `,
  styleUrl: './appointments-list.scss',
  providers: [
    provideTranslocoScope(appointmentsGridTranslocoScope, appointmentsTranslocoScope),
    AppointmentsStore,
    { provide: APPOINTMENT_PANEL_HOST, useFactory: appointmentsPanelHost },
  ],
})
export class AppointmentsList {
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(AppointmentsStore);
  private readonly access = inject(StaffAccessStore);
  private readonly grid = viewChild.required<Datagrid<AppointmentODataResponse>>('grid');

  /** Set on destroy, so a name that arrives after the page left opens nothing. */
  private leaving = false;

  /** Held, not written inline: a fresh array would rebuild the selector under the pointer. */
  protected readonly pageSizes: readonly number[] = [10, 25, 50, 100];

  /** Held: a fresh object per change detection would restart the load. */
  protected readonly data: DataConfig<AppointmentODataResponse> = {
    remote: true,
    source: this.store.appointments,
  };

  /**
   * The customer view the first load opens, read once from the address. The name request starts
   * here and runs beside the stored views, which the first query waits for anyway.
   */
  private readonly initialCustomer = this.readCustomer();

  /**
   * Header filters for the columns that name a record, the filter row for the rest, the
   * expression editor behind the toolbar, and views. A column says which of the two filters it
   * takes through `allow`.
   *
   * `temporary` is read by the load the first query waits for, so a `?customer=` arrival
   * queries once, in the customer's view, and the stored default is never applied on the way.
   */
  protected readonly features: readonly DatagridFeature[] = [
    filterRow(),
    headerFilters({ pageSize: 20 }),
    filterBuilder(),
    gridViews({
      key: 'appointments_main_grid',
      temporary: () => {
        const customer = this.initialCustomer;
        return customer === null
          ? null
          : customer.name.then((name) => this.customerView(customer.id, name));
      },
    }),
  ];

  /**
   * The shop's zone, so every date shows and every "today" counts in shop time, and the page's
   * language, so a price or a date is not formatted in the browser's.
   */
  protected readonly config = computed<Partial<GridConfig<AppointmentODataResponse>>>(() => ({
    export: { formats: ['xlsx', 'pdf', 'csv'], fileName: 'appointments' },
    locale: { timezone: this.store.timezone(), language: this.transloco.getActiveLang() },
  }));

  /** Rebuilt per language: captions and the header-filter labels are translated here. */
  protected readonly columns = computed<readonly ColumnDef<AppointmentODataResponse>[]>(() => {
    const language = this.transloco.getActiveLang();
    return appointmentColumns({
      translate: (key, params) => this.transloco.translate(key, params),
      language,
      timezone: this.store.timezone(),
      store: this.store,
    });
  });

  protected readonly toolbar = computed<ToolbarConfig>(() => {
    this.transloco.getActiveLang();

    return {
      iconOnly: true,
      items: [
        {
          id: 'add',
          location: 'end',
          label: this.transloco.translate('managementAppointmentsGrid.add'),
          icon: LucidePlus,
          variant: 'primary',
          iconOnly: false,
          onClick: () => {
            void this.router.navigate(['new'], {
              relativeTo: this.route,
              queryParams: this.createParams(),
            });
          },
        },
        { name: 'sortMenu', location: 'end' },
        { name: 'filterBuilder', location: 'end' },
        {
          id: 'refresh',
          location: 'end',
          label: this.transloco.translate('managementAppointmentsGrid.refresh'),
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
    // Beside the grid's first load, not ahead of it. Until they land, dates count in the
    // browser's zone, and a shop zone that differs re-runs the query.
    void this.store.loadOptions();

    // A write in the drawer, or a refresh. The first revision is the grid's own first load.
    effect(() => {
      if (this.store.revision() > 0) {
        this.grid().reload();
      }
    });

    // A superadmin's shop change keeps this page, so the options and the rows are read again.
    let shop: string | null | undefined;
    effect(() => {
      const current = this.access.company()?.id ?? null;
      if (shop !== undefined && current !== shop) {
        untracked(() => {
          void this.store.loadOptions().then(() => {
            this.store.reload();
          });
        });
      }
      shop = current;
    });

    // "View all" from a drawer over this page: the address changes and the page stays. The
    // first emission is the arrival, which the first load already handled.
    this.route.queryParamMap.pipe(skip(1), takeUntilDestroyed()).subscribe((params) => {
      const customerId = params.get(CUSTOMER_PARAM);
      if (customerId !== null && customerId !== '') {
        void this.openCustomer(customerId);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.leaving = true;
    });
  }

  /** Opens one appointment. The primary cell, not the row, so a click elsewhere can select. */
  protected openAppointment(appointment: AppointmentODataResponse): void {
    void this.router.navigate([appointment.id], {
      relativeTo: this.route,
      queryParams: this.pageParams(),
    });
  }

  /** Resolves the name, then opens the view: one apply, so one query. */
  private async openCustomer(customerId: string): Promise<void> {
    const name = await this.store.customerName(customerId);
    if (this.leaving || this.route.snapshot.queryParamMap.get(CUSTOMER_PARAM) !== customerId) {
      return;
    }
    this.grid().api().openTemporaryView(this.customerView(customerId, name));
  }

  /**
   * "This customer's appointments": the customer's header filter, latest first, every other
   * filter cleared. Leaving it takes `?customer=` out of the address, so a reload after that
   * does not bring it back.
   */
  private customerView(customerId: string, name: string | null): GridTemporaryView {
    return {
      id: CUSTOMER_VIEW_ID,
      name: name ?? this.transloco.translate('managementAppointmentsGrid.customerView.loading'),
      description: this.transloco.translate('managementAppointmentsGrid.customerView.description'),
      state: (current) => customerViewState(current, customerId),
      onLeave: () => {
        if (this.route.snapshot.queryParamMap.get(CUSTOMER_PARAM) === customerId) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { [CUSTOMER_PARAM]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      },
    };
  }

  /** The customer the address names, and the request for their name. */
  private readCustomer(): { id: string; name: Promise<string | null> } | null {
    const id = this.route.snapshot.queryParamMap.get(CUSTOMER_PARAM);
    return id === null || id === '' ? null : { id, name: this.store.customerName(id) };
  }

  /** The page's own query, which the drawer's address keeps. */
  private pageParams(): Record<string, string> {
    const customer = this.route.snapshot.queryParamMap.get(CUSTOMER_PARAM);
    return customer === null ? {} : { [CUSTOMER_PARAM]: customer };
  }

  /** A create from the toolbar starts on the barber when the grid shows only one. */
  private createParams(): Record<string, string> {
    const node = this.grid().api().getHeaderFilter('barber');
    const barber =
      node !== null && 'field' in node && node.op === 'eq' && typeof node.value === 'string'
        ? node.value
        : null;
    return { ...this.pageParams(), ...(barber === null ? {} : { barberId: barber }) };
  }
}

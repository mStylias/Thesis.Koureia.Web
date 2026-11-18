import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { StaffAccessStore } from '@auth/data-access';
import { injectErrorMessageResolver } from '@synax/client';
import {
  Datagrid,
  filterBuilder,
  filterRow,
  gridViews,
  numberColumn,
  textColumn,
  type ColumnDef,
  type DataConfig,
  type DatagridFeature,
  type GridConfig,
  type QueryResult,
  type ToolbarConfig,
  type ToolbarItem,
} from '@ui/datagrid';

import { rolesTranslocoScope } from '../roles.i18n';
import { roleLabel } from '../roles.labels';
import { RolesStore } from '../roles.store';
import type { RoleODataResponse } from '../roles.types';

/**
 * The company's roles, as a grid over the whole collection.
 *
 * **Every operation is local.** A seeded role's name is English in the database and translated
 * on the client, so the name a reader filters and sorts by exists nowhere the endpoint can
 * reach. The page fetches the collection whole and the grid runs over it — affordable, because a
 * company has a handful of roles, and the only way the visible text and the queried text can be
 * the same text.
 *
 * `view="auto"` gives the same three columns a card each below the `md`
 * breakpoint. Nothing on this page declares that shape: the primary column
 * heads the card and the rest become labelled fields.
 */
@Component({
  selector: 'lib-roles-page',
  imports: [Datagrid, RouterOutlet, TranslocoPipe],
  template: `
    <lib-datagrid
      #grid
      class="roles-grid"
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
      [config]="config"
      [ariaLabel]="'managementRoles.gridLabel' | transloco"
      (primaryCellActivated)="openRole($event.row)"
    />

    <!-- The details panel, which is a route of its own and draws its own
         drawer over this page. -->
    <router-outlet />
  `,
  styleUrl: './roles-list.scss',
  providers: [provideTranslocoScope(rolesTranslocoScope), RolesStore],
})
export class RolesList {
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(RolesStore);
  private readonly access = inject(StaffAccessStore);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly grid = viewChild.required<Datagrid<RoleODataResponse>>('grid');

  /**
   * The page sizes the footer's selector offers. Held, not written inline: a
   * fresh array per change detection would rebuild the selector's options
   * under the pointer.
   */
  protected readonly pageSizes: readonly number[] = [10, 25, 50, 100];

  /**
   * The whole collection, filtered, sorted and paged here rather than by the endpoint.
   *
   * A seeded role's visible name is the client's — the database holds the English one and no
   * endpoint translates it — so a server-side `$filter` on `name` would search text the reader
   * never saw. `remote: false` moves every operation onto the rows this load returns, which is
   * all of them.
   *
   * Held, not built in the template: the grid takes the object itself, and a fresh one per
   * change detection would restart the load.
   */
  protected readonly data: DataConfig<RoleODataResponse> = {
    remote: false,
    source: { load: () => this.loadRoles() },
  };

  constructor() {
    // A role written in the panel, or a refresh, is a collection this grid has not read. The
    // first revision is the initial state, which the grid's own first load already covers.
    //
    // Nothing here watches the language: it is a route segment, so switching it re-navigates
    // and this page is built again from scratch.
    effect(() => {
      if (this.store.revision() > 0) {
        this.grid().reload();
      }
    });
  }

  /**
   * One load: every role, with the seeded names translated.
   *
   * A failure is **thrown** rather than returned. The grid's own error state and the retry
   * beside it are what report a load that did not arrive, and they read a thrown value.
   */
  private async loadRoles(): Promise<QueryResult<RoleODataResponse>> {
    const result = await firstValueFrom(this.store.roles());
    if (!result.isSuccess) {
      throw new Error(this.errorMessage(result.error));
    }
    return {
      rows: (result.data ?? []).map((role) => ({
        ...role,
        name: roleLabel(this.transloco, role),
        // Dropped for a seeded role: the description is the English of the very label `name` now
        // carries, so keeping it would print the same thing twice in two languages. Dropped here
        // rather than in the cell, so the filter, the sort and the export all agree with it.
        description: role.isSystem ? null : role.description,
      })),
    };
  }

  /**
   * Opens one role beside the list.
   *
   * The primary cell and not the row: `name` is the record's identifier, so the grid makes its
   * cell the thing that opens the record and answers `Enter` over it in one press. A whole-row
   * gesture would take every click in every column with it, selection included.
   */
  protected openRole(role: RoleODataResponse): void {
    void this.router.navigate([role.id], { relativeTo: this.route });
  }

  /**
   * A filter editor under every column header, and the expression editor
   * behind the toolbar's own button rather than a bar of its own.
   *
   * The row applies as the user types, debounced — the grid settles typing for
   * 300ms before the filter reaches the query. `deferred` would hold each edit
   * until `Enter` or a press on an apply affordance instead, and that
   * affordance is a button with nothing around it.
   *
   * Views name the grid, not the screen: `roles_main_grid_views` is the user
   * resource this page's strip reads and writes, and the `_views` half is the
   * library's. The document is fetched before the first data query goes out,
   * because the rows are a consequence of the view.
   */
  protected readonly features: readonly DatagridFeature[] = [
    filterRow(),
    filterBuilder(),
    gridViews({ key: 'roles_main_grid' }),
  ];

  /**
   * The bar, all of it in the end region and read right to left: export,
   * columns, clear selection, reset, refresh, then the one action that adds
   * something.
   *
   * Every item but the first is drawn as its icon alone, with the caption in
   * the tooltip and in the accessible name. `Add role` keeps its caption: it
   * is the one thing on this screen a first-time user must find without
   * hovering anything.
   *
   * Rebuilt per language, because the caption is translated imperatively —
   * the route resolver loads this dictionary before the page renders.
   *
   * `clearSelection` resolves to nothing while the grid selects no rows. It is
   * declared so the bar gains it in place the day selection is turned on.
   *
   * `Add role` shows only to a user with `roles:create`.
   */
  protected readonly toolbar = computed<ToolbarConfig>(() => {
    this.transloco.getActiveLang();

    const add: readonly ToolbarItem[] = this.access.has('roles:create')
      ? [
          {
            id: 'add',
            location: 'end',
            label: this.transloco.translate('managementRoles.add'),
            icon: LucidePlus,
            variant: 'primary',
            iconOnly: false,
            onClick: () => {
              void this.router.navigate(['new'], { relativeTo: this.route });
            },
          },
        ]
      : [];

    return {
      iconOnly: true,
      items: [
        ...add,
        // The card view's only sort affordance: it has no header to sort
        // from. The grid withholds it in the table, where the header does the
        // job, so naming it here costs that presentation nothing.
        { name: 'sortMenu', location: 'end' },
        // The editor's trigger, which would otherwise take a bar of its own.
        // Naming it here is what makes the grid drop that bar.
        { name: 'filterBuilder', location: 'end' },
        // Not the built-in item, which reloads the grid over the collection already in hand.
        // Refresh here means fetch again, so it drops what the store holds first.
        {
          id: 'refresh',
          location: 'end',
          label: this.transloco.translate('managementRoles.refresh'),
          icon: LucideRefreshCw,
          busy: 'reload',
          onClick: () => {
            this.store.reloadRoles();
          },
        },
        { name: 'resetArrangement', location: 'end' },
        { name: 'clearSelection', location: 'end' },
        { name: 'columnChooser', location: 'end' },
        { name: 'export', location: 'end' },
      ],
    };
  });

  /**
   * Held, not built in the template: the grid takes the object itself, and a
   * fresh one per change detection would re-resolve the configuration.
   *
   * The writers the export menu offers. `xlsx` needs `provideDatagridExcel()` and `pdf`
   * needs `provideDatagridPdf()`.
   */
  protected readonly config: Partial<GridConfig<RoleODataResponse>> = {
    export: { formats: ['xlsx', 'pdf', 'csv'], fileName: 'roles' },
  };

  /**
   * Three columns, captioned from the active language.
   *
   * `numberOfUsers` counts grants at this company only and the endpoint projects it in SQL, so
   * it arrives as an ordinary member and sorts and filters like one.
   */
  protected readonly columns = computed<readonly ColumnDef<RoleODataResponse>[]>(() => {
    // Read so the captions rebuild when the language changes.
    this.transloco.getActiveLang();
    const caption = (key: string): string => this.transloco.translate(`managementRoles.${key}`);

    return [
      textColumn<RoleODataResponse>({
        id: 'name',
        field: 'name',
        caption: caption('name'),
        minWidth: 240,
        primary: true,
      }),
      textColumn<RoleODataResponse>({
        id: 'description',
        field: 'description',
        caption: caption('description'),
        minWidth: 240,
      }),
      numberColumn<RoleODataResponse>({
        id: 'numberOfUsers',
        field: 'numberOfUsers',
        caption: caption('numberOfUsers'),
        minWidth: 140,
      }),
    ];
  });
}

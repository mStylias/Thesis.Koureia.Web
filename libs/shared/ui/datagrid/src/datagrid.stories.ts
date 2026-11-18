import {
  Component,
  InjectionToken,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { Datagrid } from './datagrid';
import { DatagridColumnChooser } from './column-chooser/datagrid-column-chooser';
import { DATAGRID_COLUMN_CHOOSER_OPTIONS } from './column-chooser/column-chooser-presentation';
import { DatagridSearch } from './search/datagrid-search';
import {
  filterBuilder,
  filterPanel,
  filterRow,
  gridViews,
  groupPanel,
  headerFilters,
} from './features';
import type { DatagridFeature } from './features.types';
import {
  DatagridCellTemplate,
  DatagridDetailTemplate,
  DatagridEmptyTemplate,
  DatagridGroupTemplate,
  DatagridHeaderTemplate,
  DatagridToolbarTemplate,
} from './datagrid-templates';
import {
  actionsColumn,
  currencyColumn,
  datetimeColumn,
  linkColumn,
  tagColumn,
  textColumn,
} from './presets/columns';
import { memorySavedViewsStorage, provideSavedViewsStorage } from '@ui/saved-views/core';
import { provideDatagridExcel } from './core/export/export-adapters';
import { gridStatesEqual } from './core/state';
import {
  localStorageStatePersistence,
  provideDatagridStatePersistence,
} from './core/state-persistence';
import type { ColumnDef } from './core/types/column.types';
import type { FilterNode } from './core/types/filter.types';
import type { GridConfig, SummaryConfig, ToolbarConfig } from './core/types/config.types';
import type { GridTemplates } from './core/types/template.types';
import type { GridState } from './core/types/state.types';
import type { CellContext } from './core/types/context.types';
import type { GridEvent } from './core/types/event.types';
import type { GridKey } from './core/types/key.types';
import type {
  GridDataSource,
  GroupResult,
  GroupSpec,
  Query,
  QueryResult,
} from './core/types/query.types';
import type { PagingMode } from './core/paging.types';
import type { SelectionMode } from './core/selection.store.types';
import type { DatagridDensity } from './datagrid.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * Every story renders through a demo wrapper, because a story object cannot
 * hold the signals these examples need. Overriding `docs.source.code` shows
 * what a consumer would actually paste rather than `<lib-datagrid-demo />`.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

/**
 * `doc` for a story that renders a demo other than the default one.
 *
 * The meta's controls describe `DatagridDemo`, and every story inherits them
 * whether or not it binds them. `controls` narrows the panel to the arguments
 * this story really passes; an empty list hides it.
 */
const demoDoc = (
  controls: readonly string[],
  markdown: string,
  code: string,
  language = 'html',
) => ({
  ...doc(markdown, code, language),
  controls: controls.length === 0 ? { disable: true } : { include: [...controls] },
});

// The grid sizes to its container, so every demo gives it a bounded height.
const FRAME = 'height: 26rem; display: flex;';
const TALL = 'height: 32rem; display: flex;';

interface Booking {
  id: number;
  code: string;
  customer: string;
  service: string;
  barber: string;
  branch: string;
  branchId: number;
  starts: Date;
  minutes: number;
  price: number;
  status: 'confirmed' | 'pending' | 'cancelled';
}

const SERVICES = ['Κούρεμα', 'Ξύρισμα', 'Περιποίηση γενειάδας', 'Παιδικό κούρεμα', 'Βαφή'];
const BARBERS = ['Ανδρέας', 'Μάριος', 'Νίκος', 'Πέτρος', 'Σταύρος'];
const BRANCHES = ['Λευκωσία', 'Λεμεσός', 'Λάρνακα', 'Πάφος'];
const CUSTOMERS = [
  'Ελένη Δημητρίου',
  'Γιώργος Παπαδόπουλος',
  'Μαρία Κωνσταντίνου',
  'Αντρέας Χαραλάμπους',
  'Σοφία Ιωάννου',
  'Κώστας Γεωργίου',
];
const STATUSES = ['confirmed', 'pending', 'cancelled'] as const;

function makeBookings(count: number): Booking[] {
  const start = new Date('2026-01-05T09:00:00');
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    code: `KO-${(10_000 + index).toString()}`,
    customer: CUSTOMERS[index % CUSTOMERS.length],
    service: SERVICES[index % SERVICES.length],
    barber: BARBERS[index % BARBERS.length],
    branch: BRANCHES[index % BRANCHES.length],
    branchId: (index % BRANCHES.length) + 1,
    starts: new Date(start.getTime() + index * 45 * 60 * 1000),
    minutes: [20, 30, 45, 60][index % 4],
    price: [12, 18, 25, 30, 45][index % 5],
    status: STATUSES[index % STATUSES.length],
  }));
}

const COLUMNS: ColumnDef<Booking>[] = [
  { id: 'code', field: 'code', caption: 'Κωδικός', width: 120 },
  { id: 'customer', field: 'customer', caption: 'Πελάτης', width: 200 },
  { id: 'service', field: 'service', caption: 'Υπηρεσία', width: 180 },
  { id: 'barber', field: 'barber', caption: 'Κουρέας', width: 140 },
  { id: 'branch', field: 'branch', caption: 'Κατάστημα', width: 140 },
  {
    id: 'starts',
    field: 'starts',
    caption: 'Ώρα',
    width: 170,
    dataType: 'datetime',
    format: { type: 'datetime' },
  },
  {
    id: 'minutes',
    field: 'minutes',
    caption: 'Διάρκεια',
    width: 110,
    dataType: 'number',
    format: (value) => `${String(value)} λεπτά`,
  },
  {
    id: 'price',
    field: 'price',
    caption: 'Τιμή',
    width: 110,
    dataType: 'number',
    format: { type: 'currency', currency: 'EUR', precision: 0 },
  },
  { id: 'status', field: 'status', caption: 'Κατάσταση', width: 140 },
];

const BRANCH_ROWS = [
  { id: 1, name: 'Λευκωσία' },
  { id: 2, name: 'Λεμεσός' },
  { id: 3, name: 'Λάρνακα' },
  { id: 4, name: 'Πάφος' },
];

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Επιβεβαιωμένη',
  pending: 'Σε αναμονή',
  cancelled: 'Ακυρωμένη',
};

/** An empty-state renderer as a component type, which crosses any wrapper. */
@Component({
  selector: 'lib-no-bookings',
  template: `
    <p class="t-title">Καμία κράτηση</p>
    <p class="t-body-sm">Δεν υπάρχουν κρατήσεις για αυτό το διάστημα.</p>
  `,
})
class NoBookings {}

const BASE_ROWS = makeBookings(1000);

@Component({
  selector: 'lib-datagrid-demo',
  imports: [Datagrid],
  template: `
    <div style="${FRAME}">
      <lib-datagrid
        [columns]="columns()"
        [data]="rows()"
        key="id"
        [density]="density()"
        [striped]="striped()"
        [hoverHighlight]="hoverHighlight()"
        [rowSeparators]="rowSeparators()"
        [columnSeparators]="columnSeparators()"
        [outerBorder]="outerBorder()"
        [wrapText]="wrapText()"
        [fitColumns]="fitColumns()"
        ariaLabel="Κρατήσεις"
      />
    </div>
  `,
})
class DatagridDemo {
  readonly rowCount = input(1000);
  readonly density = input<DatagridDensity>('standard');
  readonly striped = input(false);
  readonly hoverHighlight = input(true);
  readonly rowSeparators = input(true);
  readonly columnSeparators = input(false);
  readonly outerBorder = input(true);
  readonly wrapText = input(false);
  readonly fitColumns = input(false);

  readonly columns = signal(COLUMNS);
  readonly rows = computed(() =>
    this.rowCount() === BASE_ROWS.length ? BASE_ROWS : makeBookings(this.rowCount()),
  );
}

@Component({
  selector: 'lib-datagrid-pinned-demo',
  imports: [Datagrid],
  template: `
    <div style="${FRAME}">
      <lib-datagrid [columns]="columns" [data]="rows" key="id" ariaLabel="Κρατήσεις" striped />
    </div>
  `,
})
class DatagridPinnedDemo {
  readonly rows = BASE_ROWS;
  readonly columns: ColumnDef<Booking>[] = COLUMNS.map((column) => {
    if (column.id === 'code') {
      return { ...column, pinned: 'start' as const };
    }
    if (column.id === 'price') {
      return { ...column, pinned: 'end' as const };
    }
    return column;
  });
}

@Component({
  selector: 'lib-datagrid-renderer-demo',
  imports: [Datagrid, DatagridCellTemplate, DatagridHeaderTemplate],
  template: `
    <div style="${FRAME}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        ariaLabel="Κρατήσεις"
        [decorateRow]="decorateRow"
      >
        <ng-template libDatagridCell="status" let-cell>
          <span class="demo-badge" [attr.data-status]="cell.value">{{ label(cell.value) }}</span>
        </ng-template>
        <ng-template libDatagridHeader="price" let-header>
          <span style="display:inline-flex;gap:.25rem;align-items:center;">
            {{ header.column.caption }} <span aria-hidden="true">€</span>
          </span>
        </ng-template>
      </lib-datagrid>
    </div>
  `,
  styles: `
    .demo-badge {
      display: inline-flex;
      align-items: center;
      padding-inline: var(--space-2);
      border-radius: var(--radius-pill);
      font-size: var(--text-xs);
      line-height: 1.6;
    }
    .demo-badge[data-status='confirmed'] {
      background: var(--success-bg);
      color: var(--success-text);
    }
    .demo-badge[data-status='pending'] {
      background: var(--warning-bg);
      color: var(--warning-text);
    }
    .demo-badge[data-status='cancelled'] {
      background: var(--error-bg);
      color: var(--error-text);
    }
    .is-cancelled {
      opacity: 0.6;
    }
  `,
})
class DatagridRendererDemo {
  readonly rows = BASE_ROWS.slice(0, 200);
  readonly columns = COLUMNS;

  readonly decorateRow = (row: Booking): { classes: string[] } | null =>
    row.status === 'cancelled' ? { classes: ['is-cancelled'] } : null;

  label(status: unknown): string {
    if (status === 'confirmed') {
      return 'Επιβεβαιωμένη';
    }
    return status === 'pending' ? 'Σε αναμονή' : 'Ακυρωμένη';
  }
}

/** Resolves after a delay, so the loading and error states are observable. */
function slowSource(options: {
  failFirst?: boolean;
  rows?: Booking[];
  delay?: number;
}): GridDataSource<Booking> {
  let attempt = 0;
  return {
    load: (query: Query): Promise<QueryResult<Booking>> =>
      new Promise((resolve, reject) => {
        attempt += 1;
        setTimeout(() => {
          if (options.failFirst === true && attempt === 1) {
            reject(new Error('Ο διακομιστής δεν απάντησε'));
            return;
          }
          const all = options.rows ?? BASE_ROWS;
          const skip = query.skip ?? 0;
          const take = query.take ?? all.length;
          const rows = all.slice(skip, skip + take);
          // A source that was not asked for a count must not volunteer one, or
          // the grid never shows the unknown-total affordances.
          resolve(query.requireTotalCount === true ? { rows, totalCount: all.length } : { rows });
        }, options.delay ?? 1200);
      }),
  };
}

@Component({
  selector: 'lib-datagrid-states-demo',
  imports: [Datagrid, DatagridEmptyTemplate],
  template: `
    <div style="display:flex;flex-direction:column;gap:var(--space-6);">
      <section>
        <p style="margin:0 0 var(--space-2);color:var(--text-secondary);">Αρχική φόρτωση</p>
        <div style="${FRAME}">
          <lib-datagrid [columns]="columns" [data]="slow" key="id" ariaLabel="Φόρτωση" />
        </div>
      </section>
      <section>
        <p style="margin:0 0 var(--space-2);color:var(--text-secondary);">Σφάλμα με επανάληψη</p>
        <div style="${FRAME}">
          <lib-datagrid [columns]="columns" [data]="failing" key="id" ariaLabel="Σφάλμα" />
        </div>
      </section>
      <section>
        <p style="margin:0 0 var(--space-2);color:var(--text-secondary);">Κενή κατάσταση</p>
        <div style="${FRAME}">
          <lib-datagrid [columns]="columns" [data]="none" key="id" ariaLabel="Κενό">
            <ng-template libDatagridEmpty>
              <p style="margin:0;font-weight:600;">Καμία κράτηση ακόμη</p>
              <p style="margin:0;color:var(--text-secondary);">
                Οι νέες κρατήσεις θα εμφανιστούν εδώ.
              </p>
            </ng-template>
          </lib-datagrid>
        </div>
      </section>
    </div>
  `,
})
class DatagridStatesDemo {
  readonly columns = COLUMNS.slice(0, 5);
  readonly slow = slowSource({});
  readonly failing = slowSource({ failFirst: true, rows: BASE_ROWS.slice(0, 25) });
  readonly none: Booking[] = [];
}

@Component({
  selector: 'lib-datagrid-sorting-demo',
  imports: [Datagrid],
  template: `
    <div style="${FRAME}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows()"
        key="id"
        [(sort)]="sort"
        [multiSort]="multiSort()"
        [sortCycle]="cycle()"
        ariaLabel="Κρατήσεις"
      />
    </div>
    <p style="margin-top: .5rem; font: 500 0.8125rem var(--font-mono)">sort = {{ sortText() }}</p>
  `,
})
class DatagridSortingDemo {
  readonly multiSort = input(true);
  readonly cycle = input<'asc-desc-none' | 'asc-desc'>('asc-desc-none');
  readonly rowCount = input(400);
  readonly columns = COLUMNS;
  readonly rows = computed(() => BASE_ROWS.slice(0, this.rowCount()));
  readonly sort = signal<readonly { field: string; desc?: boolean }[]>([{ field: 'customer' }]);
  readonly sortText = computed(
    () =>
      this.sort()
        .map((spec) => `${spec.field}${spec.desc === true ? ' ↓' : ' ↑'}`)
        .join(', ') || '—',
  );
}

@Component({
  selector: 'lib-datagrid-selection-demo',
  imports: [Datagrid],
  template: `
    <div style="${FRAME}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        [selectionMode]="mode()"
        [selectOnRowClick]="selectOnRowClick()"
        [showRowNumbers]="showRowNumbers()"
        [(selectedKeys)]="selected"
        ariaLabel="Κρατήσεις"
      />
    </div>
    <p style="margin-top: .5rem; font: 500 0.8125rem var(--font-mono)">
      {{ selected().length }} επιλεγμένες
    </p>
  `,
})
class DatagridSelectionDemo {
  readonly mode = input<'none' | 'single' | 'multiple'>('multiple');
  readonly selectOnRowClick = input(true);
  readonly showRowNumbers = input(true);
  readonly columns = COLUMNS.slice(0, 6);
  readonly rows = BASE_ROWS.slice(0, 400);
  readonly selected = signal<readonly (string | number | bigint)[]>([]);
}

@Component({
  selector: 'lib-datagrid-columns-demo',
  imports: [Datagrid, DatagridColumnChooser, DatagridToolbarTemplate],
  template: `
    <div style="${FRAME}">
      <lib-datagrid
        #grid
        [columns]="columns"
        [data]="rows"
        key="id"
        [resizeMode]="resizeMode()"
        [fitColumns]="resizeMode() === 'adjacent'"
        [(hiddenColumns)]="hidden"
        ariaLabel="Κρατήσεις"
      >
        <ng-template libDatagridToolbar="end">
          <lib-datagrid-column-chooser
            [columns]="columns"
            [(hidden)]="hidden"
            [iconOnly]="iconOnly()"
          />
        </ng-template>
      </lib-datagrid>
    </div>
  `,
})
class DatagridColumnsDemo {
  readonly resizeMode = input<'widen' | 'adjacent'>('widen');
  readonly iconOnly = input(false);
  readonly columns = COLUMNS;
  readonly rows = BASE_ROWS.slice(0, 400);
  readonly hidden = signal<readonly string[]>([]);
}

/**
 * The composable toolbar, the preset columns, the slot map and a lookup, in
 * one screen — which is what an application actually assembles.
 */
@Component({
  selector: 'lib-datagrid-toolbar-demo',
  imports: [Datagrid],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows()"
        key="id"
        [toolbar]="toolbar()"
        [templates]="templates"
        [features]="features"
        [selectionMode]="'multiple'"
        [(hiddenColumns)]="hidden"
        ariaLabel="Κρατήσεις"
      />
    </div>
  `,
})
class DatagridToolbarDemo {
  /** Drives the overflow: more items than a narrow bar can hold. */
  readonly extraItems = input(false);

  readonly rows = signal<Booking[]>(BASE_ROWS.slice(0, 300).map((row) => ({ ...row })));
  readonly hidden = signal<readonly string[]>([]);
  readonly features: readonly DatagridFeature[] = [filterRow(), filterPanel()];

  /** A component type, so the slot map carries a value rather than a template. */
  readonly templates: GridTemplates = { empty: NoBookings };

  readonly columns: ColumnDef<Booking>[] = [
    textColumn<Booking>({ id: 'code', field: 'code', caption: 'Κωδικός', width: 120 }),
    linkColumn<Booking>(
      { id: 'customer', field: 'customer', caption: 'Πελάτης', width: 200 },
      { href: (row) => `#/bookings/${row.id.toString()}` },
    ),
    {
      id: 'branch',
      field: 'branchId',
      caption: 'Κατάστημα',
      width: 150,
      lookup: { source: BRANCH_ROWS, value: 'id', display: 'name' },
    },
    datetimeColumn<Booking>({ id: 'starts', field: 'starts', caption: 'Ώρα', width: 170 }),
    currencyColumn<Booking>(
      { id: 'price', field: 'price', caption: 'Τιμή', width: 110 },
      { precision: 0 },
    ),
    tagColumn<Booking>(
      { id: 'status', field: 'status', caption: 'Κατάσταση', width: 150 },
      {
        tone: { confirmed: 'success', pending: 'warning', cancelled: 'error' },
        label: (value) => STATUS_LABELS[String(value)] ?? String(value),
      },
    ),
    actionsColumn<Booking>(
      { id: 'actions', caption: '', width: 120 },
      {
        maxInline: 1,
        actions: [
          {
            id: 'confirm',
            label: 'Επιβεβαίωση',
            disabled: (row) => row.status === 'confirmed',
            run: (row) => {
              this.setStatus(row.id, 'confirmed');
            },
          },
          {
            id: 'cancel',
            label: 'Ακύρωση',
            destructive: true,
            disabled: (row) => row.status === 'cancelled',
            run: (row) => {
              this.setStatus(row.id, 'cancelled');
            },
          },
        ],
      },
    ),
  ];

  /** Bumped by the primary item, so its badge shows the toolbar is live. */
  private readonly created = signal(0);

  private setStatus(id: number, status: Booking['status']): void {
    this.rows.update((all) => all.map((row) => (row.id === id ? { ...row, status } : row)));
  }

  readonly toolbar = computed<ToolbarConfig>(() => ({
    items: [
      'search',
      {
        id: 'new',
        label: 'Νέα κράτηση',
        variant: 'primary',
        badge: this.created() === 0 ? undefined : this.created(),
        onClick: (): void => {
          this.created.update((count) => count + 1);
        },
      },
      ...(this.extraItems()
        ? [
            { id: 'print', label: 'Εκτύπωση' },
            { id: 'email', label: 'Αποστολή email' },
            { id: 'archive', label: 'Αρχειοθέτηση' },
          ]
        : []),
      'clearSelection',
      'filterToggle',
      'columnChooser',
      'resetArrangement',
      'refresh',
    ],
  }));
}

/**
 * Banded headers and the primary column — the two column-model surfaces that
 * change what the header itself is.
 */
@Component({
  selector: 'lib-datagrid-bands-demo',
  imports: [Datagrid, DatagridColumnChooser],
  template: `
    <div style="${TALL}; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <lib-datagrid-column-chooser [columns]="columns" [(hidden)]="hidden" />
        <span class="t-body-sm">{{ opened() }}</span>
      </div>
      <lib-datagrid
        style="flex: 1; min-height: 0;"
        [columns]="columns"
        [data]="rows"
        key="id"
        [features]="features"
        [fitColumns]="fitColumns()"
        [(hiddenColumns)]="hidden"
        (primaryCellActivated)="opened.set('Άνοιξε η κράτηση ' + $any($event.row).code)"
        ariaLabel="Κρατήσεις"
      />
    </div>
  `,
})
class DatagridBandsDemo {
  readonly fitColumns = input(false);
  readonly rows = BASE_ROWS.slice(0, 300);
  readonly hidden = signal<readonly string[]>([]);
  readonly features: readonly DatagridFeature[] = [filterRow()];
  readonly opened = signal('Καμία κράτηση δεν άνοιξε ακόμη.');

  readonly columns: ColumnDef<Booking>[] = [
    textColumn<Booking>({
      id: 'code',
      field: 'code',
      caption: 'Κωδικός',
      width: 130,
      primary: true,
    }),
    {
      id: 'appointment',
      caption: 'Ραντεβού',
      columns: [
        datetimeColumn<Booking>({ id: 'starts', field: 'starts', caption: 'Ώρα', width: 170 }),
        {
          id: 'who',
          caption: 'Πρόσωπα',
          columns: [
            textColumn<Booking>({
              id: 'customer',
              field: 'customer',
              caption: 'Πελάτης',
              width: 170,
            }),
            textColumn<Booking>({ id: 'barber', field: 'barber', caption: 'Κουρέας', width: 150 }),
          ],
        },
      ],
    },
    {
      id: 'billing',
      caption: 'Χρέωση',
      columns: [
        currencyColumn<Booking>(
          { id: 'price', field: 'price', caption: 'Τιμή', width: 110 },
          { precision: 0 },
        ),
        tagColumn<Booking>(
          { id: 'status', field: 'status', caption: 'Κατάσταση', width: 150 },
          {
            tone: { confirmed: 'success', pending: 'warning', cancelled: 'error' },
            label: (value) => STATUS_LABELS[String(value)] ?? String(value),
          },
        ),
      ],
    },
    textColumn<Booking>({ id: 'service', field: 'service', caption: 'Υπηρεσία', width: 180 }),
  ];
}

@Component({
  selector: 'lib-datagrid-paging-demo',
  imports: [Datagrid],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="source"
        key="id"
        [pagingMode]="mode()"
        [pageSize]="pageSize()"
        [pageSizes]="[10, 25, 50]"
        [requireTotalCount]="requireTotalCount()"
        [showRowNumbers]="true"
        ariaLabel="Κρατήσεις"
      />
    </div>
  `,
})
class DatagridPagingDemo {
  readonly mode = input<'pager' | 'infinite' | 'none'>('pager');
  readonly pageSize = input(25);
  readonly requireTotalCount = input(true);
  readonly columns = COLUMNS.slice(0, 6);
  readonly source = slowSource({ rows: BASE_ROWS, delay: 250 });
}

@Component({
  selector: 'lib-datagrid-cards-demo',
  imports: [Datagrid],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        [view]="view()"
        [selectionMode]="selectionMode()"
        pagingMode="pager"
        [pageSize]="8"
        [pageSizes]="[8, 16]"
        [toolbar]="toolbar"
        ariaLabel="Κρατήσεις"
      />
    </div>
  `,
})
class DatagridCardsDemo {
  readonly view = input<'table' | 'cards' | 'auto'>('cards');
  readonly selectionMode = input<SelectionMode>('multiple');

  /**
   * The same columns the table stories use, with two of them told where they
   * belong on a card. Everything else resolves: `code` is the primary column
   * and becomes the title, and the rest are labelled field rows.
   */
  readonly columns: ColumnDef<Booking>[] = [
    ...COLUMNS.slice(0, 6).map((column) =>
      column.id === 'customer' ? { ...column, card: { role: 'subtitle' as const } } : column,
    ),
    actionsColumn<Booking>(
      { id: 'actions', caption: '' },
      {
        maxInline: 2,
        actions: [
          { id: 'edit', label: 'Επεξεργασία', run: () => undefined },
          { id: 'cancel', label: 'Ακύρωση', destructive: true, run: () => undefined },
        ],
      },
    ),
  ];

  readonly rows = BASE_ROWS.slice(0, 24);

  readonly toolbar: ToolbarConfig = {
    items: ['search', { name: 'sortMenu' }, { name: 'viewSwitch' }, 'columnChooser'],
  };
}

@Component({
  selector: 'lib-datagrid-live-demo',
  imports: [Datagrid, Button, DatagridToolbarTemplate],
  template: `
    <div style="${FRAME}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows()"
        key="id"
        [flashOnChange]="flashOnChange()"
        ariaLabel="Κρατήσεις"
      >
        <ng-template libDatagridToolbar="end">
          <button libButton type="button" severity="secondary" size="sm" (click)="repriceSome()">
            Ενημέρωση τιμών
          </button>
        </ng-template>
      </lib-datagrid>
    </div>
  `,
})
class DatagridLiveDemo {
  readonly flashOnChange = input(true);
  readonly columns = COLUMNS;
  readonly rows = signal<Booking[]>(BASE_ROWS.slice(0, 60).map((row) => ({ ...row })));

  /** Rewrites a handful of prices, the way a push update would. */
  protected repriceSome(): void {
    const touched = new Set(Array.from({ length: 6 }, () => Math.floor(Math.random() * 14)));
    this.rows.update((rows) =>
      rows.map((row, index) =>
        touched.has(index)
          ? { ...row, price: [12, 18, 25, 30, 45][Math.floor(Math.random() * 5)] }
          : row,
      ),
    );
  }
}

const GROUP_SUMMARIES: SummaryConfig[] = [
  {
    field: 'price',
    type: 'sum',
    scope: 'group',
    valueFormat: { type: 'currency', currency: 'EUR', precision: 0 },
  },
  { field: 'minutes', type: 'avg', scope: 'group', valueFormat: { type: 'number', precision: 0 } },
];

const TOTAL_SUMMARIES: SummaryConfig[] = [
  { field: 'price', type: 'sum', valueFormat: { type: 'currency', currency: 'EUR', precision: 0 } },
  { field: 'minutes', type: 'sum', displayFormat: '{0} λεπτά' },
  // `columnId` places a summary under a column other than the one its field
  // names — the count belongs beside the identifier, not under `id`.
  { field: 'id', type: 'count', columnId: 'code', displayFormat: '{0} κρατήσεις' },
];

@Component({
  selector: 'lib-datagrid-grouping-demo',
  imports: [Datagrid],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        groupPanel
        [(group)]="group"
        [groupDefaultExpanded]="defaultExpanded()"
        [summaries]="summaries()"
        ariaLabel="Κρατήσεις"
        striped
      />
    </div>
  `,
})
class DatagridGroupingDemo {
  readonly defaultExpanded = input(true);
  readonly placement = input<'header' | 'footer' | 'column'>('header');
  readonly columns = COLUMNS;
  readonly rows = BASE_ROWS.slice(0, 400);
  readonly group = signal<readonly GroupSpec[]>([{ field: 'branch' }, { field: 'service' }]);
  readonly summaries = computed<SummaryConfig[]>(() => [
    ...GROUP_SUMMARIES.map((summary) => ({ ...summary, placement: this.placement() })),
    ...TOTAL_SUMMARIES,
  ]);
}

/** A source that groups server-side and returns the hierarchy it built. */
function groupingSource(): GridDataSource<Booking> {
  return {
    load: (query: Query): Promise<QueryResult<Booking>> => {
      const specs = query.group ?? [];
      if (specs.length === 0) {
        return Promise.resolve({ rows: BASE_ROWS.slice(0, 50), totalCount: BASE_ROWS.length });
      }
      const buckets = new Map<string, Booking[]>();
      for (const row of BASE_ROWS) {
        const value = String(row[specs[0].field as keyof Booking]);
        buckets.set(value, [...(buckets.get(value) ?? []), row]);
      }
      const groups: GroupResult<Booking>[] = [...buckets.entries()].map(([key, rows]) => ({
        key,
        // Only the first page of each group travels, which is what
        // `count` is for: the header still reports the whole group.
        items: rows.slice(0, 5),
        count: rows.length,
        aggregates: { 'price:sum': rows.reduce((total, row) => total + row.price, 0) },
      }));
      return Promise.resolve({
        rows: groups.flatMap((group) => (group.items ?? []) as Booking[]),
        groups,
        groupCount: groups.length,
        totalCount: BASE_ROWS.length,
      });
    },
  };
}

@Component({
  selector: 'lib-datagrid-remote-grouping-demo',
  imports: [Datagrid],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="source"
        key="id"
        groupPanel
        [(group)]="group"
        [summaries]="summaries"
        ariaLabel="Κρατήσεις"
      />
    </div>
  `,
})
class DatagridRemoteGroupingDemo {
  readonly columns = COLUMNS;
  readonly source = groupingSource();
  readonly group = signal<readonly GroupSpec[]>([{ field: 'branch' }]);
  readonly summaries: SummaryConfig[] = [
    {
      field: 'price',
      type: 'sum',
      scope: 'group',
      valueFormat: { type: 'currency', currency: 'EUR', precision: 0 },
    },
  ];
}

@Component({
  selector: 'lib-datagrid-detail-demo',
  imports: [Datagrid, DatagridDetailTemplate, DatagridGroupTemplate],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        [detailMode]="detailMode()"
        [detailHeight]="180"
        [group]="group()"
        [(expandedKeys)]="expanded"
        ariaLabel="Κρατήσεις"
      >
        <ng-template libDatagridDetail let-detail>
          <div class="demo-detail">
            <p>
              <strong>Κράτηση {{ detail.key }}</strong>
            </p>
            <button type="button" (click)="detail.collapse()">Κλείσιμο</button>
          </div>
        </ng-template>
        <ng-template libDatagridGroup let-group>
          <span>{{ group.column?.caption }} — {{ group.displayValue }}</span>
          <span style="color: var(--text-muted); margin-inline-start: .5rem;">
            {{ group.count }} κρατήσεις
          </span>
        </ng-template>
      </lib-datagrid>
    </div>
  `,
  styles: `
    .demo-detail {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      align-items: flex-start;
    }
  `,
})
class DatagridDetailDemo {
  readonly detailMode = input<'single' | 'multiple'>('multiple');
  readonly grouped = input(false);
  readonly columns = COLUMNS.slice(0, 6);
  readonly rows = BASE_ROWS.slice(0, 200);
  readonly expanded = signal<readonly GridKey[]>([]);
  readonly group = computed<readonly GroupSpec[]>(() =>
    this.grouped() ? [{ field: 'branch' }] : [],
  );
}

/**
 * A cell renderer as a component type, which is the only renderer form that
 * survives being handed to a wrapper — a template belongs to the view that
 * declared it, however many projection hops it takes.
 */
@Component({
  selector: 'lib-status-cell',
  template: `<span class="demo-badge" [attr.data-status]="context().value">{{ label() }}</span>`,
  styles: `
    .demo-badge {
      display: inline-flex;
      align-items: center;
      padding-inline: var(--space-2);
      border-radius: var(--radius-pill);
      font-size: var(--text-xs);
      line-height: 1.6;
    }
    .demo-badge[data-status='confirmed'] {
      background: var(--success-bg);
      color: var(--success-text);
    }
    .demo-badge[data-status='pending'] {
      background: var(--warning-bg);
      color: var(--warning-text);
    }
    .demo-badge[data-status='cancelled'] {
      background: var(--error-bg);
      color: var(--error-text);
    }
  `,
})
class StatusCell {
  readonly context = input.required<CellContext<Booking>>();

  protected readonly label = computed(() => {
    const value = this.context().value;
    return value === 'confirmed'
      ? 'Επιβεβαιωμένη'
      : value === 'pending'
        ? 'Σε αναμονή'
        : 'Ακυρωμένη';
  });
}

/** The grid settings an application fixes once and a screen can still change. */
interface AppGridDefaults {
  density: DatagridDensity;
  selectionMode: SelectionMode;
  pagingMode: PagingMode;
  pageSize: number;
  showRowNumbers: boolean;
  striped: boolean;
}

/**
 * The house style, in one place.
 *
 * A feature area can provide its own set at a route, so a whole section changes
 * from one `providers` entry and no template is touched.
 */
const APP_GRID_DEFAULTS = new InjectionToken<AppGridDefaults>('APP_GRID_DEFAULTS', {
  providedIn: 'root',
  factory: () => ({
    density: 'compact',
    selectionMode: 'multiple',
    pagingMode: 'pager',
    pageSize: 25,
    showRowNumbers: false,
    striped: true,
  }),
});

/**
 * The application wrapper. Everything it hands the grid is a value.
 *
 * Two surfaces, and they scale differently. `gridEvent` and `api` are fixed:
 * one output carries all 45 events and one signal carries the whole imperative
 * API, so a new grid feature adds no line to either. Configuration is not fixed
 * — an Angular template cannot spread an object onto inputs, so each adjustable
 * setting costs one line here. It costs nothing at a screen, which is the trade
 * that makes the wrapper worth building.
 */
@Component({
  selector: 'lib-app-grid',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="key()"
      [ariaLabel]="ariaLabel()"
      [density]="cfg().density"
      [selectionMode]="cfg().selectionMode"
      [pagingMode]="cfg().pagingMode"
      [pageSize]="cfg().pageSize"
      [showRowNumbers]="cfg().showRowNumbers"
      [striped]="cfg().striped"
      [(selectedKeys)]="selectedKeys"
      (gridEvent)="gridEvent.emit($event)"
    />
  `,
})
class AppGrid {
  readonly columns = input<readonly ColumnDef<Booking>[]>([]);
  readonly data = input<readonly Booking[]>([]);
  readonly key = input<string | null>(null);

  /** Whatever this screen needs to differ from the house style. */
  readonly config = input<Partial<AppGridDefaults>>({});

  // Content, not configuration: every screen names its own grid, so this is an
  // ordinary input rather than an entry in the shared defaults.
  readonly ariaLabel = input('');

  readonly selectedKeys = model<readonly GridKey[]>([]);
  readonly gridEvent = output<GridEvent<Booking>>();

  private readonly house = inject(APP_GRID_DEFAULTS);

  protected readonly cfg = computed<AppGridDefaults>(() => ({
    ...this.house,
    ...this.config(),
  }));

  private readonly grid = viewChild.required<Datagrid<Booking>>(Datagrid);

  /** The whole imperative API, forwarded once and never touched again. */
  readonly api = computed(() => this.grid().api());
}

@Component({
  selector: 'lib-datagrid-wrapper-demo',
  imports: [AppGrid, Button],
  template: `
    <div style="display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem;">
      <button libButton type="button" severity="secondary" size="sm" (click)="sortByPrice()">
        Ταξινόμηση κατά τιμή
      </button>
      <button
        libButton
        type="button"
        severity="secondary"
        size="sm"
        (click)="grid().api().reload()"
      >
        Ανανέωση
      </button>
      <label style="display:inline-flex; gap:.35rem; align-items:center;">
        <input type="checkbox" [checked]="lockSelection()" (change)="toggleLock()" />
        Κλείδωμα επιλογής
      </label>
      <span style="margin-inline-start:auto; font-variant-numeric:tabular-nums;">
        {{ lastEvent() }}
      </span>
    </div>
    <div style="${FRAME}">
      <!-- No template reference variable: one would shadow the \`grid\` signal
           below, and the buttons above call through it. -->
      <lib-app-grid
        [columns]="columns"
        [data]="rows"
        key="id"
        ariaLabel="Κρατήσεις"
        [config]="config()"
        (gridEvent)="onGridEvent($event)"
      />
    </div>
  `,
})
class DatagridWrapperDemo {
  /** Only what this screen changes. Everything else comes from the house style. */
  readonly config = input<Partial<AppGridDefaults>>({});

  protected readonly grid = viewChild.required(AppGrid);
  protected readonly rows = BASE_ROWS.slice(0, 200);
  protected readonly columns: ColumnDef<Booking>[] = COLUMNS.map((column) =>
    column.id === 'status' ? { ...column, cell: StatusCell } : column,
  );

  protected readonly lockSelection = signal(false);
  protected readonly lastEvent = signal('—');

  protected toggleLock(): void {
    this.lockSelection.update((locked) => !locked);
  }

  protected sortByPrice(): void {
    this.grid()
      .api()
      .setSort([{ field: 'price', desc: true }]);
  }

  /**
   * One handler for every event. The veto works because outputs emit
   * synchronously: `canceled` is set before the emission returns.
   */
  protected onGridEvent(event: GridEvent<Booking>): void {
    this.lastEvent.set(event.name);
    if (event.name === 'selectionChanging' && this.lockSelection()) {
      event.payload.canceled = true;
    }
  }
}

@Component({
  selector: 'lib-datagrid-filtering-demo',
  imports: [Datagrid, DatagridSearch, DatagridToolbarTemplate],
  template: `
    <div style="${TALL}">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        [features]="features()"
        [baseFilter]="baseFilter()"
        [(search)]="search"
        ariaLabel="Κρατήσεις"
      >
        <ng-template libDatagridToolbar="start">
          <lib-datagrid-search [value]="search() ?? ''" (valueChange)="onSearch($event)" />
        </ng-template>
      </lib-datagrid>
    </div>
  `,
})
class DatagridFilteringDemo {
  readonly showFilterRow = input(true);
  readonly showHeaderFilter = input(true);
  readonly showFilterPanel = input(true);
  readonly showFilterBuilder = input(true);
  readonly apply = input<'auto' | 'deferred'>('auto');
  /** A scope the user can neither see nor clear, `and`-combined with theirs. */
  readonly onlyConfirmed = input(false);

  protected readonly columns: ColumnDef<Booking>[] = COLUMNS.map((column) => {
    if (column.id === 'status') {
      return {
        ...column,
        filter: {
          headerFilterOptions: [
            { label: 'Επιβεβαιωμένες', node: { field: 'status', op: 'eq', value: 'confirmed' } },
            { label: 'Σε αναμονή', node: { field: 'status', op: 'eq', value: 'pending' } },
            { label: 'Ακυρωμένες', node: { field: 'status', op: 'eq', value: 'cancelled' } },
          ],
        },
      };
    }
    return column.id === 'price' ? { ...column, filter: { groupInterval: { step: 10 } } } : column;
  });
  protected readonly rows = BASE_ROWS.slice(0, 400);
  protected readonly search = signal<string | null>(null);

  /** The box carries a string; the grid's facet is nullable, so empty is null. */
  protected onSearch(value: string): void {
    this.search.set(value === '' ? null : value);
  }

  protected readonly features = computed<DatagridFeature[]>(() => {
    const features: DatagridFeature[] = [];
    if (this.showFilterRow()) {
      features.push(filterRow({ apply: this.apply() }));
    }
    if (this.showHeaderFilter()) {
      features.push(headerFilters({ pageSize: 20 }));
    }
    if (this.showFilterPanel()) {
      features.push(filterPanel());
    }
    if (this.showFilterBuilder()) {
      features.push(filterBuilder());
    }
    return features;
  });

  protected readonly baseFilter = computed<FilterNode | null>(() =>
    this.onlyConfirmed() ? { field: 'status', op: 'ne', value: 'cancelled' } : null,
  );
}

/**
 * Export, clipboard and print (§15).
 *
 * Everything the milestone ships in one screen: the toolbar item, a spliced
 * title row through `beforeExport`, groups and totals inside the file, and —
 * with `remote` on — the paged fetch that a virtualized grid needs, with its
 * progress strip and its cancel button.
 */
@Component({
  selector: 'lib-datagrid-export-demo',
  imports: [Datagrid, Button],
  template: `
    <div style="display: grid; gap: 0.75rem;">
      <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
        <button libButton type="button" severity="secondary" size="sm" (click)="exportCsv()">
          Εξαγωγή CSV
        </button>
        <button libButton type="button" severity="secondary" size="sm" (click)="exportExcel()">
          Εξαγωγή Excel
        </button>
        <button libButton type="button" severity="secondary" size="sm" (click)="copy()">
          Αντιγραφή επιλογής
        </button>
        <button libButton type="button" severity="secondary" size="sm" (click)="print()">
          Εκτύπωση
        </button>
        <span style="font: var(--text-sm); color: var(--text-secondary);">{{ lastEvent() }}</span>
      </div>

      <div style="${TALL}">
        <lib-datagrid
          [columns]="columns"
          [data]="source()"
          key="id"
          [config]="config()"
          [toolbar]="toolbar"
          [summaries]="summaries"
          [selectionMode]="'multiple'"
          [(group)]="group"
          ariaLabel="Κρατήσεις"
          (gridEvent)="onGridEvent($event)"
        />
      </div>
    </div>
  `,
})
class DatagridExportDemo {
  /** Swaps in a paged source, which is what makes the progress strip visible. */
  readonly remote = input(false);

  /** Groups the rows, so the file carries group headers and their totals. */
  readonly grouped = input(false);

  /** Splices a title row into the model from `beforeExport`. */
  readonly titleRow = input(true);

  private readonly grid = viewChild.required<Datagrid<Booking>>(Datagrid);

  private readonly rows = BASE_ROWS.slice(0, 400).map((row) => ({ ...row }));

  readonly group = signal<readonly GroupSpec[]>([]);
  protected readonly lastEvent = signal('');

  /** A deliberately slow source, so cancelling has something to cancel. */
  private readonly paged: GridDataSource<Booking> = {
    load: async (query: Query): Promise<QueryResult<Booking>> => {
      const skip = query.skip ?? 0;
      const take = query.take ?? 50;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return { rows: this.rows.slice(skip, skip + take), totalCount: this.rows.length };
    },
  };

  protected readonly source = computed<readonly Booking[] | GridDataSource<Booking>>(() =>
    this.remote() ? this.paged : this.rows,
  );

  protected readonly config = computed<Partial<GridConfig<Booking>>>(() => ({
    export: {
      fileName: 'κρατήσεις',
      sheetName: 'Κρατήσεις',
      formats: ['csv', 'xlsx'],
      pageSize: 50,
    },
  }));

  protected readonly toolbar: ToolbarConfig = {
    items: ['export', 'clearSelection', 'columnChooser'],
  };

  protected readonly summaries: readonly SummaryConfig[] = [
    {
      field: 'price',
      type: 'sum',
      displayFormat: 'Σύνολο: {0}',
      valueFormat: { type: 'currency', currency: 'EUR', precision: 0 },
    },
    {
      field: 'price',
      type: 'sum',
      scope: 'group',
      valueFormat: { type: 'currency', currency: 'EUR', precision: 0 },
    },
  ];

  protected readonly columns: ColumnDef<Booking>[] = [
    textColumn<Booking>({ id: 'code', field: 'code', caption: 'Κωδικός', width: 120 }),
    textColumn<Booking>({ id: 'customer', field: 'customer', caption: 'Πελάτης', width: 190 }),
    textColumn<Booking>({ id: 'branch', field: 'branch', caption: 'Κατάστημα', width: 150 }),
    datetimeColumn<Booking>({ id: 'starts', field: 'starts', caption: 'Ώρα', width: 170 }),
    currencyColumn<Booking>(
      { id: 'price', field: 'price', caption: 'Τιμή', width: 110 },
      { precision: 0 },
    ),
    // Left out of every file: an internal note the customer never sees.
    { id: 'barber', field: 'barber', caption: 'Κουρέας', width: 140, allow: { exporting: false } },
  ];

  constructor() {
    effect(() => {
      this.group.set(this.grouped() ? [{ field: 'branch' }] : []);
    });
  }

  protected onGridEvent(event: GridEvent<Booking>): void {
    if (event.name === 'beforeExport' && this.titleRow()) {
      const columns = event.payload.model.columns.length;
      event.payload.model.rows.unshift({
        kind: 'custom',
        level: 0,
        key: null,
        cells: [
          {
            value: 'Κρατήσεις — αναφορά',
            text: 'Κρατήσεις — αναφορά',
            type: 'string',
            colSpan: columns,
            indent: 0,
            style: { bold: true, align: 'center' },
          },
        ],
      });
    }
    if (event.name === 'exportProgress') {
      this.lastEvent.set(`exportProgress ${event.payload.loaded.toString()}`);
    }
    if (event.name === 'exported') {
      this.lastEvent.set(
        `exported ${event.payload.fileName} (${event.payload.rowCount.toString()})`,
      );
    }
    if (event.name === 'exportCanceled') {
      this.lastEvent.set('exportCanceled');
    }
  }

  protected exportCsv(): void {
    void this.grid().api().export('csv');
  }

  protected exportExcel(): void {
    void this.grid().api().export('xlsx');
  }

  protected copy(): void {
    void this.grid().api().copyToClipboard();
  }

  protected print(): void {
    this.grid().api().print();
  }
}

const meta: Meta<DatagridDemo> = {
  title: 'Data/Datagrid',
  component: DatagridDemo,
  decorators: [
    applicationConfig({
      providers: [
        // The spreadsheet writer is opt-in and lazily imported: without this
        // provider the Export story offers CSV alone, which is the point.
        provideDatagridExcel(),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    }),
    moduleMetadata({
      imports: [
        DatagridDemo,
        DatagridPinnedDemo,
        DatagridRendererDemo,
        DatagridStatesDemo,
        DatagridSortingDemo,
        DatagridSelectionDemo,
        DatagridColumnsDemo,
        DatagridPagingDemo,
        DatagridToolbarDemo,
        DatagridExportDemo,
        DatagridBandsDemo,
        DatagridGroupingDemo,
        DatagridRemoteGroupingDemo,
        DatagridDetailDemo,
        DatagridLiveDemo,
        DatagridWrapperDemo,
        DatagridFilteringDemo,
      ],
    }),
  ],
  argTypes: {
    rowCount: { control: { type: 'number' } },
    density: { control: 'inline-radio', options: ['compact', 'standard', 'comfortable'] },
    striped: { control: 'boolean' },
    hoverHighlight: { control: 'boolean' },
    rowSeparators: { control: 'boolean' },
    columnSeparators: { control: 'boolean' },
    outerBorder: { control: 'boolean' },
    wrapText: { control: 'boolean' },
    fitColumns: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A virtualized data grid. Only the visible window of rows is rendered, so',
          'the work is proportional to the visible cells rather than to the dataset.',
          '',
          'The grid sizes to its container: give it a height through a flex or grid',
          'parent instead of a fixed pixel value. The row height is a component input',
          'rather than a token, because the virtualizer computes its window from that',
          'number in TypeScript.',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj<DatagridDemo>;

export const Default: Story = {
  args: { rowCount: 1000 },
  parameters: doc(
    'One thousand rows over nine columns. Scroll, then inspect the DOM: only the visible band of rows exists.',
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" ariaLabel="Κρατήσεις" />
    `,
  ),
};

export const Density: Story = {
  args: { rowCount: 200, density: 'compact', striped: true },
  parameters: doc(
    'Density scales cell padding and type size. Row height follows density unless `rowHeight` overrides it.',
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" density="compact" striped />
    `,
  ),
};

export const FitToContainer: Story = {
  args: { rowCount: 200, fitColumns: true },
  parameters: doc(
    [
      'With `fitColumns`, columns grow to fill a container wider than their total.',
      'They never shrink below their minimum, so a narrow container scrolls',
      'horizontally instead of clipping the trailing columns.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" fitColumns />
    `,
  ),
};

export const PinnedColumns: Story = {
  render: () => ({ template: '<lib-datagrid-pinned-demo />' }),
  parameters: demoDoc(
    [],
    [
      'Pinned columns are hoisted to the edges of the render order and stick while',
      'the body scrolls horizontally. The header stays sticky on the other axis, so',
      'both regions remain correct under two-axis scrolling — and reading order is',
      'preserved, because pinning is CSS stickiness rather than a separate DOM pane.',
    ].join(' '),
    `
const columns = [
  { id: 'code', field: 'code', caption: 'Κωδικός', width: 120, pinned: 'start' },
  // …
  { id: 'price', field: 'price', caption: 'Τιμή', width: 110, pinned: 'end' },
];
    `,
    'ts',
  ),
};

export const CellRenderers: Story = {
  render: () => ({ template: '<lib-datagrid-renderer-demo />' }),
  parameters: demoDoc(
    [],
    [
      'A column renders through the formatter fast path by default — one DOM node,',
      'no embedded view. Supply an `ng-template` only where you need markup.',
      'Renderers are recycled: derive everything from the context and keep no',
      'per-row state inside the template.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" [decorateRow]="decorateRow">
  <ng-template libDatagridCell="status" let-cell>
    <span class="badge" [attr.data-status]="cell.value">{{ label(cell.value) }}</span>
  </ng-template>
  <ng-template libDatagridHeader="price" let-header>{{ header.column.caption }} €</ng-template>
</lib-datagrid>
    `,
  ),
};

export const States: Story = {
  render: () => ({ template: '<lib-datagrid-states-demo />' }),
  parameters: demoDoc(
    [],
    [
      'Initial load draws a skeleton in the column layout, but only once the load',
      'has run past 100ms, and then for 400ms at the least; a source that answers',
      'faster shows its rows and nothing else. A later load keeps its',
      'rows and shows a non-blocking bar. A failure renders as data with a retry',
      'affordance and never throws into the host. Every state is replaceable through',
      'a template, and "no data" is distinct from "no results for the filter".',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="source" key="id">
  <ng-template libDatagridEmpty>
    <p>Καμία κράτηση ακόμη</p>
  </ng-template>
</lib-datagrid>
    `,
  ),
};

export const Sorting: StoryObj<DatagridSortingDemo> = {
  args: { multiSort: true, cycle: 'asc-desc-none', rowCount: 400 },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-sorting-demo
      [multiSort]="multiSort"
      [cycle]="cycle"
      [rowCount]="rowCount"
    />`,
  }),
  argTypes: {
    multiSort: { control: 'boolean' },
    cycle: { control: 'inline-radio', options: ['asc-desc-none', 'asc-desc'] },
    rowCount: { control: { type: 'number' } },
  },
  parameters: demoDoc(
    ['multiSort', 'cycle', 'rowCount'],
    [
      'Click a header to cycle ascending → descending → none. Shift-click a second',
      'header to add a criterion; the ordinal badges show the priority. `Enter` sorts',
      'the focused header and `Shift+Enter` adds to the multi-sort, so the whole',
      'model is reachable without a pointer. `sort` is two-way, so a host can preset',
      'it or persist it.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" [(sort)]="sort" />
    `,
  ),
};

export const SortAnimation: Story = {
  render: () => ({ template: `<lib-datagrid-sorting-demo [rowCount]="8" />` }),
  parameters: demoDoc(
    [],
    [
      'Eight rows, so the whole set is on screen. Click a header and the rows',
      'slide to their new places instead of jumping. The grid enables this only',
      'when the rendered window already covers every row: under virtualization a',
      'sort replaces most of the window outright — measured at 400 rows over a',
      '15-row window, a sort left 3 rows in place and a direction flip left none —',
      'so it would slide two or three rows while a dozen popped. Compare with the',
      'Sorting story above, which holds 400 rows and does not animate.',
      '',
      'The move is a `transform`, which is measurably safe over the pinned',
      'columns\' sticky chain. Turn it off with `[animateRows]="false"`.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" [(sort)]="sort" animateRows />
    `,
  ),
};

export const Selection: StoryObj<DatagridSelectionDemo> = {
  args: { mode: 'multiple', selectOnRowClick: true, showRowNumbers: true },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-selection-demo
      [mode]="mode"
      [selectOnRowClick]="selectOnRowClick"
      [showRowNumbers]="showRowNumbers"
    />`,
  }),
  argTypes: {
    mode: { control: 'inline-radio', options: ['none', 'single', 'multiple'] },
    selectOnRowClick: { control: 'boolean' },
    showRowNumbers: { control: 'boolean' },
  },
  parameters: demoDoc(
    ['mode', 'selectOnRowClick', 'showRowNumbers'],
    [
      'Click selects, `Ctrl`/`Cmd`-click adds, `Shift`-click extends a range, `Space`',
      'toggles the focused row and `Ctrl+A` selects everything loaded. The header',
      'checkbox is tri-state. Selection is keyed, so it survives a reload. With',
      '`selectAllMode="allMatching"` the grid stores a predicate — the filter plus',
      'exclusions — instead of a key list, which is what keeps it correct over a',
      'remote source of any size.',
    ].join(' '),
    `
<lib-datagrid
  [columns]="columns"
  [data]="rows"
  key="id"
  selectionMode="multiple"
  [showRowNumbers]="true"
  [(selectedKeys)]="selected"
/>
    `,
  ),
};

// Typed against its own demo rather than `Story`: the arg drives the chooser
// inside `DatagridColumnsDemo`, not an input of the default demo.
export const ColumnManagement: StoryObj<DatagridColumnsDemo> = {
  args: { iconOnly: false, resizeMode: 'widen' },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-columns-demo [iconOnly]="iconOnly" [resizeMode]="resizeMode" />`,
  }),
  argTypes: {
    iconOnly: { control: 'boolean' },
    resizeMode: { control: 'inline-radio', options: ['widen', 'adjacent'] },
  },
  parameters: demoDoc(
    ['iconOnly', 'resizeMode'],
    [
      'Drag a header edge to resize and a header body to reorder. `Alt+Down` opens the',
      'column menu (sort, pin to either edge, hide) and `Ctrl+Arrow` resizes while',
      '`Ctrl+Shift+Arrow` reorders, so every pointer gesture has a keyboard twin. The',
      'chooser in the toolbar is a separate export: a grid that does not offer one',
      'never pulls in the popover. Turn `iconOnly` on for a toolbar with more',
      'controls than room: the caption and the count move into a tooltip and stay',
      'the button’s accessible name, so nothing is lost but the width.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" [(hiddenColumns)]="hidden">
  <ng-template libDatagridToolbar="end">
    <lib-datagrid-column-chooser iconOnly [columns]="columns" [(hidden)]="hidden" />
  </ng-template>
</lib-datagrid>
    `,
  ),
};

// Typed against its own demo: the arg drives the toolbar inside it.
export const Toolbar: StoryObj<DatagridToolbarDemo> = {
  args: { extraItems: false },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-toolbar-demo [extraItems]="extraItems" />`,
  }),
  argTypes: { extraItems: { control: 'boolean' } },
  parameters: demoDoc(
    ['extraItems'],
    [
      'One list holds built-in items by name and host items as values, and the bar',
      'places them by region. Turn `extraItems` on, then narrow the viewport: what',
      'does not fit collapses into a panel — a panel rather than a menu, so a host',
      'renderer stays fully interactive once collapsed. The columns come from the',
      'preset factories: a link that a middle-click opens in a new tab, a tag whose',
      'tone maps from the value, currency and datetime formatting, a lookup',
      'resolving a branch id to its name, and row actions that collapse past the',
      'first into their own menu. The empty state is a component type on the',
      '`templates` map, which is the renderer path that survives a wrapper.',
    ].join(' '),
    `
protected readonly toolbar: ToolbarConfig = {
  items: [
    'search',
    { id: 'new', label: 'Νέα κράτηση', variant: 'primary', onClick: () => this.create() },
    'clearSelection',
    'columnChooser',
    'refresh',
  ],
};

protected readonly columns = [
  textColumn<Booking>({ id: 'code', field: 'code', caption: 'Κωδικός', width: 120 }),
  tagColumn<Booking>({ id: 'status', field: 'status' }, {
    tone: { confirmed: 'success', pending: 'warning', cancelled: 'error' },
  }),
  actionsColumn<Booking>({ id: 'actions' }, { maxInline: 1, actions: [ /* … */ ] }),
];
    `,
    'ts',
  ),
};

export const ColumnChooserPanel: StoryObj<DatagridExportDemo> = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DATAGRID_COLUMN_CHOOSER_OPTIONS,
          useValue: { presentation: signal('panel') },
        },
      ],
    }),
  ],
  render: () => ({ template: `<lib-datagrid-export-demo />` }),
  parameters: demoDoc(
    [],
    [
      'The application can open the column chooser in a floating panel instead of',
      'the popover. The panel docks to the bottom-right corner at the full height of',
      'the viewport and stays open, so each column comes and goes in the grid while',
      'the user chooses. Drag the header to move it and any edge to resize it.',
      'Which surface opens is for the application to decide, often by viewport width, so',
      'the library takes it as a signal and never reads the viewport itself.',
    ].join(' '),
    `
// The application decides, for every grid beneath the injector.
providers: [
  {
    provide: DATAGRID_COLUMN_CHOOSER_OPTIONS,
    useFactory: () => ({
      presentation: computed(() => (desktop() ? 'panel' : 'popover')),
      panelInsetTop: 'var(--shell-header-height)',
    }),
  },
]
    `,
    'ts',
  ),
};

export const Export: StoryObj<DatagridExportDemo> = {
  args: { remote: false, grouped: false, titleRow: true },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-export-demo [remote]="remote" [grouped]="grouped" [titleRow]="titleRow" />`,
  }),
  argTypes: {
    remote: { control: 'boolean' },
    grouped: { control: 'boolean' },
    titleRow: { control: 'boolean' },
  },
  parameters: demoDoc(
    ['remote', 'grouped', 'titleRow'],
    [
      'One normalized table model feeds every destination: the CSV file, the',
      'spreadsheet, the clipboard and the print view. It carries the columns as',
      'arranged, the current sort and filter, the grouping with its aggregates and',
      'the formatted text — so a cell in the file says what the cell on screen said.',
      'The `Κουρέας` column declares `allow.exporting: false` and appears in none of',
      'them. Turn `titleRow` on and `beforeExport` splices a merged caption above',
      'the header, which is the hook §15 asks for. Turn `grouped` on to see group',
      'rows and per-group totals in the file. Turn `remote` on for a paged source:',
      'the export then fetches past the loaded page and the progress strip appears',
      'against the bottom edge, with a cancel button that abandons the run and',
      'writes nothing. `xlsx` is here only because the story registers',
      '`provideDatagridExcel()`; without it the writer is never even downloaded.',
      'An application that registers `DATAGRID_EXCEL_BRANDING` gets a titled banner,',
      'its logo and an accented header in the workbook; the data cells stay plain,',
      'so the file is still one a recipient sorts and totals.',
    ].join(' '),
    `
// Once, in the application injector. The writer loads on the first export.
providers: [provideDatagridExcel()]

// What the workbook wears, once per application. The hues are hex, because a
// spreadsheet carries no custom properties to read a theme from.
{
  provide: DATAGRID_EXCEL_BRANDING,
  useFactory: () => ({
    subtitle: brand.name,
    logo: { url: '/brand/icon.png' },   // PNG. A spreadsheet draws no SVG.
    accent: token('--brand-500'),        // Resolved off :root, since a cell holds no var().
    band: token('--paper'),
  }),
}

// Per grid
protected readonly config: Partial<GridConfig<Booking>> = {
  export: { fileName: 'κρατήσεις', formats: ['csv', 'xlsx'], pageSize: 50 },
};
protected readonly toolbar: ToolbarConfig = { items: ['export'] };

// A title row, and the chance to refuse the export outright
protected onGridEvent(event: GridEvent<Booking>): void {
  if (event.name === 'beforeExport') {
    event.payload.fileName = \`bookings-\${today()}\`;
    event.payload.model.rows.unshift(titleRow(event.payload.model.columns.length));
  }
}

// Imperatively
this.grid().api().export('xlsx');
this.grid().api().copyToClipboard();   // Ctrl/Cmd+C does the same
this.grid().api().print();
    `,
    'ts',
  ),
};

export const ColumnGroups: StoryObj<DatagridBandsDemo> = {
  args: { fitColumns: false },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-bands-demo [fitColumns]="fitColumns" />`,
  }),
  argTypes: { fitColumns: { control: 'boolean' } },
  parameters: demoDoc(
    ['fitColumns'],
    [
      'A column declares `columns` and becomes a **band**: a caption spanning its',
      'children, in a header row of its own. Bands nest, and the spans are derived',
      'from the columns as they are actually drawn — hide **Κουρέας** from the',
      'chooser and **Πρόσωπα** narrows; hide both and it disappears. Nothing below',
      'the header knows bands exist: the query, the body and the saved arrangement',
      'all see a flat list of columns.',
      '',
      "A band's columns stay next to each other, so the caption never spans a gap.",
      'Drag a column and it moves inside its band; drag the **band** and every',
      'column under it travels with it. Pinning any column of a band pins the whole',
      'band. From the keyboard, `ArrowUp` walks from a column to the band that names',
      'it, and `Ctrl+Shift+Arrow` moves whichever of the two is focused.',
      '',
      '**Κωδικός** is the `primary` column: pinned, never hidden, never reordered,',
      'and drawn as the record’s own identifier. Click it, or press `Enter` over',
      'it, and it emits `primaryCellActivated` — once, and without also activating',
      'the row.',
    ].join(' '),
    `
protected readonly columns: ColumnDef<Booking>[] = [
  textColumn<Booking>({ id: 'code', field: 'code', caption: 'Κωδικός', primary: true }),
  {
    id: 'appointment',
    caption: 'Ραντεβού',
    columns: [
      datetimeColumn<Booking>({ id: 'starts', field: 'starts', caption: 'Ώρα' }),
      {
        id: 'who',
        caption: 'Πρόσωπα',
        columns: [
          textColumn<Booking>({ id: 'customer', field: 'customer', caption: 'Πελάτης' }),
          textColumn<Booking>({ id: 'barber', field: 'barber', caption: 'Κουρέας' }),
        ],
      },
    ],
  },
];

// A link instead of a button, when the record has a URL of its own.
{ id: 'code', field: 'code', primary: { href: (row) => \`/bookings/\${row.id}\` } }
    `,
    'ts',
  ),
};

export const Paging: StoryObj<DatagridPagingDemo> = {
  args: { mode: 'pager', pageSize: 25, requireTotalCount: true },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-paging-demo
      [mode]="mode"
      [pageSize]="pageSize"
      [requireTotalCount]="requireTotalCount"
    />`,
  }),
  argTypes: {
    mode: { control: 'inline-radio', options: ['pager', 'infinite', 'none'] },
    pageSize: { control: { type: 'number' } },
    requireTotalCount: { control: 'boolean' },
  },
  parameters: demoDoc(
    ['mode', 'pageSize', 'requireTotalCount'],
    [
      'A classic pager over a simulated remote source. Switch `pagingMode` to',
      '`infinite` to append pages as the viewport approaches the end of what is',
      'loaded, or turn `requireTotalCount` off to get the "load more" affordance a',
      'source with no count can support. `pageSizes` draws the sizes at the other',
      'end of the footer — a button each, or a selector where the row is too narrow',
      'for them — and holds the pager to half the row. The row number column stays',
      'absolute in every mode.',
    ].join(' '),
    `
<lib-datagrid
  [columns]="columns"
  [data]="source"
  key="id"
  pagingMode="pager"
  [pageSize]="25"
  [pageSizes]="[10, 25, 50]"
  [showRowNumbers]="true"
/>
    `,
  ),
};

export const Grouping: StoryObj<DatagridGroupingDemo> = {
  args: { defaultExpanded: true, placement: 'header' },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-grouping-demo
      [defaultExpanded]="defaultExpanded" [placement]="placement" />`,
  }),
  argTypes: {
    defaultExpanded: { control: 'boolean' },
    placement: { control: 'inline-radio', options: ['header', 'footer', 'column'] },
  },
  parameters: demoDoc(
    ['defaultExpanded', 'placement'],
    [
      'Grouped by branch, then by service. Drag a header into the panel to add a',
      'level, click a chip to flip its direction, or use the column menu — every',
      'path writes the same two-way `group` binding. Click a group header, or press',
      '`Enter` / `←` / `→` on it, to collapse and expand; a collapsed group renders',
      'its header alone, so collapsing removes work rather than hiding it.',
      '',
      'Group rows are shorter than data rows, which is what puts the virtualizer on',
      'its variable-height path: every entry declares its height before render and',
      'the offsets come from a prefix sum, so the canvas is the true height on the',
      'first paint and nothing has to be measured.',
      '',
      'Switch `placement` to see the same aggregates inline in the header, in a',
      'group footer row, or aligned under their own column. The grid footer holds',
      'the totals in every case.',
    ].join(' '),
    `
const summaries: SummaryConfig[] = [
  { field: 'price', type: 'sum', scope: 'group', valueFormat: { type: 'currency', currency: 'EUR' } },
  { field: 'price', type: 'sum', valueFormat: { type: 'currency', currency: 'EUR' } },
  { field: 'id', type: 'count', displayFormat: '{0} κρατήσεις' },
];

<lib-datagrid
  [columns]="columns" [data]="rows" key="id"
  groupPanel [(group)]="group" [summaries]="summaries" />
    `,
    'ts',
  ),
};

export const RemoteGrouping: Story = {
  render: () => ({ template: `<lib-datagrid-remote-grouping-demo />` }),
  parameters: demoDoc(
    [],
    [
      'A source that groups server-side returns the hierarchy it built, and the grid',
      'renders it as returned rather than regrouping the rows it received. Each group',
      'ships only its first five rows while `count` reports the whole group, which is',
      'what makes paged group contents possible: the header is honest about a group',
      'the client has never fully loaded, and the aggregates come from the source.',
    ].join(' '),
    `
// The query carries the group spec; the result carries the hierarchy.
load(query: Query): Promise<QueryResult<Booking>> {
  return this.http.post('/bookings/grouped', query).then((result) => ({
    rows: result.flatRows,
    groups: result.groups,   // [{ key, items, count, aggregates }]
    groupCount: result.groupCount,
  }));
}
    `,
    'ts',
  ),
};

export const Filtering: StoryObj<DatagridFilteringDemo> = {
  args: {
    showFilterRow: true,
    showHeaderFilter: true,
    showFilterPanel: true,
    showFilterBuilder: true,
    apply: 'auto',
    onlyConfirmed: false,
  },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-filtering-demo
      [showFilterRow]="showFilterRow"
      [showHeaderFilter]="showHeaderFilter"
      [showFilterPanel]="showFilterPanel"
      [showFilterBuilder]="showFilterBuilder"
      [apply]="apply"
      [onlyConfirmed]="onlyConfirmed"
    />`,
  }),
  argTypes: {
    showFilterRow: { control: 'boolean' },
    showHeaderFilter: { control: 'boolean' },
    showFilterPanel: { control: 'boolean' },
    showFilterBuilder: { control: 'boolean' },
    apply: { control: 'inline-radio', options: ['auto', 'deferred'] },
    onlyConfirmed: { control: 'boolean' },
  },
  parameters: demoDoc(
    [
      'showFilterRow',
      'showHeaderFilter',
      'showFilterPanel',
      'showFilterBuilder',
      'apply',
      'onlyConfirmed',
    ],
    [
      'Five surfaces over one filter tree. Each is a **value** in `features`, not a',
      'directive on the tag, so a wrapper forwards them without linking any of them —',
      'and a screen that filters nothing ships neither the filter row nor the editors',
      'it draws. The funnel in a header cell opens the value list; it is pointer-only,',
      'like the resize handle and the column menu, and `Alt+Down` → “Φιλτράρισμα',
      'στήλης” is its keyboard twin. `Κατάσταση` declares a host option list, so its',
      'entries carry their own nodes. Other columns use the whole array domain:',
      '`Τιμή` groups by ten and `Ώρα` renders a Year → Month → Day tree. Turn',
      '`onlyConfirmed` on for a base filter: it applies to every row query, never',
      'narrows a header-filter domain,',
      'never appears in the panel, and survives “Κατάργηση όλων των φίλτρων”.',
      '“Επεξεργασία φίλτρου” opens the expression editor: nested groups, and/or/not,',
      'and a value editor typed by the field. It writes the free tree, so a top-level',
      'condition it produces lands back in that column’s filter row cell.',
    ].join(' '),
    `
protected readonly features = [filterRow(), headerFilters(), filterPanel(), filterBuilder()];

<lib-datagrid
  [columns]="columns"
  [data]="rows"
  key="id"
  [features]="features"
  [baseFilter]="scope"
  [(search)]="search"
>
  <ng-template libDatagridToolbar="start">
    <lib-datagrid-search [(value)]="search" />
  </ng-template>
</lib-datagrid>
    `,
  ),
};

export const RowDetail: StoryObj<DatagridDetailDemo> = {
  args: { detailMode: 'multiple', grouped: false },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-detail-demo [detailMode]="detailMode" [grouped]="grouped" />`,
  }),
  argTypes: {
    detailMode: { control: 'inline-radio', options: ['single', 'multiple'] },
    grouped: { control: 'boolean' },
  },
  parameters: demoDoc(
    ['detailMode', 'grouped'],
    [
      'Declaring `libDatagridDetail` is what makes rows expandable — the expander',
      'column appears with it. The content is instantiated on first expansion and',
      'destroyed on collapse, so a closed detail costs nothing. Expansion is keyed,',
      'so it survives a reload that returns the row in a different place, and',
      '`expandedKeys` is two-way. `rowExpanding` and `rowCollapsing` are cancellable.',
      '',
      'The expander cell is the tab stop and carries the name; the chevron inside is',
      'decorative. `Enter` and `Space` toggle it, and `→` / `←` open and close in the',
      'direction that would change something — so `→` on an open row still walks to',
      'the next cell. Turn `grouped` on to see detail regions and group rows share',
      'one variable-height body.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows" key="id" [(expandedKeys)]="expanded">
  <ng-template libDatagridDetail let-detail>
    <app-booking-detail [booking]="detail.row" (close)="detail.collapse()" />
  </ng-template>
</lib-datagrid>
    `,
  ),
};

export const LiveUpdates: StoryObj<DatagridLiveDemo> = {
  args: { flashOnChange: true },
  render: (args) => ({
    props: args,
    template: `<lib-datagrid-live-demo [flashOnChange]="flashOnChange" />`,
  }),
  argTypes: { flashOnChange: { control: 'boolean' } },
  parameters: demoDoc(
    ['flashOnChange'],
    [
      'Press the toolbar button to rewrite a few prices the way a push update',
      'would. Only the cells whose value actually changed wash over — sorting,',
      'scrolling and a refresh that changes nothing all stay silent, because a',
      'signal that fires for everything tells you nothing. Turn it off with',
      '`[flashOnChange]="false"`.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="rows()" key="id" flashOnChange />
    `,
  ),
};

export const Performance: Story = {
  args: { rowCount: 10_000, striped: true, density: 'compact' },
  render: (args) => ({
    props: args,
    template: `<div style="${TALL}"><lib-datagrid-demo
      [rowCount]="rowCount" [density]="density" [striped]="striped"
      [hoverHighlight]="hoverHighlight" [rowSeparators]="rowSeparators"
      [columnSeparators]="columnSeparators" [outerBorder]="outerBorder"
      [wrapText]="wrapText" [fitColumns]="fitColumns" /></div>`,
  }),
  parameters: doc(
    [
      'Ten thousand rows over nine columns, the M1 exit measurement. Scroll hard and',
      'watch a DevTools performance trace: rendering work stays proportional to the',
      'visible cells, and memory is bounded by the viewport rather than the row count.',
    ].join(' '),
    `
<lib-datagrid [columns]="columns" [data]="tenThousandRows" key="id" density="compact" striped />
    `,
  ),
};

export const WrappedByAnApp: StoryObj<Partial<AppGridDefaults>> = {
  args: { density: 'compact', selectionMode: 'multiple', pagingMode: 'pager', striped: true },
  // The controls are this screen's overrides, so they travel as one `config`
  // object rather than as a binding each.
  render: (args) => ({
    props: { config: args },
    template: `<lib-datagrid-wrapper-demo [config]="config" />`,
  }),
  argTypes: {
    density: { control: 'inline-radio', options: ['compact', 'standard', 'comfortable'] },
    selectionMode: { control: 'inline-radio', options: ['none', 'single', 'multiple'] },
    pagingMode: { control: 'inline-radio', options: ['pager', 'infinite', 'none'] },
    striped: { control: 'boolean' },
  },
  parameters: demoDoc(
    ['density', 'selectionMode', 'pagingMode', 'striped'],
    [
      'An application builds one `app-grid` and configures it per screen. Nothing',
      'crossing that boundary is projected content — a content query matches by',
      'declaration site, so a template written inside the wrapper belongs to the',
      "app's view forever. Everything travels as a value instead: the status cell",
      'is a **component type** on `ColumnDef.cell`, the imperative API arrives as',
      'one signal the wrapper forwards in one line, and all 45 events arrive on',
      '`(gridEvent)` as a union narrowable by `name`. Tick "Κλείδωμα επιλογής" and',
      'click a row: the handler sets `canceled` on `selectionChanging`, and because',
      'outputs emit synchronously the veto lands before the grid reads it — through',
      'the wrapper, from a component that has never seen the grid.',
      '',
      'The two surfaces scale differently. Events and the API are **fixed** — one',
      'output and one signal, whatever the grid grows next. Configuration is not:',
      'a template cannot spread an object onto inputs, so each adjustable setting',
      'costs one line inside the wrapper and none at a screen. The defaults live in',
      'an injection token, so a feature area can restyle every grid it owns from one',
      '`providers` entry. The controls above are this screen overriding them.',
    ].join(' '),
    `
// bookings-grid.config.ts — a component type, importable as a symbol
{ id: 'status', field: 'status', caption: 'Κατάσταση', cell: StatusCell }

// app-grid.defaults.ts — the house style, in one place
export const APP_GRID_DEFAULTS = new InjectionToken<AppGridDefaults>('APP_GRID_DEFAULTS', {
  providedIn: 'root',
  factory: () => ({ density: 'compact', selectionMode: 'multiple', pagingMode: 'pager',
                    pageSize: 25, showRowNumbers: false, striped: true }),
});

// app-grid.ts — defaults merged under this screen's overrides
readonly config = input<Partial<AppGridDefaults>>({});
private readonly house = inject(APP_GRID_DEFAULTS);
protected readonly cfg = computed(() => ({ ...this.house, ...this.config() }));

<lib-datagrid
  [columns]="columns()" [data]="data()" [key]="key()"
  [density]="cfg().density" [selectionMode]="cfg().selectionMode"
  [pagingMode]="cfg().pagingMode" [pageSize]="cfg().pageSize"
  [showRowNumbers]="cfg().showRowNumbers" [striped]="cfg().striped"
  [(selectedKeys)]="selectedKeys"
  (gridEvent)="gridEvent.emit($event)" />

private readonly grid = viewChild.required(Datagrid);
readonly api = computed(() => this.grid().api());

// bookings-page.html — the house style costs nothing, a difference costs one entry
<app-grid [columns]="columns" [data]="rows" key="id" />
<app-grid [columns]="columns" [data]="rows" key="id"
          [config]="{ density: 'comfortable', pagingMode: 'infinite' }" />

// bookings-page.ts
onGridEvent(event: GridEvent<Booking>): void {
  if (event.name === 'selectionChanging' && this.locked()) {
    event.payload.canceled = true;
  }
}
    `,
    'ts',
  ),
};

/**
 * Every optional surface at once, in a shell that owns its height.
 *
 * The sizing is the point as much as the features are. The host is
 * `display: flex; flex-direction: column` with `min-height: 0`, so a parent
 * that states a height gets a grid that fills it exactly: the viewport takes
 * `flex: 1` and scrolls, and every bar around it is `flex: none`. Nothing here
 * measures anything or writes a pixel height.
 */
@Component({
  selector: 'lib-datagrid-full-screen-demo',
  imports: [
    Datagrid,
    DatagridSearch,
    DatagridToolbarTemplate,
    DatagridDetailTemplate,
    DatagridColumnChooser,
  ],
  template: `
    <!-- The shell states the height; 100dvh rather than 100vh so the retracting
         browser chrome on a phone does not leave the pager under the address
         bar. Everything below this element sizes itself. -->
    <div class="demo-screen">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        [features]="features"
        [summaries]="summaries"
        [(search)]="search"
        [(group)]="group"
        [(selectedKeys)]="selectedKeys"
        [(expandedKeys)]="expandedKeys"
        [(hiddenColumns)]="hiddenColumns"
        selectionMode="multiple"
        detailMode="multiple"
        [detailHeight]="140"
        pagingMode="pager"
        [pageSize]="50"
        [pageSizes]="[25, 50, 100]"
        [showRowNumbers]="true"
        groupable
        multiSort
        striped
        columnSeparators
        wrapText
        fitColumns
        [flashOnChange]="true"
        [animateRows]="true"
        ariaLabel="Κρατήσεις"
      >
        <ng-template libDatagridToolbar="start">
          <lib-datagrid-search [value]="search() ?? ''" (valueChange)="onSearch($event)" />
        </ng-template>
        <ng-template libDatagridToolbar="end">
          <lib-datagrid-column-chooser [columns]="columns" [(hidden)]="hiddenColumns" />
        </ng-template>
        <ng-template libDatagridDetail let-detail>
          <p style="margin: 0;">Κράτηση {{ detail.key }}</p>
        </ng-template>
      </lib-datagrid>
    </div>
  `,
  styles: `
    .demo-screen {
      box-sizing: border-box;
      display: flex;
      height: 100dvh;
      padding: var(--space-4);
    }

    /* Fills the shell in both directions. Without this the grid takes its
       content's width, so hiding a column shrinks the whole screen. */
    .demo-screen > lib-datagrid {
      flex: 1 1 auto;
      min-width: 0;
    }
  `,
})
class DatagridFullScreenDemo {
  protected readonly columns: ColumnDef<Booking>[] = COLUMNS.map((column) =>
    column.id === 'status' ? { ...column, cell: StatusCell } : column,
  );
  protected readonly rows = BASE_ROWS;

  // The filter panel sits at the bottom so the top of the grid stays the
  // toolbar and the group panel — with all four bars stacked above the rows
  // there is very little grid left on a laptop.
  protected readonly features: DatagridFeature[] = [
    filterRow(),
    headerFilters({ pageSize: 20 }),
    filterPanel({ position: 'bottom' }),
    groupPanel(),
  ];

  protected readonly summaries = TOTAL_SUMMARIES;
  protected readonly search = signal<string | null>(null);
  protected readonly group = signal<readonly GroupSpec[]>([]);
  protected readonly selectedKeys = signal<readonly GridKey[]>([]);
  protected readonly expandedKeys = signal<readonly GridKey[]>([]);
  protected readonly hiddenColumns = signal<readonly string[]>([]);

  protected onSearch(value: string): void {
    this.search.set(value === '' ? null : value);
  }
}

export const FullScreen: StoryObj<DatagridFullScreenDemo> = {
  // Registered here rather than in the meta: the demo is declared after it, and
  // a class named in an object literal that runs first is a ReferenceError.
  decorators: [moduleMetadata({ imports: [DatagridFullScreenDemo] })],
  render: () => ({ template: '<lib-datagrid-full-screen-demo />' }),
  parameters: {
    layout: 'fullscreen',
    ...demoDoc(
      [],
      [
        'Every optional surface at once — filter row, header filters, filter panel',
        '(moved to the bottom edge), group panel, row selection, row detail, row',
        'numbers, grouping, multi-sort, summaries, paging, the search box and the',
        'column chooser — in a shell that states its own height.',
        '',
        '**The size never moves.** The grid fills the shell and stays there through',
        'every state: loading, empty, no results after a filter, an error, a hundred',
        'rows or ten thousand. The viewport is the only part that scrolls, so a state',
        'that changes how much content there is changes what the viewport shows, not',
        'how tall the grid is. That falls out of the host being a flex column with',
        '`min-height: 0` — give it a height and it fills it; give it none and it',
        'grows to its content. No resize observer, no measured pixel heights.',
        '',
        'Across is the same deal, and it takes two things: `flex: 1` on the grid, or',
        "it takes its content's width and hiding a column shrinks the screen; and",
        '`fitColumns`, which shares the leftover width between the columns that are',
        'left instead of leaving a gap after the last one.',
        '',
        'Group by dragging a header into the panel, filter from the row or a funnel,',
        'and watch the chips appear along the bottom.',
      ].join(' '),
      `
// The shell owns the height; the grid fills it, both ways.
<div style="display: flex; height: 100dvh;">
  <lib-datagrid style="flex: 1; min-width: 0;" fitColumns
                [columns]="columns" [data]="rows" key="id" [features]="features" … />
</div>

protected readonly features: DatagridFeature[] = [
  filterRow(),
  headerFilters({ pageSize: 20 }),
  filterPanel({ position: 'bottom' }),
  groupPanel(),
];
      `,
      'ts',
    ),
  },
};

// --- M5: state, configuration and live data ------------------------------

/**
 * One exported constant is the whole configuration of a grid, which is what
 * `[config]` plus `provideDatagridDefaults()` are for: the screen names the
 * records, the application names the conventions.
 */
const BOOKINGS_CONFIG: GridConfig<Booking> = {
  key: 'id',
  columns: COLUMNS,
  data: BASE_ROWS.slice(0, 80),
  selection: { mode: 'multiple' },
  appearance: { density: 'standard', striping: true },
  paging: { mode: 'pager', pageSize: 25, pageSizes: [10, 25, 50] },
};

@Component({
  selector: 'lib-datagrid-state-demo',
  imports: [Datagrid, Button],
  template: `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
        <button libButton type="button" severity="secondary" size="sm" (click)="save()">
          Αποθήκευση διάταξης
        </button>
        <button
          libButton
          type="button"
          severity="secondary"
          size="sm"
          [disabled]="saved() === null"
          (click)="restore()"
        >
          Επαναφορά αποθηκευμένης
        </button>
        <button libButton type="button" severity="secondary" size="sm" (click)="reset()">
          Αρχική διάταξη
        </button>
        <span>{{ dirty() ? 'Μη αποθηκευμένες αλλαγές' : 'Καμία αλλαγή' }}</span>
      </div>
      <div style="height: 26rem; display: flex;">
        <lib-datagrid
          [config]="config"
          [features]="features"
          [(state)]="state"
          stateKey="stories.bookings"
          ariaLabel="Κρατήσεις"
          (stateChanged)="lastOrigin.set($event.origin)"
        />
      </div>
      <p>Τελευταία αλλαγή διάταξης: {{ lastOrigin() ?? '—' }}</p>
    </div>
  `,
})
class DatagridStateDemo {
  readonly config = BOOKINGS_CONFIG;
  readonly features: DatagridFeature[] = [filterRow(), headerFilters(), filterPanel()];
  protected readonly state = signal<GridState | null>(null);
  protected readonly saved = signal<GridState | null>(null);
  protected readonly lastOrigin = signal<string | null>(null);

  private readonly grid = viewChild.required(Datagrid);

  protected readonly dirty = computed(() => {
    const reference = this.saved();
    const current = this.state();
    return reference != null && current != null && !gridStatesEqual(current, reference);
  });

  protected save(): void {
    this.saved.set(this.grid().api().getState());
  }

  protected restore(): void {
    const reference = this.saved();
    if (reference != null) {
      this.grid().api().setState(reference);
    }
  }

  protected reset(): void {
    this.grid().api().resetState();
  }
}

@Component({
  selector: 'lib-datagrid-read-only-demo',
  imports: [Datagrid],
  template: `
    <div style="display: grid; gap: 1rem;">
      <div>
        <p class="t-label">Διαδραστικό</p>
        <div style="height: 20rem; display: flex;">
          <lib-datagrid [config]="config" [features]="features" ariaLabel="Κρατήσεις" />
        </div>
      </div>
      <div>
        <p class="t-label">Μόνο για ανάγνωση</p>
        <div style="height: 20rem; display: flex;">
          <lib-datagrid
            readOnly
            [capabilities]="{ sorting: sortable(), paging: true }"
            [config]="config"
            [features]="features"
            ariaLabel="Κρατήσεις, μόνο για ανάγνωση"
          />
        </div>
      </div>
    </div>
  `,
})
class DatagridReadOnlyDemo {
  readonly sortable = input(true);
  readonly config = BOOKINGS_CONFIG;
  readonly features: DatagridFeature[] = [
    filterRow(),
    headerFilters(),
    filterPanel(),
    groupPanel(),
  ];
}

@Component({
  selector: 'lib-datagrid-transactions-demo',
  imports: [Datagrid, Button, DatagridToolbarTemplate],
  template: `
    <div style="height: 26rem; display: flex;">
      <lib-datagrid
        [columns]="columns"
        [data]="rows"
        key="id"
        [(autoRefresh)]="autoRefresh"
        [autoRefreshInterval]="5000"
        [autoRefreshIntervals]="[5000, 15000, 60000]"
        ariaLabel="Κρατήσεις"
      >
        <ng-template libDatagridToolbar="end">
          <button libButton type="button" severity="secondary" size="sm" (click)="insert()">
            Νέα κράτηση
          </button>
          <button libButton type="button" severity="secondary" size="sm" (click)="update()">
            Αλλαγή τιμής
          </button>
          <button libButton type="button" severity="secondary" size="sm" (click)="remove()">
            Διαγραφή πρώτης
          </button>
        </ng-template>
      </lib-datagrid>
    </div>
  `,
})
class DatagridTransactionsDemo {
  readonly columns = COLUMNS;
  readonly rows = BASE_ROWS.slice(0, 40).map((row) => ({ ...row }));
  protected readonly autoRefresh = signal(false);
  private nextId = 10_000;

  private readonly grid = viewChild.required<Datagrid<Booking>>(Datagrid);

  protected insert(): void {
    this.nextId += 1;
    const id = this.nextId;
    this.grid()
      .api()
      .applyTransaction({ insert: [{ ...BASE_ROWS[0], id, code: `KO-${id.toString()}` }] });
  }

  protected update(): void {
    const rows = this.grid().api().getRows();
    if (rows.length === 0) {
      return;
    }
    const target = rows[Math.floor(Math.random() * Math.min(12, rows.length))];
    const price = [12, 18, 25, 30, 45][Math.floor(Math.random() * 5)];
    this.grid()
      .api()
      .applyTransaction({ update: [{ key: target.id, changes: { price } }] });
  }

  protected remove(): void {
    const rows = this.grid().api().getRows();
    if (rows.length > 0) {
      this.grid()
        .api()
        .applyTransaction({ remove: [rows[0].id] });
    }
  }
}

@Component({
  selector: 'lib-datagrid-views-demo',
  imports: [Datagrid],
  template: `
    <!-- Resizable, so the strip can be watched turning into a listbox: the
         swap is driven by what the toolbar has left, not by the window. -->
    <div
      style="height: 30rem; display: flex; resize: horizontal; overflow: hidden; max-width: 100%;"
    >
      <lib-datagrid [config]="config" [features]="features" ariaLabel="Κρατήσεις" />
    </div>
  `,
})
class DatagridViewsDemo {
  // A real bar, so the strip has something to compete with for the width:
  // views never push a button into the overflow menu, they give way to it.
  readonly config: GridConfig<Booking> = {
    ...BOOKINGS_CONFIG,
    toolbar: {
      items: ['search', 'filterToggle', 'columnChooser', 'export', 'refresh', 'resetArrangement'],
    },
  };
  /**
   * `gridViews` is the whole of the opt-in: the strip places itself in the
   * bar's start region without being named as a toolbar item.
   */
  readonly features: DatagridFeature[] = [
    filterRow(),
    filterPanel(),
    gridViews({ key: 'stories_bookings_grid' }),
  ];
}

export const SavedArrangements: StoryObj<DatagridStateDemo> = {
  decorators: [
    moduleMetadata({ imports: [DatagridStateDemo] }),
    applicationConfig({
      providers: [provideDatagridStatePersistence(localStorageStatePersistence())],
    }),
  ],
  render: () => ({ template: '<lib-datagrid-state-demo />' }),
  parameters: demoDoc(
    [],
    [
      'Sort, resize, reorder, hide and filter, then **Αποθήκευση διάταξης** and',
      '**Επαναφορά**. `getState()` / `setState()` are lossless over everything the',
      'user can arrange, and applying a state issues exactly one query however many',
      'facets it changed.',
      '',
      'The grid also carries `stateKey`, and the story provides the local-storage',
      'adapter — so the arrangement survives a reload of this page, and the first',
      'query waits for it rather than going out with a projection the saved state is',
      'about to replace. **Αρχική διάταξη** forgets it again.',
      '',
      '`[(state)]` is two-way and subsumes the per-facet models, which is the one',
      'binding a wrapper forwards instead of a dozen. `stateChanged` is debounced',
      'and says where the change came from: a drag reports once, as `user`; the',
      'buttons above report as `programmatic`.',
    ].join(' '),
    `
<lib-datagrid
  [config]="config"
  [(state)]="state"
  stateKey="bookings"
  (stateChanged)="onStateChanged($event)"
/>

// The adapter is a provider, so it crosses any wrapper.
providers: [provideDatagridStatePersistence(localStorageStatePersistence())]
    `,
    'ts',
  ),
};

export const OneConfigTwoPresentations: StoryObj<DatagridReadOnlyDemo> = {
  decorators: [moduleMetadata({ imports: [DatagridReadOnlyDemo] })],
  args: { sortable: true },
  argTypes: { sortable: { control: 'boolean' } },
  render: (args) => ({
    props: args,
    template: '<lib-datagrid-read-only-demo [sortable]="sortable" />',
  }),
  parameters: demoDoc(
    ['sortable'],
    [
      'Two grids, one `GridConfig` constant, **one binding apart**. The second',
      'carries `readOnly`, and every affordance for a withheld capability is gone',
      'rather than disabled: no filter row, no funnels, no group panel, no resize',
      'handles, no hide entry in the column menu, no selection column. The keyboard',
      'and the `GridApi` refuse the same actions — hiding a resize handle while',
      '`Ctrl+Arrow` still resizes is the defect §3.3 exists to forbid.',
      '',
      'Capabilities re-grant selectively on top of `readOnly`, which is how the',
      'locked grid still sorts and still pages. Turn `sortable` off to watch the',
      'sort affordance and `aria-sort` go with it.',
    ].join(' '),
    `
<lib-datagrid [config]="config" [features]="features" />

<lib-datagrid readOnly [capabilities]="{ sorting: true, paging: true }"
              [config]="config" [features]="features" />
    `,
  ),
};

export const LiveDataTransactions: StoryObj<DatagridTransactionsDemo> = {
  decorators: [moduleMetadata({ imports: [DatagridTransactionsDemo] })],
  render: () => ({ template: '<lib-datagrid-transactions-demo />' }),
  parameters: demoDoc(
    [],
    [
      '`applyTransaction()` applies keyed inserts, updates and removes without a',
      'reload, and only the rows it names are re-rendered — every other row keeps',
      'its identity and its cached view model, so the change flash marks exactly',
      'what moved. A known total moves with the rows that arrived or left.',
      '',
      'The bar along the bottom is auto-refresh: an on/off indicator that carries',
      'its state in text as well as in colour, an interval chooser, and a refresh',
      'now. It suspends itself while a popup is open or a filter edit is waiting,',
      'and in a background tab, because a request nobody can see is pure cost.',
    ].join(' '),
    `
grid.api().applyTransaction({
  insert: [newBooking],
  update: [{ key: 42, changes: { price: 25 } }],
  remove: [17],
});
    `,
    'ts',
  ),
};

export const CardView: StoryObj<DatagridCardsDemo> = {
  decorators: [moduleMetadata({ imports: [DatagridCardsDemo] })],
  render: (args) => ({ props: args, template: '<lib-datagrid-cards-demo [view]="view" />' }),
  args: { view: 'cards' },
  argTypes: { view: { control: 'radio', options: ['table', 'cards', 'auto'] } },
  parameters: demoDoc(
    ['view'],
    [
      'The same grid, drawn as one card per row. A table of eight columns has no',
      'honest form on a phone, so `view="auto"` swaps the presentation below the',
      '`cardsBelow` breakpoint — narrow the viewport to watch it change.',
      '',
      'Nothing is declared twice: the cards read the same `ColumnDef` array. The',
      'primary column becomes the title, `actionsColumn` becomes the footer strip,',
      'and every other column becomes a labelled field. `card: { role: … }` moves',
      'one column, and `role: "none"` leaves it off the card without taking it out',
      'of the table.',
      '',
      'The card list is a list, not a grid: it carries no `aria-colindex`, focus is',
      'per card, and fields are `dt`/`dd` pairs. Sorting moves into the toolbar,',
      'because there is no header to sort from.',
      '',
      '**The cards page by scrolling.** This grid is declared `pagingMode="pager"`,',
      'and in the table you get the pager and the page sizes to prove it — switch',
      'to cards and both are gone, replaced by the next page arriving as you reach',
      'the end of the list. A pager under a list of cards spends a row of the',
      'content on controls, and the screen that draws cards is the one with no row',
      'to spare.',
    ].join(' '),
    `
<!-- The pager in the table, and the same grid paging by scrolling once it draws cards. -->
<lib-datagrid [columns]="columns" [data]="rows" key="id" view="auto" cardsBelow="md"
              pagingMode="pager" [pageSize]="25" />

// One column moved; the rest resolve.
{ id: 'customer', field: 'customer', caption: 'Πελάτης', card: { role: 'subtitle' } }
    `,
  ),
};

export const NamedViews: StoryObj<DatagridViewsDemo> = {
  decorators: [
    moduleMetadata({ imports: [DatagridViewsDemo] }),
    applicationConfig({
      // In memory here on purpose: views are a per-user record the product
      // keeps on a server, and a local-storage convenience would be the wrong
      // default to hand a reader of this page.
      providers: [provideSavedViewsStorage(memorySavedViewsStorage())],
    }),
  ],
  render: () => ({ template: '<lib-datagrid-views-demo />' }),
  parameters: demoDoc(
    [],
    [
      'Press **+**, name a view and save it: the arrangement on screen — sort,',
      'widths, column order, visibility and every filter — becomes a tab. The',
      'page index is not part of it.',
      '',
      'Change anything afterwards and the tab takes an asterisk, with save and',
      'revert beside it. Right-click a tab for duplicate, set as default, edit and',
      'delete; drag a tab, or press `Ctrl` with an arrow, to reorder. **The first',
      'tab is the default**, so making a view default is a move to the front.',
      '',
      'Views take the arrangement over: with them on, the grid does not also',
      'persist through `statePersistence`, so one arrangement can never be saved',
      'in two places and disagree on the next load. The document is read before',
      'the first data query goes out, because the rows are a consequence of the',
      'view.',
      '',
      'Arrows move focus without selecting — a switch costs a query, so',
      'activation is manual: `Enter` or `Space`. `F2` renames, `Shift`+`F10`',
      'opens the menu.',
      '',
      'A strip with more tabs than room gets prev/next arrows rather than a',
      'scrollbar — pointer-only, four fifths of a viewport per press, and the',
      'wheel still works.',
      '',
      '**Drag the bottom-right corner narrower.** A little before the toolbar',
      'starts collapsing items into its overflow menu, the strip becomes a',
      'selectbox whose first row adds a view. The unsaved pair stays beside it',
      'and everything else moves to the ⋯ button, which opens the same menu a',
      'tab does. Reordering waits for the width to come back; **Set as default**',
      'still moves a view to the front.',
    ].join(' '),
    `
// The feature is the opt-in; the strip places itself.
protected readonly features = [gridViews({ key: 'bookings_main_grid' })];

// Where the documents live. One resource per grid, order included.
providers: [provideUserResourceSavedViews()]   // @features/saved-views
    `,
    'ts',
  ),
};

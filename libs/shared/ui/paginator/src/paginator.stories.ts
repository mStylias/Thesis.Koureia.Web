import { Component, computed, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Paginator } from './paginator';
import { PaginatorTemplate } from './paginator-template';
import { PaginatorSection, PaginatorState } from './paginator.types';

/**
 * Shorthand for a per-story description plus an explicit "Show code" snippet.
 * The override is required: every example renders through a demo component
 * (stories cannot hold signals), so the generated source would otherwise show
 * `<lib-paginator-*-demo />` — the scaffolding, not the API. The trade-off is
 * that the snippet is static prose and can drift from the demo above it.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const PAGINATOR_IMPORTS = [Paginator, PaginatorTemplate];

/** Interactive sandbox driven by the Storybook controls. */
@Component({
  selector: 'lib-paginator-playground-demo',
  imports: [...PAGINATOR_IMPORTS],
  template: `
    <lib-paginator
      [(page)]="page"
      [(rows)]="rows"
      [totalRecords]="totalRecords()"
      [pageLinkSize]="pageLinkSize()"
      [rowsPerPageOptions]="[10, 20, 50]"
      [layout]="layout()"
      [alwaysShow]="alwaysShow()"
      [disabled]="disabled()"
      currentPageReportTemplate="{first}–{last} of {totalRecords}"
    />

    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      page <strong>{{ page() }}</strong> • rows <strong>{{ rows() }}</strong>
    </p>
  `,
})
class PaginatorPlaygroundDemo {
  readonly totalRecords = input(120);
  readonly pageLinkSize = input(5);
  readonly alwaysShow = input(true);
  readonly disabled = input(false);
  readonly withRowsPerPage = input(false);
  readonly withReport = input(false);

  protected readonly page = signal(1);
  protected readonly rows = signal(10);

  protected readonly layout = computed<PaginatorSection[]>(() => {
    const sections: PaginatorSection[] = ['first', 'prev', 'pages', 'next', 'last'];
    if (this.withRowsPerPage()) sections.push('rowsPerPage');
    if (this.withReport()) sections.push('currentReport');
    return sections;
  });
}

/** A gallery paged with a bare prev/next + report footer (PrimeNG "Images"). */
@Component({
  selector: 'lib-paginator-gallery-demo',
  imports: [...PAGINATOR_IMPORTS],
  template: `
    <div
      style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); width: 22rem;"
    >
      @for (item of pageItems(); track item) {
        <div
          style="aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--surface-2); color: var(--text-secondary); font-family: var(--font-mono);"
        >
          {{ item }}
        </div>
      }
    </div>

    <lib-paginator
      style="margin-top: var(--space-3);"
      [(page)]="page"
      [rows]="4"
      [totalRecords]="items.length"
      [layout]="['prev', 'currentReport', 'next']"
      currentPageReportTemplate="{currentPage} / {totalPages}"
    />
  `,
})
class PaginatorGalleryDemo {
  protected readonly items = Array.from({ length: 24 }, (_, i) => `#${i + 1}`);
  protected readonly page = signal(1);
  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * 4;
    return this.items.slice(start, start + 4);
  });
}

/** Full data-grid footer: rows-per-page + report + jump field. */
@Component({
  selector: 'lib-paginator-datagrid-demo',
  imports: [...PAGINATOR_IMPORTS],
  template: `
    <lib-paginator
      [(page)]="page"
      [(rows)]="rows"
      [totalRecords]="totalRecords"
      [rowsPerPageOptions]="[5, 10, 25, 50]"
      [layout]="[
        'rowsPerPage',
        'first',
        'prev',
        'pages',
        'next',
        'last',
        'currentReport',
        'jumpToPageInput',
      ]"
      currentPageReportTemplate="{first}–{last} of {totalRecords}"
      (paginate)="lastEvent.set($event)"
    />

    @if (lastEvent(); as e) {
      <p
        style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm); font-family: var(--font-mono);"
      >
        paginate → page {{ e.page }}, rows {{ e.rows }}, slice [{{ e.first }}, {{ e.last }})
      </p>
    }
  `,
})
class PaginatorDatagridDemo {
  protected readonly totalRecords = 297;
  protected readonly page = signal(1);
  protected readonly rows = signal(10);
  protected readonly lastEvent = signal<PaginatorState | null>(null);
}

/** Custom `currentReport` content via a `libPaginatorTemplate` slot. */
@Component({
  selector: 'lib-paginator-template-demo',
  imports: [...PAGINATOR_IMPORTS],
  template: `
    <lib-paginator
      [(page)]="page"
      [rows]="10"
      [totalRecords]="200"
      [layout]="['first', 'prev', 'pages', 'next', 'last', 'currentReport']"
    >
      <ng-template libPaginatorTemplate="currentReport" let-s>
        <span style="font-size: var(--text-sm); color: var(--accent); font-weight: 600;">
          Showing {{ s.first + 1 }}–{{ s.last }} of {{ s.totalRecords }} barbers
        </span>
      </ng-template>
    </lib-paginator>
  `,
})
class PaginatorTemplateDemo {
  protected readonly page = signal(3);
}

const meta: Meta<PaginatorPlaygroundDemo> = {
  title: 'Layout & Navigation/Pagination',
  component: PaginatorPlaygroundDemo,
  decorators: [
    applicationConfig({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    }),
    moduleMetadata({
      imports: [PaginatorGalleryDemo, PaginatorDatagridDemo, PaginatorTemplateDemo],
    }),
  ],
  argTypes: {
    totalRecords: { control: { type: 'number', min: 0, step: 10 } },
    pageLinkSize: { control: { type: 'number', min: 1, max: 9 } },
    alwaysShow: { control: 'boolean' },
    disabled: { control: 'boolean' },
    withRowsPerPage: { control: 'boolean' },
    withReport: { control: 'boolean' },
  },
  args: {
    totalRecords: 120,
    pageLinkSize: 5,
    alwaysShow: true,
    disabled: false,
    withRowsPerPage: false,
    withReport: false,
  },
};

export default meta;
type Story = StoryObj<PaginatorPlaygroundDemo>;

/**
 * Interactive sandbox — bind `[(page)]`/`[(rows)]`, set `totalRecords`, and
 * compose the `layout`. Toggle the rows-per-page dropdown and the current-page
 * report, or resize the numbered window with `pageLinkSize`, using the
 * **Controls** below.
 */
export const Playground: Story = {
  parameters: doc(
    'The basic paginator: `[(page)]` (1-based) and `[(rows)]` are two-way, ' +
      '`totalRecords` sizes the strip, and `layout` lists the sections to ' +
      'render. Use the **Controls** to explore.',
    `
<lib-paginator
  [(page)]="page"
  [(rows)]="rows"
  [totalRecords]="total()"
  [layout]="['first', 'prev', 'pages', 'next', 'last']"
  (paginate)="load($event)" />
`,
  ),
};

export const ManyPages: Story = {
  args: { totalRecords: 2000, pageLinkSize: 5 },
  parameters: doc(
    'With many pages the numbered strip uses a **boundary + ellipsis** window: ' +
      'the first and last page are always shown, with a `pageLinkSize`-wide ' +
      'window around the current page and `…` filling the gaps. Jump toward the ' +
      'middle to see both ellipses.',
    `
<!-- 1 … 8 9 10 11 12 … 200 -->
<lib-paginator [(page)]="page" [rows]="10" [totalRecords]="2000" [pageLinkSize]="5" />
`,
  ),
};

export const RowsPerPage: Story = {
  args: { withRowsPerPage: true, withReport: true },
  parameters: doc(
    'Add `rowsPerPage` to the layout and pass `rowsPerPageOptions`. Changing ' +
      'the page size keeps the first visible record on screen (the page is ' +
      'recomputed around it). Unusable options are dropped rather than offered.',
    `
<lib-paginator
  [(page)]="page"
  [(rows)]="rows"
  [totalRecords]="total()"
  [rowsPerPageOptions]="[10, 20, 50]"
  [layout]="['first', 'prev', 'pages', 'next', 'last', 'rowsPerPage', 'currentReport']" />
`,
  ),
};

export const CurrentPageReport: Story = {
  render: () => ({ template: '<lib-paginator-template-demo />' }),
  parameters: doc(
    'The `currentReport` section renders `currentPageReportTemplate` with the ' +
      'placeholders `{currentPage}`, `{totalPages}`, `{first}`, `{last}`, ' +
      '`{rows}`, `{totalRecords}`. Leave the input empty and it uses the ' +
      'translated default from the `paginator` scope. Here the section is ' +
      'overridden entirely with a `libPaginatorTemplate` slot for custom markup.',
    `
<!-- Substituted template. Empty ⇒ the translated default. -->
<lib-paginator … currentPageReportTemplate="{first}–{last} of {totalRecords}" />

<!-- Or replace the section outright. -->
<lib-paginator [(page)]="page" [rows]="10" [totalRecords]="200"
  [layout]="['first', 'prev', 'pages', 'next', 'last', 'currentReport']">
  <ng-template libPaginatorTemplate="currentReport" let-s>
    Showing {{ s.first + 1 }}–{{ s.last }} of {{ s.totalRecords }} barbers
  </ng-template>
</lib-paginator>
`,
  ),
};

export const DataGridFooter: Story = {
  render: () => ({ template: '<lib-paginator-datagrid-demo />' }),
  parameters: doc(
    'A full data-grid footer: rows-per-page, the numbered strip, a report, and ' +
      'a jump-to-page input, all ordered through `layout`. `(paginate)` emits ' +
      'the full state — `first`/`last` are ready to slice the current page. It ' +
      'is deliberately not called `pageChange`: that name belongs to the ' +
      '`[(page)]` model and would feed the state object back into your `page`.',
    `
<lib-paginator
  [(page)]="page"
  [(rows)]="rows"
  [totalRecords]="297"
  [rowsPerPageOptions]="[5, 10, 25, 50]"
  [layout]="[
    'rowsPerPage', 'first', 'prev', 'pages', 'next', 'last',
    'currentReport', 'jumpToPageInput'
  ]"
  (paginate)="rows = all.slice($event.first, $event.last)" />
`,
  ),
};

export const Images: Story = {
  render: () => ({ template: '<lib-paginator-gallery-demo />' }),
  parameters: doc(
    'A gallery paged with a minimal prev / report / next layout and a ' +
      '`{currentPage} / {totalPages}` report — the paginator drives which ' +
      'slice of items is shown.',
    `
<div class="gallery">
  @for (item of pageItems(); track item) { … }
</div>

<lib-paginator
  [(page)]="page"
  [rows]="4"
  [totalRecords]="items.length"
  [layout]="['prev', 'currentReport', 'next']"
  currentPageReportTemplate="{currentPage} / {totalPages}" />
`,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    '`disabled` disables every control in the paginator — the buttons, the ' +
      'rows-per-page dropdown, and the jump field alike. The handlers re-check ' +
      'it too, so a click that was already in flight cannot slip through.',
    `
<lib-paginator [(page)]="page" [rows]="10" [totalRecords]="120" disabled />
`,
  ),
};

export const HideOnSinglePage: Story = {
  args: { totalRecords: 8, alwaysShow: false },
  parameters: doc(
    'With `alwaysShow="false"`, the paginator hides itself when there is one ' +
      'page or fewer (here `totalRecords` fits in a single page of 10). This ' +
      'is the transition the enter/leave animation exists for — it is withheld ' +
      'on the first paint, so a bar that is present from the start does not ' +
      'animate on page load.',
    `
<lib-paginator [(page)]="page" [rows]="10" [totalRecords]="8" [alwaysShow]="false" />
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'The paginator renders a `navigation` landmark, named by `ariaLabel` or ' +
        'by the translated `paginator.ariaLabel` when that is left empty.',
      '',
      '- Each button carries a translated `aria-label` from the Transloco ' +
        '`paginator` scope (Greek + English shipped); the numbered strip is a ' +
        'labelled `group`. Nothing is hardcoded English.',
      '- The active page link is marked `aria-current="page"`.',
      '- Boundary/step buttons are `disabled` at the ends; the report is an ' +
        '`aria-live="polite"` region so page changes are announced.',
      '- Focus is Tab-based — every control is individually reachable, and ' +
        'Enter/Space activate as native buttons.',
    ].join('\n'),
    `
<!-- Named from the translation scope. -->
<lib-paginator [(page)]="page" [rows]="10" [totalRecords]="120" />

<!-- Or override the landmark name for a page with several paginators. -->
<lib-paginator … ariaLabel="Barbers pagination" />
`,
  ),
};

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Paginator } from './paginator';
import { PaginatorState, buildPageItems } from './paginator.types';

describe('buildPageItems', () => {
  const pages = (items: ReturnType<typeof buildPageItems>) =>
    items.map((i) => (i.type === 'ellipsis' ? '…' : i.page));

  it('returns nothing for an empty set and a lone page for one', () => {
    expect(buildPageItems(1, 0, 5)).toEqual([]);
    expect(pages(buildPageItems(1, 1, 5))).toEqual([1]);
  });

  it('shows every page when they fit the window (+ boundaries)', () => {
    expect(pages(buildPageItems(3, 7, 5))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shows a trailing ellipsis near the start', () => {
    expect(pages(buildPageItems(2, 20, 5))).toEqual([1, 2, 3, 4, 5, '…', 20]);
  });

  it('shows a leading ellipsis near the end', () => {
    expect(pages(buildPageItems(19, 20, 5))).toEqual([1, '…', 16, 17, 18, 19, 20]);
  });

  it('shows both ellipses in the middle', () => {
    expect(pages(buildPageItems(10, 20, 5))).toEqual([1, '…', 8, 9, 10, 11, 12, '…', 20]);
  });

  it('never repeats a boundary as an ellipsis when it is adjacent', () => {
    // Window touches page 2 → page 1 shown, but no gap between 1 and 2.
    expect(pages(buildPageItems(3, 20, 5))).toEqual([1, 2, 3, 4, 5, '…', 20]);
  });
});

describe('Paginator', () => {
  let fixture: ComponentFixture<Paginator>;
  let paginator: Paginator;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const buttonByLabel = (label: string): HTMLButtonElement => {
    const button = root().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!button) {
      throw new Error(`No button with aria-label "${label}"`);
    }
    return button;
  };
  const numberedButtons = (): HTMLButtonElement[] =>
    Array.from(root().querySelectorAll('.paginator-pages button'));
  const text = (selector: string): string =>
    root().querySelector(selector)?.textContent.trim() ?? '';

  beforeEach(async () => {
    TestBed.configureTestingModule({
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
    });
    fixture = TestBed.createComponent(Paginator);
    paginator = fixture.componentInstance;
    fixture.componentRef.setInput('totalRecords', 95);
    fixture.componentRef.setInput('rows', 10);
    fixture.detectChanges();
    // The `paginator` scope loads lazily via dynamic import — await it so the
    // translated aria-labels are present before assertions run.
    await firstValueFrom(TestBed.inject(TranslocoService).load('paginator/en'));
    fixture.detectChanges();
  });

  it('renders a navigation landmark named by ariaLabel', () => {
    const nav = root().querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute('aria-label')).toBe('Pagination');
  });

  it('marks the active page with aria-current', () => {
    const current = numberedButtons().find((b) => b.getAttribute('aria-current') === 'page');
    expect(current?.textContent.trim()).toBe('1');
  });

  it('emits the full state and advances on next', () => {
    const events: PaginatorState[] = [];
    paginator.paginate.subscribe((e) => events.push(e));

    buttonByLabel('Next page').click();
    fixture.detectChanges();

    expect(paginator.page()).toBe(2);
    expect(events.at(-1)).toEqual({
      page: 2,
      rows: 10,
      first: 10,
      last: 20,
      pageCount: 10,
      totalRecords: 95,
    });
  });

  it('clamps the last page slice to the total', () => {
    const events: PaginatorState[] = [];
    paginator.paginate.subscribe((e) => events.push(e));

    buttonByLabel('Last page').click();
    fixture.detectChanges();

    expect(paginator.page()).toBe(10);
    expect(events.at(-1)).toMatchObject({ first: 90, last: 95 });
  });

  it('disables the boundary buttons at the ends', () => {
    expect(buttonByLabel('First page').disabled).toBe(true);
    expect(buttonByLabel('Previous page').disabled).toBe(true);
    expect(buttonByLabel('Next page').disabled).toBe(false);

    buttonByLabel('Last page').click();
    fixture.detectChanges();

    expect(buttonByLabel('Next page').disabled).toBe(true);
    expect(buttonByLabel('Last page').disabled).toBe(true);
  });

  it('reconciles an out-of-range external page without emitting', () => {
    const events: PaginatorState[] = [];
    paginator.paginate.subscribe((e) => events.push(e));

    fixture.componentRef.setInput('totalRecords', 15); // now only 2 pages
    paginator.page.set(9);
    fixture.detectChanges();

    expect(paginator.page()).toBe(2);
    expect(events).toHaveLength(0);
  });

  it('substitutes the current-page-report placeholders', () => {
    fixture.componentRef.setInput('layout', ['currentReport']);
    fixture.componentRef.setInput(
      'currentPageReportTemplate',
      '{first}-{last} of {totalRecords} ({currentPage}/{totalPages})',
    );
    fixture.detectChanges();

    expect(text('.paginator-report')).toBe('1-10 of 95 (1/10)');
  });

  it('keeps the first visible record when rows change', () => {
    // Jump to page 5 (records 40–50 with rows=10), then halve the page size.
    (paginator as unknown as { goTo(p: number): void }).goTo(5);
    (paginator as unknown as { onRowsChange(r: number): void }).onRowsChange(5);
    fixture.detectChanges();

    // Record index 40 now lives on page 9 with rows=5.
    expect(paginator.rows()).toBe(5);
    expect(paginator.page()).toBe(9);
    expect((paginator as unknown as { first(): number }).first()).toBe(40);
  });

  it('floors a non-positive rows value instead of dividing by zero', () => {
    const events: PaginatorState[] = [];
    paginator.paginate.subscribe((e) => events.push(e));

    fixture.componentRef.setInput('rows', 0);
    fixture.detectChanges();

    expect(paginator.rows()).toBe(1);
    expect((paginator as unknown as { first(): number }).first()).toBe(0);
    expect((paginator as unknown as { last(): number }).last()).toBe(1);
    // A reconciliation is not a user action.
    expect(events).toHaveLength(0);
  });

  it('ignores a non-positive rows change instead of emitting NaN', () => {
    const events: PaginatorState[] = [];
    paginator.paginate.subscribe((e) => events.push(e));

    (paginator as unknown as { goTo(p: number): void }).goTo(5);
    (paginator as unknown as { onRowsChange(r: number): void }).onRowsChange(0);
    fixture.detectChanges();

    expect(paginator.rows()).toBe(10);
    expect(paginator.page()).toBe(5);
    expect(events.at(-1)).toMatchObject({ page: 5, rows: 10 });
  });

  it('drops non-positive rows-per-page options', () => {
    fixture.componentRef.setInput('layout', ['rowsPerPage']);
    fixture.componentRef.setInput('rowsPerPageOptions', [0, 10, -5, 20]);
    fixture.detectChanges();

    const options = (paginator as unknown as { rowsOptions(): { value: number }[] }).rowsOptions();
    expect(options.map((o) => o.value)).toEqual([10, 20]);
  });

  it('hides itself on a single page when alwaysShow is false', () => {
    const visible = () => (paginator as unknown as { visible(): boolean }).visible();
    expect(visible()).toBe(true);

    fixture.componentRef.setInput('alwaysShow', false);
    fixture.componentRef.setInput('totalRecords', 8); // fits one page of 10
    fixture.detectChanges();

    // `visible()` drives the `@if` around the nav (the nav then plays its
    // leave animation before Angular removes it from the DOM).
    expect(visible()).toBe(false);
  });

  /**
   * Regression: `totalRecords` is a bare `numberAttribute`, so an
   * unparseable value arrives as `NaN`. `Math.ceil(NaN / rows)` is `NaN` and
   * `Math.max(1, NaN)` stays `NaN`, which used to poison `pageCount` and
   * leave the numbered strip empty and every button dead.
   */
  it('treats an unusable totalRecords as empty instead of NaN', () => {
    fixture.componentRef.setInput('totalRecords', 'not-a-number');
    fixture.detectChanges();

    expect(numberedButtons().map((b) => b.textContent.trim())).toEqual(['1']);
    expect((paginator as unknown as { state(): PaginatorState }).state()).toEqual({
      page: 1,
      rows: 10,
      first: 0,
      last: 0,
      pageCount: 1,
      totalRecords: 0,
    });
  });

  /** A negative total would put `last` behind `first` and break the slice. */
  it('treats a negative totalRecords as empty', () => {
    fixture.componentRef.setInput('totalRecords', -20);
    fixture.detectChanges();

    expect((paginator as unknown as { last(): number }).last()).toBe(0);
  });

  /**
   * Regression: `pageLinkSize` reached `buildPageItems` raw, where
   * `Math.max(1, NaN)` is `NaN` and every comparison against it is false —
   * so the whole numbered strip rendered as nothing.
   */
  it('still renders page links for an unusable pageLinkSize', () => {
    fixture.componentRef.setInput('pageLinkSize', 'huge');
    fixture.detectChanges();

    const labels = numberedButtons().map((b) => b.textContent.trim());
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toContain('1');
    expect(labels).toContain('10');
  });

  /**
   * The landmark name and the report template used to be hardcoded English
   * input defaults; both now come from the `paginator` scope. This locks the
   * two keys in place — it cannot distinguish them from the old literals,
   * which read the same in English, so the Greek side is covered by
   * `renders every shipped key in Greek` below.
   */
  it('names the landmark and the report from the translation scope', () => {
    expect(root().querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination');

    fixture.componentRef.setInput('layout', ['currentReport']);
    fixture.detectChanges();

    expect(text('.paginator-report')).toBe('1 of 10');
  });

  it('lets a consumer template override the translated report', () => {
    fixture.componentRef.setInput('layout', ['currentReport']);
    fixture.componentRef.setInput('currentPageReportTemplate', '{first}–{last}');
    fixture.detectChanges();

    expect(text('.paginator-report')).toBe('1–10');
  });

  // The first-paint gate on `animate.enter` is deliberately not asserted
  // here: jsdom has no Web Animations API, so Angular tears the class off
  // again within the same tick and the assertion passes either way. Verify
  // it in a browser with `document.getAnimations().length === 0` after load.

  it('renders sections in the order given by layout', () => {
    fixture.componentRef.setInput('layout', ['next', 'prev']);
    fixture.detectChanges();

    const labels = Array.from(root().querySelectorAll('button[aria-label]')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Next page', 'Previous page']);
  });
});

/**
 * Greek is the product's first language, so a key shipped in English but not
 * in Greek is a defect. Both the landmark name and the report template were
 * added to the scope after starting life as hardcoded English defaults.
 */
describe('Paginator translations', () => {
  it('ships the same keys in Greek and English', async () => {
    const [{ default: el }, { default: en }] = await Promise.all([
      import('./i18n/el'),
      import('./i18n/en'),
    ]);

    expect(Object.keys(el).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(en)).toContain('ariaLabel');
    expect(Object.keys(en)).toContain('currentReportTemplate');
    // Every Greek value has to differ from the English one, or a key was
    // copied across without being translated.
    for (const key of Object.keys(en)) {
      expect(el[key], `"${key}" is untranslated`).not.toBe(en[key]);
    }
  });

  it('keeps the report placeholders intact in every language', async () => {
    const [{ default: el }, { default: en }] = await Promise.all([
      import('./i18n/el'),
      import('./i18n/en'),
    ]);

    const templates = [el['currentReportTemplate'], en['currentReportTemplate']] as string[];
    for (const template of templates) {
      expect(template).toContain('{currentPage}');
      expect(template).toContain('{totalPages}');
    }
  });
});

/**
 * Regression: the rich state event must NOT be named `pageChange`, or the
 * `[(page)]` model's implicit `pageChange` output collides with it and the
 * state object gets written back into the caller's `page`. This only shows
 * up through a real two-way binding, so it needs a host template.
 */
@Component({
  imports: [Paginator],
  template: `
    <lib-paginator [(page)]="page" [totalRecords]="120" [rows]="10" (paginate)="last.set($event)" />
  `,
})
class PaginatorHost {
  readonly page = signal(1);
  readonly last = signal<PaginatorState | null>(null);
}

describe('Paginator two-way binding', () => {
  let fixture: ComponentFixture<PaginatorHost>;
  let host: PaginatorHost;

  beforeEach(async () => {
    TestBed.configureTestingModule({
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
    });
    fixture = TestBed.createComponent(PaginatorHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await firstValueFrom(TestBed.inject(TranslocoService).load('paginator/en'));
    fixture.detectChanges();
  });

  it('writes a page number (not the state object) back through [(page)]', () => {
    const nav = fixture.nativeElement as HTMLElement;
    const lastButton = nav.querySelector<HTMLButtonElement>('button[aria-label="Last page"]');
    if (!lastButton) {
      throw new Error('No "Last page" button');
    }
    lastButton.click();
    fixture.detectChanges();

    expect(host.page()).toBe(12);
    expect(typeof host.page()).toBe('number');
    // The full state still arrives on the separate (paginate) output.
    expect(host.last()).toMatchObject({ page: 12, first: 110, last: 120 });
  });
});

describe('Paginator copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'paginator.nextPageLabel': 'customer.nextPage' }),
      ],
    });
    const fixture = TestBed.createComponent(Paginator);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { nextPage: 'Onward' } }, 'en', { merge: true });
    fixture.componentRef.setInput('totalRecords', 95);
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('paginator/en'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('button[aria-label="Onward"]')).not.toBeNull();
  });
});

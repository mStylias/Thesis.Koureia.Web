/**
 * Where the progress bar is drawn, which is the header's bottom edge: the
 * boundary the replaced rows appear below, and a place that stays put while
 * they scroll — and when the first load draws a skeleton instead.
 */
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { describe, expect, it, beforeEach } from 'vitest';
import { Datagrid } from './datagrid';
import type { ColumnDef } from './core/types/column.types';
import type { GridDataSource, Query, QueryResult } from './core/types/query.types';

interface Row {
  id: number;
  name: string;
  city: string;
}

const ROWS: Row[] = [
  { id: 1, name: 'Anna', city: 'Nicosia' },
  { id: 2, name: 'Basil', city: 'Limassol' },
];

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'city', field: 'city', caption: 'City', width: 150 },
];

/** A source whose loads can be held open one at a time. */
class HeldSource implements GridDataSource<Row> {
  readonly queries: Query[] = [];
  private release: (() => void) | null = null;
  hold = false;

  load(query: Query): Promise<QueryResult<Row>> {
    this.queries.push(query);
    const answer: QueryResult<Row> = { rows: ROWS, totalCount: ROWS.length };
    if (!this.hold) {
      return Promise.resolve(answer);
    }
    return new Promise((resolve) => {
      this.release = () => {
        resolve(answer);
      };
    });
  }

  releaseHeld(): void {
    this.release?.();
    this.release = null;
  }
}

@Component({
  selector: 'lib-datagrid-loading-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      key="id"
      ariaLabel="Rows"
      [columns]="columns"
      [data]="source"
      [filter]="filter()"
      [view]="view()"
    />
  `,
})
class Host {
  readonly columns = COLUMNS;
  readonly source = new HeldSource();
  readonly filter = signal<{ field: string; op: 'eq'; value: string } | null>(null);
  readonly view = signal<'table' | 'cards' | 'auto'>('auto');
}

describe('the datagrid progress bar', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Runs the pending load far enough to render, without answering it. */
  async function reachPendingLoad(): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      fixture.detectChanges();
    }
  }

  function bar(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dg-header-loading');
  }

  /** The card list's own bar, which holds the edge the header's does. */
  function cardBar(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dg-cards-loading');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
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
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  it('reports a load whose result the user is waiting to see', async () => {
    fixture.componentInstance.source.hold = true;

    fixture.componentInstance.filter.set({ field: 'name', op: 'eq', value: 'Anna' });
    await reachPendingLoad();

    expect(bar()).not.toBeNull();

    fixture.componentInstance.source.releaseHeld();
    await settle();
  });

  it('reports it on the card list too, which has no header to carry it', async () => {
    fixture.componentInstance.view.set('cards');
    await settle();
    expect(bar()).toBeNull();

    fixture.componentInstance.source.hold = true;
    fixture.componentInstance.filter.set({ field: 'name', op: 'eq', value: 'Anna' });
    await reachPendingLoad();

    expect(cardBar()).not.toBeNull();

    fixture.componentInstance.source.releaseHeld();
    await settle();

    expect(cardBar()).toBeNull();
  });
});

/** Two rows at one per page, so a second page exists to press. */
@Component({
  selector: 'lib-datagrid-pager-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      key="id"
      ariaLabel="Rows"
      pagingMode="pager"
      [pageSize]="1"
      [columns]="columns"
      [data]="source"
      [filter]="filter()"
    />
  `,
})
class PagerHost {
  readonly columns = COLUMNS;
  readonly source = new HeldSource();
  readonly filter = signal<{ field: string; op: 'eq'; value: string } | null>(null);
}

describe('the pager while a load runs', () => {
  let fixture: ComponentFixture<PagerHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagerHost],
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
    }).compileComponents();
    fixture = TestBed.createComponent(PagerHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function link(label: string): HTMLElement {
    const found = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.paginator-pages button',
      ),
    ].find((button) => button.textContent.trim() === label);
    if (found == null) {
      throw new Error(`page ${label} link not rendered`);
    }
    return found;
  }

  it('stays live, so a request does not dim it', async () => {
    expect(link('2').hasAttribute('disabled')).toBe(false);

    fixture.componentInstance.source.hold = true;
    fixture.componentInstance.filter.set({ field: 'name', op: 'eq', value: 'Anna' });
    for (let pass = 0; pass < 3; pass++) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      fixture.detectChanges();
    }

    // A pager that greys out on every request flashes: most answer faster
    // than the eye reads the change.
    expect(link('2').hasAttribute('disabled')).toBe(false);
    expect(link('2').getAttribute('aria-disabled')).toBeNull();

    fixture.componentInstance.source.releaseHeld();
    await fixture.whenStable();
  });
});

describe('the initial-load skeleton', () => {
  async function mount(): Promise<ComponentFixture<Host>> {
    await TestBed.configureTestingModule({
      imports: [Host],
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
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    // Set before the first pass, which is what issues the first load.
    fixture.componentInstance.source.hold = true;
    fixture.detectChanges();
    return fixture;
  }

  function skeletons(fixture: ComponentFixture<Host>): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.dg-row-skeleton').length;
  }

  function rows(fixture: ComponentFixture<Host>): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.dg-row:not(.dg-row-skeleton)')
      .length;
  }

  function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  it('is drawn from the first frames, so the grid never shows empty', async () => {
    const fixture = await mount();
    for (let pass = 0; pass < 3; pass++) {
      await wait(0);
      fixture.detectChanges();
    }

    expect(skeletons(fixture)).toBeGreaterThan(0);

    fixture.componentInstance.source.releaseHeld();
    await fixture.whenStable();
  });

  it('stays up for its floor when the response is fast', async () => {
    const fixture = await mount();
    await wait(0);
    fixture.detectChanges();

    fixture.componentInstance.source.releaseHeld();
    await wait(60);
    fixture.detectChanges();
    // The response has landed; the floor is what keeps the shape up, and the
    // rows arrive with it rather than under it.
    expect(skeletons(fixture)).toBeGreaterThan(0);
    expect(rows(fixture)).toBe(0);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(skeletons(fixture)).toBe(0);
    expect(rows(fixture)).toBe(ROWS.length);
  });
});

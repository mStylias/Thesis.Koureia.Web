/**
 * Which page-size control the footer draws, which is decided by the width the
 * row has: buttons where every size can be one press, a selector where it
 * cannot.
 */
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { Datagrid } from './datagrid';
import type { ColumnDef } from './core/types/column.types';

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  name: `Row ${(index + 1).toString()}`,
}));

const COLUMNS: ColumnDef<Row>[] = [{ id: 'name', field: 'name', caption: 'Name', width: 200 }];

@Component({
  selector: 'lib-datagrid-page-size-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      key="id"
      ariaLabel="Rows"
      pagingMode="pager"
      [columns]="columns"
      [data]="data"
      [pageSize]="10"
      [pageSizes]="pageSizes()"
    />
  `,
})
class Host {
  readonly columns = COLUMNS;
  readonly data = ROWS;
  readonly pageSizes = signal<readonly number[]>([10, 25, 50]);
}

describe('the footer page-size control', () => {
  let viewportWidth = 900;

  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe(): void {
        /* layout is stubbed */
      }
      unobserve(): void {
        /* layout is stubbed */
      }
      disconnect(): void {
        /* layout is stubbed */
      }
    };
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: (): number => viewportWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: (): number => 400,
    });
  });

  beforeEach(() => {
    viewportWidth = 900;
  });

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
    for (let pass = 0; pass < 3; pass++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
    return fixture;
  }

  function buttons(fixture: ComponentFixture<Host>): string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.dg-page-sizes button',
      ),
    ].map((button) => button.textContent.trim());
  }

  function selector(fixture: ComponentFixture<Host>): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.dg-page-size');
  }

  it('draws a button per size where the row has the width for them', async () => {
    const fixture = await mount();

    expect(buttons(fixture)).toEqual(['10', '25', '50']);
    expect(selector(fixture)).toBeNull();
  });

  it('gathers them into a selector where it has not', async () => {
    // Under the pager's own share plus a button per size, so the row can
    // afford one control rather than four.
    viewportWidth = 420;
    const fixture = await mount();

    expect(buttons(fixture)).toHaveLength(0);
    expect(selector(fixture)).not.toBeNull();
  });

  it('keeps the buttons for fewer sizes at a width that would not hold more', async () => {
    viewportWidth = 420;
    const fixture = await mount();
    expect(selector(fixture)).not.toBeNull();

    fixture.componentInstance.pageSizes.set([10]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(buttons(fixture)).toEqual(['10']);
  });
});

import { Component, computed, getDebugNode, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Tooltip } from '@ui/tooltip';

import { DatagridCellLayout } from '../core/cell-layout';
import type { CellContext } from '../core/types/context.types';
import { tagColumn } from './columns';
import { DatagridTagCell } from './datagrid-tag-cell';
import type { TagMetrics } from './datagrid-tag-cell.types';

const LABELS = ['Δημήτρης Π.', 'Μαρία Κ.', 'Σωτήρης Δ.'];

/** 6px per character, so a spec can count widths. jsdom draws no canvas. */
const METRICS: TagMetrics = {
  font: '12px sans-serif',
  letterSpacing: 'normal',
  tagPadding: 16,
  gap: 4,
  cellPadding: 24,
};

const COLUMN = tagColumn<unknown>({ id: 'barbers', field: 'staff' });

@Component({
  imports: [DatagridTagCell],
  template: `<lib-datagrid-tag-cell [context]="context" />`,
})
class Host {
  readonly context = {
    row: {},
    key: 'r1',
    rowIndex: 0,
    column: COLUMN,
    value: LABELS,
    displayValue: LABELS,
    state: { selected: false, expanded: false, editing: false, focused: false },
    api: {},
  } as unknown as CellContext;
}

describe('DatagridTagCell', () => {
  let fixture: ComponentFixture<Host>;
  const width = signal(150);
  const cards = signal(false);

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        font: '',
        letterSpacing: '',
        measureText: (text: string) => ({ width: text.length * 6 }),
      } as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  async function render(): Promise<void> {
    TestBed.configureTestingModule({ providers: [DatagridCellLayout] });
    const layout = TestBed.inject(DatagridCellLayout);
    layout.bind({
      widths: computed(() => new Map([['barbers', width()]])),
      cards,
      density: signal('standard'),
    });
    layout.record('tag:standard', METRICS);
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function tags(): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.dg-tag')];
  }

  it('draws every tag, and no "+n", when the column has room', async () => {
    width.set(400);
    await render();

    expect(tags().map((tag) => tag.textContent.trim())).toEqual(LABELS);
  });

  it('collapses only the tags that do not fit, and names them in the "+n" tooltip', async () => {
    width.set(150);
    await render();

    expect(tags().map((tag) => tag.textContent.trim())).toEqual(['Δημήτρης Π.', '+2']);
    const more = tags().at(-1);
    if (more === undefined) throw new Error('"+n" tag not rendered');
    expect(getDebugNode(more)?.injector.get(Tooltip).libTooltip()).toBe('Μαρία Κ., Σωτήρης Δ.');
  });

  it('wraps and draws every tag in cards', async () => {
    width.set(150);
    cards.set(true);
    await render();

    expect(tags().map((tag) => tag.textContent.trim())).toEqual(LABELS);
    const host = (fixture.nativeElement as HTMLElement).querySelector('lib-datagrid-tag-cell');
    expect(host?.hasAttribute('data-wrap')).toBe(true);
    cards.set(false);
  });
});

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { DETAIL_COLUMN_ID } from './core/builtin-columns';
import { Datagrid } from './datagrid';
import { DatagridDetailTemplate, DatagridGroupTemplate } from './datagrid-templates';
import type { SummaryConfig } from './core/types/config.types';
import type { ColumnDef } from './core/types/column.types';
import type { GridEvent } from './core/types/event.types';
import type { GridKey } from './core/types/key.types';
import type { GridDataSource, GroupResult, GroupSpec, QueryResult } from './core/types/query.types';

interface Row {
  id: number;
  name: string;
  city: string;
  team: string;
  score: number;
}

// jsdom performs no layout, so the viewport reports its size from here and the
// specs assert window math and rendered keys rather than pixels.
const VIEWPORT_HEIGHT = 600;
const VIEWPORT_WIDTH = 900;

const CITIES = ['Nicosia', 'Limassol'];
const TEAMS = ['A', 'B'];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    name: `Row ${(index + 1).toString()}`,
    city: CITIES[index % CITIES.length],
    team: TEAMS[Math.floor(index / 2) % TEAMS.length],
    score: (index + 1) * 10,
  }));
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'city', field: 'city', caption: 'City', width: 150 },
  { id: 'team', field: 'team', caption: 'Team', width: 100 },
  { id: 'score', field: 'score', caption: 'Score', width: 100 },
];

@Component({
  selector: 'lib-datagrid-grouping-host',
  imports: [Datagrid, DatagridDetailTemplate, DatagridGroupTemplate],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      key="id"
      [rowHeight]="40"
      [groupRowHeight]="32"
      [detailHeight]="200"
      [overscan]="0"
      [(group)]="group"
      [groupPanel]="groupPanel()"
      [groupable]="groupable()"
      [groupDefaultExpanded]="groupDefaultExpanded()"
      [summaries]="summaries()"
      [detailMode]="detailMode()"
      [(expandedKeys)]="expandedKeys"
      (gridEvent)="events.update((all) => [...all, $event])"
    >
      @if (withDetail()) {
        <ng-template libDatagridDetail let-detail>
          <p class="demo-detail">Detail for row {{ detail.key }}</p>
        </ng-template>
      }
      @if (withGroupTemplate()) {
        <ng-template libDatagridGroup="city" let-group>
          <span class="demo-group">{{ group.displayValue }} / {{ group.count }}</span>
        </ng-template>
      }
    </lib-datagrid>
  `,
})
class Host {
  readonly columns = signal<ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<readonly Row[] | GridDataSource<Row>>(makeRows(8));
  readonly group = signal<readonly GroupSpec[]>([]);
  readonly groupPanel = signal(false);
  readonly groupable = signal(true);
  readonly groupDefaultExpanded = signal(true);
  readonly summaries = signal<readonly SummaryConfig[]>([]);
  readonly withDetail = signal(false);
  readonly withGroupTemplate = signal(false);
  readonly detailMode = signal<'single' | 'multiple'>('multiple');
  readonly expandedKeys = signal<readonly GridKey[]>([]);
  readonly events = signal<readonly GridEvent<Row>[]>([]);
}

describe('Datagrid grouping, aggregation and row detail', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function grid(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('lib-datagrid');
    if (found == null) {
      throw new Error('grid not rendered');
    }
    return found;
  }

  function viewport(): HTMLElement {
    const found = grid().querySelector<HTMLElement>('.dg-viewport');
    if (found == null) {
      throw new Error('viewport not rendered');
    }
    return found;
  }

  function bodyRows(): HTMLElement[] {
    return [
      ...viewport().querySelectorAll<HTMLElement>('lib-datagrid-body [role="row"][data-key]'),
    ];
  }

  function rowKinds(): string[] {
    return bodyRows().map((row) => row.getAttribute('data-row-kind') ?? 'data');
  }

  function groupRows(): HTMLElement[] {
    return bodyRows().filter((row) => row.getAttribute('data-row-kind') === 'group');
  }

  function groupLabels(): string[] {
    return groupRows().map((row) => row.textContent.replace(/\s+/g, ' ').trim());
  }

  function dataRowKeys(): string[] {
    return bodyRows()
      .filter((row) => row.getAttribute('data-row-kind') == null)
      .map((row) => row.getAttribute('data-key') ?? '');
  }

  function cellOf(row: HTMLElement, columnId: string): HTMLElement {
    const found = row.querySelector<HTMLElement>(`[role="gridcell"][data-column="${columnId}"]`);
    if (found == null) {
      throw new Error(`cell ${columnId} not rendered`);
    }
    return found;
  }

  function rowOf(key: string): HTMLElement {
    const found = viewport().querySelector<HTMLElement>(`[role="row"][data-key="${key}"]`);
    if (found == null) {
      throw new Error(`row ${key} not rendered`);
    }
    return found;
  }

  function press(element: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  }

  function headerCell(columnId: string): HTMLElement {
    const found = viewport().querySelector<HTMLElement>(
      `[role="columnheader"][data-column="${columnId}"]`,
    );
    if (found == null) {
      throw new Error(`header ${columnId} not rendered`);
    }
    return found;
  }

  function footerCells(): HTMLElement[] {
    return [...grid().querySelectorAll<HTMLElement>('lib-datagrid-footer [role="gridcell"]')];
  }

  /** The grid component instance, for the imperative API and its outputs. */
  function gridComponent(): Datagrid<Row> {
    return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
  }

  function panel(): HTMLElement {
    const found = grid().querySelector<HTMLElement>('lib-datagrid-group-panel');
    if (found == null) {
      throw new Error('group panel not rendered');
    }
    return found;
  }

  function headerOrder(): string[] {
    return [...viewport().querySelectorAll<HTMLElement>('[role="columnheader"]')].map(
      (cell) => cell.getAttribute('data-column') ?? '',
    );
  }

  /**
   * Drags a header straight up onto the group panel.
   *
   * jsdom lays nothing out, so the two rects the gesture depends on are stubbed
   * — the panel above the header, the header below it — and the pointer walks
   * between them. Movement is vertical on purpose: a drag onto the panel barely
   * travels sideways, which is the case the threshold used to refuse.
   */
  async function dragHeaderToPanel(
    columnId: string,
    options: { release?: boolean } = {},
  ): Promise<{ dropActiveWhileOver: boolean; ghostSeen: boolean }> {
    const header = grid().querySelector<HTMLElement>('lib-datagrid-header');
    const cell = headerCell(columnId);
    if (header == null) {
      throw new Error('header not rendered');
    }
    stubRect(panel(), { top: 0, bottom: 40, left: 0, right: 900 });
    stubRect(header, { top: 40, bottom: 84, left: 0, right: 900 });
    stubRect(cell, { top: 40, bottom: 84, left: 100, right: 250 });
    const send = (target: HTMLElement, type: string, y: number): void => {
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: 160,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    send(cell, 'pointerdown', 62);
    await settle();
    let dropActiveWhileOver = false;
    let ghostSeen = false;
    for (const y of [50, 30, 20]) {
      send(header, 'pointermove', y);
      await settle();
      dropActiveWhileOver ||= panel().hasAttribute('data-drop-active');
      ghostSeen ||= grid().querySelector('.dg-drag-ghost') != null;
    }
    if (options.release !== false) {
      send(header, 'pointerup', 20);
      await settle();
    }
    return { dropActiveWhileOver, ghostSeen };
  }

  /** jsdom reports a zero rect for everything; the gesture needs real numbers. */
  function stubRect(
    element: HTMLElement,
    box: { top: number; bottom: number; left: number; right: number },
  ): void {
    const rect: DOMRect = {
      ...box,
      x: box.left,
      y: box.top,
      width: box.right - box.left,
      height: box.bottom - box.top,
      toJSON: () => box,
    };
    element.getBoundingClientRect = (): DOMRect => rect;
  }

  function liveMessage(): string {
    return grid().querySelector<HTMLElement>('.dg-live')?.textContent.trim() ?? '';
  }

  beforeEach(async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => VIEWPORT_WIDTH,
    });
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([]),
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
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle();
  });

  describe('group rows', () => {
    it('renders no group rows while the grid is ungrouped', async () => {
      await settle();
      expect(groupRows()).toHaveLength(0);
      expect(dataRowKeys()).toHaveLength(8);
    });

    it('inserts a header before each group', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      // The parts are separate elements a flex gap spaces, so the text runs
      // together while the label reads correctly on screen.
      expect(groupLabels()).toEqual(['City:Limassol(4)', 'City:Nicosia(4)']);
    });

    it('orders the rows under their own group', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      expect(rowKinds().slice(0, 3)).toEqual(['group', 'data', 'data']);
    });

    it('nests one header level per criterion', async () => {
      host.group.set([{ field: 'city' }, { field: 'team' }]);
      await settle();
      const levels = groupRows().map((row) => row.getAttribute('data-level'));
      expect(levels).toContain('0');
      expect(levels).toContain('1');
    });

    it('collapses a group to its header alone on click', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      const label = groupRows()[0].querySelector<HTMLElement>('.dg-group-label');
      label?.click();
      await settle();
      expect(dataRowKeys()).toHaveLength(4);
      expect(groupRows()[0].getAttribute('aria-expanded')).toBe('false');
    });

    it('starts collapsed when the default says so', async () => {
      host.groupDefaultExpanded.set(false);
      host.group.set([{ field: 'city' }]);
      await settle();
      expect(dataRowKeys()).toHaveLength(0);
      expect(groupRows()).toHaveLength(2);
    });

    it('reports the level through aria-level, one-based', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      expect(groupRows()[0].getAttribute('aria-level')).toBe('1');
    });

    it('becomes a treegrid while grouped', async () => {
      expect(viewport().getAttribute('role')).toBe('grid');
      host.group.set([{ field: 'city' }]);
      await settle();
      expect(viewport().getAttribute('role')).toBe('treegrid');
    });

    it('counts the flattened body in aria-rowcount', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      // Eight rows plus two group headers plus the header row.
      expect(viewport().getAttribute('aria-rowcount')).toBe('11');
    });

    it('renders a group template in place of the default label', async () => {
      host.withGroupTemplate.set(true);
      host.group.set([{ field: 'city' }]);
      await settle();
      expect(groupRows()[0].querySelector('.demo-group')?.textContent.trim()).toBe('Limassol / 4');
    });
  });

  describe('grouping the columns', () => {
    it('groups from the header menu', async () => {
      headerCell('city').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      );
      await settle();
      const items = [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
        item.textContent.trim(),
      );
      expect(items).toContain('Group by this column');
    });

    it('withholds the grouping entries for a column that refuses grouping', async () => {
      host.columns.set(
        COLUMNS.map((column) =>
          column.id === 'city' ? { ...column, allow: { grouping: false } } : column,
        ),
      );
      await settle();
      headerCell('city').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      );
      await settle();
      const items = [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
        item.textContent.trim(),
      );
      expect(items).not.toContain('Group by this column');
    });

    it('refuses a level for a column that refuses grouping, whatever the path', async () => {
      host.columns.set(
        COLUMNS.map((column) =>
          column.id === 'city' ? { ...column, allow: { grouping: false } } : column,
        ),
      );
      await settle();
      gridComponent()
        .api()
        .setGroup([{ field: 'city' }]);
      await settle();
      expect(host.group()).toEqual([]);
    });

    it('announces the grouping', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      gridComponent()
        .api()
        .setGroup([{ field: 'team' }]);
      await settle();
      expect(liveMessage()).toBe('Grouped by Team');
    });

    it('emits groupChanged once the grouping actually changes', async () => {
      host.events.set([]);
      host.group.set([{ field: 'city' }]);
      await settle();
      const names = host.events().map((event) => event.name);
      expect(names.filter((name) => name === 'groupChanged')).toHaveLength(1);
    });

    it('shows the panel with a chip per level', async () => {
      host.groupPanel.set(true);
      host.group.set([{ field: 'city' }, { field: 'team' }]);
      await settle();
      const chips = [...grid().querySelectorAll<HTMLElement>('.dg-group-chip')];
      expect(chips.map((chip) => chip.textContent.replace(/\s+/g, ' ').trim())).toEqual([
        '1City',
        '2Team',
      ]);
    });

    it('removes a level from the panel', async () => {
      host.groupPanel.set(true);
      host.group.set([{ field: 'city' }]);
      await settle();
      grid().querySelector<HTMLElement>('.dg-chip-remove')?.click();
      await settle();
      expect(host.group()).toEqual([]);
    });

    it('flips a level direction from the panel', async () => {
      host.groupPanel.set(true);
      host.group.set([{ field: 'city' }]);
      await settle();
      grid().querySelector<HTMLElement>('.dg-chip-direction')?.click();
      await settle();
      expect(host.group()).toEqual([{ field: 'city', desc: true }]);
      expect(groupLabels()[0]).toContain('Nicosia');
    });

    it('shows a hint instead of chips while nothing is grouped', async () => {
      host.groupPanel.set(true);
      await settle();
      expect(grid().querySelector('.dg-group-hint')).not.toBeNull();
    });

    // The regression is the whole chain: a drag straight up has to start at
    // all, the shell has to find the panel, and the drop has to group rather
    // than reorder. It failed at each of those three points in turn.
    it('groups a column dragged onto the panel', async () => {
      host.groupPanel.set(true);
      await settle();
      await dragHeaderToPanel('city');
      expect(host.group()).toEqual([{ field: 'city' }]);
    });

    it('marks the panel as a live drop target while the drag is over it', async () => {
      host.groupPanel.set(true);
      await settle();
      const states = await dragHeaderToPanel('city', { release: false });
      expect(states.dropActiveWhileOver).toBe(true);
      expect(panel().hasAttribute('data-drop-active')).toBe(true);
    });

    it('carries a ghost that leaves the header row', async () => {
      host.groupPanel.set(true);
      await settle();
      const states = await dragHeaderToPanel('city', { release: false });
      expect(states.ghostSeen).toBe(true);
      // The ghost is drawn by the shell, not the header, so nothing clips it.
      expect(grid().querySelector('lib-datagrid-header .dg-drag-ghost')).toBeNull();
      expect(grid().querySelector(':scope > .dg-drag-ghost')).not.toBeNull();
    });

    it('does not reorder the column it grouped', async () => {
      host.groupPanel.set(true);
      await settle();
      const before = headerOrder();
      await dragHeaderToPanel('city');
      expect(headerOrder()).toEqual(before);
    });

    it('refuses the drop for a column that refuses grouping', async () => {
      host.columns.set(
        COLUMNS.map((column) =>
          column.id === 'city' ? { ...column, allow: { grouping: false } } : column,
        ),
      );
      host.groupPanel.set(true);
      await settle();
      await dragHeaderToPanel('city');
      expect(host.group()).toEqual([]);
    });
  });

  describe('keyboard', () => {
    it('collapses a group with ArrowLeft and expands it with ArrowRight', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      const label = groupRows()[0].querySelector<HTMLElement>('.dg-group-label');
      if (label == null) {
        throw new Error('group label not rendered');
      }
      label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(label, 'ArrowLeft');
      await settle();
      expect(dataRowKeys()).toHaveLength(4);
      press(groupRows()[0].querySelector<HTMLElement>('.dg-group-label') ?? label, 'ArrowRight');
      await settle();
      expect(dataRowKeys()).toHaveLength(8);
    });

    it('toggles a group with Enter', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      const label = groupRows()[0].querySelector<HTMLElement>('.dg-group-label');
      if (label == null) {
        throw new Error('group label not rendered');
      }
      label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(label, 'Enter');
      await settle();
      expect(groupRows()[0].getAttribute('aria-expanded')).toBe('false');
    });

    it('walks from a group row down into its first data row', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      const label = groupRows()[0].querySelector<HTMLElement>('.dg-group-label');
      if (label == null) {
        throw new Error('group label not rendered');
      }
      label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(label, 'ArrowDown');
      await settle();
      const focused = viewport().querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
      expect(focused?.closest('[role="row"]')?.getAttribute('data-row-kind')).toBeNull();
    });

    it('announces an expansion', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      groupRows()[0].querySelector<HTMLElement>('.dg-group-label')?.click();
      await settle();
      expect(liveMessage()).toBe('Group Limassol collapsed');
    });

    // A group row draws one label cell whichever column the walk came from.
    // Matching the focused cell by column id alone finds nothing there, and
    // the walk would dead-end on every column but the first.
    it('walks up into a group row from a column other than the first', async () => {
      host.group.set([{ field: 'city' }]);
      await settle();
      const second = dataRowKeys()[1];
      const cell = cellOf(rowOf(second), 'team');
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(cell, 'ArrowUp');
      await settle();
      press(
        viewport().querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]') ?? cell,
        'ArrowUp',
      );
      await settle();

      const focused = viewport().querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');
      expect(focused?.closest('[role="row"]')?.getAttribute('data-row-kind')).toBe('group');
      expect(document.activeElement).toBe(focused);
    });
  });

  describe('aggregation', () => {
    it('renders a total footer under the summarized column', async () => {
      host.summaries.set([{ field: 'score', type: 'sum' }]);
      await settle();
      const cells = footerCells();
      expect(cells).toHaveLength(4);
      expect(cells[3].textContent.trim()).toBe('360');
      expect(cells[0].textContent.trim()).toBe('');
    });

    it('draws no footer without a total summary', async () => {
      host.summaries.set([{ field: 'score', type: 'sum', scope: 'group' }]);
      await settle();
      expect(footerCells()).toHaveLength(0);
    });

    it('applies the display format to a total', async () => {
      host.summaries.set([{ field: 'score', type: 'sum', displayFormat: 'Sum: {0}' }]);
      await settle();
      expect(footerCells()[3].textContent.trim()).toBe('Sum: 360');
    });

    it('renders a group aggregate inline in the header by default', async () => {
      host.group.set([{ field: 'city' }]);
      host.summaries.set([{ field: 'score', type: 'sum', scope: 'group' }]);
      await settle();
      expect(groupLabels()[0]).toContain('Sum');
      expect(groupLabels()[0]).toContain('200');
    });

    it('renders a group aggregate in a footer row when asked', async () => {
      host.group.set([{ field: 'city' }]);
      host.summaries.set([{ field: 'score', type: 'sum', scope: 'group', placement: 'footer' }]);
      await settle();
      expect(rowKinds().filter((kind) => kind === 'group-footer')).toHaveLength(2);
      const footer = bodyRows().find((row) => row.getAttribute('data-row-kind') === 'group-footer');
      expect(cellOf(footer ?? bodyRows()[0], 'score').textContent.trim()).toBe('200');
    });

    it('aligns a group aggregate under its column in the header row', async () => {
      host.group.set([{ field: 'city' }]);
      host.summaries.set([{ field: 'score', type: 'sum', scope: 'group', placement: 'column' }]);
      await settle();
      expect(cellOf(groupRows()[0], 'score').textContent.trim()).toBe('200');
    });

    it('computes a custom aggregate from the summary own function', async () => {
      host.summaries.set([
        {
          field: 'score',
          type: 'custom',
          custom: 'top',
          calculate: (values) => Math.max(...values.map(Number)),
        },
      ]);
      await settle();
      expect(footerCells()[3].textContent.trim()).toBe('80');
    });

    it('averages', async () => {
      host.summaries.set([{ field: 'score', type: 'avg' }]);
      await settle();
      expect(footerCells()[3].textContent.trim()).toBe('45');
    });
  });

  describe('row detail', () => {
    it('adds no expander column without a detail renderer', async () => {
      await settle();
      expect(viewport().querySelector(`[data-column="${DETAIL_COLUMN_ID}"]`)).toBeNull();
    });

    it('adds the expander column when a renderer is declared', async () => {
      host.withDetail.set(true);
      await settle();
      expect(viewport().querySelector(`[data-column="${DETAIL_COLUMN_ID}"]`)).not.toBeNull();
    });

    // The expander header is one of the grid's own, not a data header: it
    // must not print the internal id as a caption, offer a menu, or reach a
    // screen reader unnamed.
    it('draws the expander header as a built-in, named and without a menu', async () => {
      host.withDetail.set(true);
      await settle();
      const header = headerCell(DETAIL_COLUMN_ID);
      expect(header.getAttribute('data-kind')).toBe('detailToggle');
      expect(header.textContent.trim()).toBe('');
      expect(header.getAttribute('aria-label')).toBe('Row details');
      expect(header.querySelector('[data-column-menu]')).toBeNull();

      press(header, 'ArrowDown', { altKey: true });
      await settle();
      expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it('names the row number header', async () => {
      gridComponent().showRowNumbers.set(true);
      await settle();
      expect(headerCell('lib-datagrid:row-number').getAttribute('aria-label')).toBe('Row number');
    });

    // The expander sits before the host columns, so a reorder that does not
    // subtract it lands one slot late and can never reach the first.
    it('moves a host column to the first slot while the expander is present', async () => {
      host.withDetail.set(true);
      await settle();
      gridComponent().api().moveColumn('score', 0);
      await settle();
      expect(headerOrder()).toEqual([DETAIL_COLUMN_ID, 'score', 'name', 'city', 'team']);
    });

    it('instantiates the detail only once the row is expanded', async () => {
      host.withDetail.set(true);
      await settle();
      expect(grid().querySelector('.demo-detail')).toBeNull();
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      expect(grid().querySelector('.demo-detail')?.textContent.trim()).toBe('Detail for row 1');
    });

    it('destroys the detail on collapse', async () => {
      host.withDetail.set(true);
      await settle();
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      expect(grid().querySelector('.demo-detail')).toBeNull();
    });

    it('writes the two-way expanded keys', async () => {
      host.withDetail.set(true);
      await settle();
      cellOf(rowOf('2'), DETAIL_COLUMN_ID).click();
      await settle();
      expect(host.expandedKeys()).toEqual([2]);
    });

    it('keeps one row open in single mode', async () => {
      host.withDetail.set(true);
      host.detailMode.set('single');
      await settle();
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      cellOf(rowOf('2'), DETAIL_COLUMN_ID).click();
      await settle();
      expect(host.expandedKeys()).toEqual([2]);
    });

    it('reports expansion on the expander cell', async () => {
      host.withDetail.set(true);
      await settle();
      expect(cellOf(rowOf('1'), DETAIL_COLUMN_ID).getAttribute('aria-expanded')).toBe('false');
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      expect(cellOf(rowOf('1'), DETAIL_COLUMN_ID).getAttribute('aria-expanded')).toBe('true');
    });

    it('opens with ArrowRight and closes with ArrowLeft', async () => {
      host.withDetail.set(true);
      await settle();
      const cell = cellOf(rowOf('1'), DETAIL_COLUMN_ID);
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(cell, 'ArrowRight');
      await settle();
      expect(host.expandedKeys()).toEqual([1]);
      press(cellOf(rowOf('1'), DETAIL_COLUMN_ID), 'ArrowLeft');
      await settle();
      expect(host.expandedKeys()).toEqual([]);
    });

    it('emits the expanding and expanded pair', async () => {
      host.withDetail.set(true);
      await settle();
      host.events.set([]);
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      const names = host.events().map((event) => event.name);
      expect(names).toContain('rowExpanding');
      expect(names).toContain('rowExpanded');
    });

    it('refuses an expansion a handler vetoed', async () => {
      host.withDetail.set(true);
      await settle();
      const subscription = gridComponent().rowExpanding.subscribe((event) => {
        event.canceled = true;
      });
      cellOf(rowOf('1'), DETAIL_COLUMN_ID).click();
      await settle();
      subscription.unsubscribe();
      expect(host.expandedKeys()).toEqual([]);
      expect(grid().querySelector('.demo-detail')).toBeNull();
    });

    it('drops an expansion whose row vanished from the data', async () => {
      host.withDetail.set(true);
      await settle();
      cellOf(rowOf('8'), DETAIL_COLUMN_ID).click();
      await settle();
      expect(host.expandedKeys()).toEqual([8]);
      host.data.set(makeRows(4));
      await settle();
      expect(host.expandedKeys()).toEqual([]);
    });
  });

  describe('state', () => {
    it('round-trips the grouping', async () => {
      const api = gridComponent().api();
      host.group.set([{ field: 'city' }]);
      await settle();
      const saved = api.getState();
      expect(saved.grouping).toEqual([{ field: 'city' }]);
      host.group.set([]);
      await settle();
      api.setState(saved);
      await settle();
      expect(host.group()).toEqual([{ field: 'city' }]);
      expect(groupRows()).toHaveLength(2);
    });

    it('records the level on the column entry as well', async () => {
      const api = gridComponent().api();
      host.group.set([{ field: 'team' }, { field: 'city' }]);
      await settle();
      const columns = api.getState().columns;
      expect(columns.find((entry) => entry.id === 'team')?.group).toEqual({ index: 0 });
      expect(columns.find((entry) => entry.id === 'city')?.group).toEqual({ index: 1 });
    });
  });

  describe('remote grouping', () => {
    it('renders the hierarchy a source returned rather than regrouping', async () => {
      const groups: GroupResult<Row>[] = [
        { key: 'Remote A', items: makeRows(2), count: 40, aggregates: { 'score:sum': 999 } },
      ];
      const source: GridDataSource<Row> = {
        load: (): Promise<QueryResult<Row>> =>
          Promise.resolve({ rows: makeRows(2), groups, totalCount: 40 }),
      };
      host.data.set(source);
      host.group.set([{ field: 'city' }]);
      host.summaries.set([{ field: 'score', type: 'sum', scope: 'group' }]);
      await settle();
      expect(groupLabels()[0]).toContain('Remote A');
      expect(groupLabels()[0]).toContain('(40)');
      expect(groupLabels()[0]).toContain('999');
    });
  });
});

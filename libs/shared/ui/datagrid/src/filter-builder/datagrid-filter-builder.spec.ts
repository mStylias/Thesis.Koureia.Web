import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { DatagridFilterBuilder } from './datagrid-filter-builder';
import { and, not, or, where } from '../core/filter/filter-node';
import { filterOperatorsForType } from '../core/filter/operators';
import type { FilterNode } from '../core/types/filter.types';
import type { DatagridFilterField } from '../datagrid.types';

const FIELDS: DatagridFilterField[] = [
  {
    field: 'name',
    caption: 'Name',
    editor: 'text',
    operators: filterOperatorsForType('string'),
  },
  {
    field: 'score',
    caption: 'Score',
    editor: 'number',
    operators: filterOperatorsForType('number'),
  },
];

@Component({
  selector: 'lib-builder-host',
  imports: [DatagridFilterBuilder],
  template: `<lib-datagrid-filter-builder
    [fields]="fields()"
    [value]="value()"
    [otherFilterCount]="otherFilterCount()"
    (applied)="applied.set($event)"
    (canceled)="canceledCount.set(canceledCount() + 1)"
  />`,
})
class Host {
  readonly fields = signal<DatagridFilterField[]>(FIELDS);
  readonly value = signal<FilterNode | null>(null);
  readonly otherFilterCount = signal(0);
  readonly applied = signal<FilterNode | null | undefined>(undefined);
  readonly canceledCount = signal(0);
}

describe('DatagridFilterBuilder', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function queryAll(selector: string): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>(selector)];
  }

  function query(selector: string): HTMLElement {
    const found = root().querySelector<HTMLElement>(selector);
    if (found == null) {
      throw new Error(`${selector} not rendered`);
    }
    return found;
  }

  /** One of the editor's own buttons. Named by class: the test loads no
   *  dictionary, so the visible text is the message key. */
  function button(name: string): HTMLElement {
    return query(`.dg-fb-${name}`);
  }

  function conditions(): HTMLElement[] {
    return queryAll('.dg-fb-condition');
  }

  function textEditor(index = 0): HTMLInputElement {
    const found = conditions()[index]?.querySelector<HTMLInputElement>('input[type="text"]');
    if (found == null) {
      throw new Error(`condition ${index.toString()} has no text editor`);
    }
    return found;
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

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
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  it('opens on an empty expression and says so', () => {
    expect(conditions()).toHaveLength(0);
    expect(query('.dg-fb-hint')).toBeTruthy();
  });

  it('names the region and every group and condition it draws', async () => {
    fixture.componentInstance.value.set(where('name', 'contains', 'a'));
    await settle();
    expect(query('lib-datagrid-filter-builder').getAttribute('role')).toBe('dialog');
    expect(query('.dg-fb-group').getAttribute('aria-label')).toBeTruthy();
    expect(conditions()[0]?.getAttribute('aria-label')).toBeTruthy();
  });

  it('reads a nested expression into one row per condition', async () => {
    fixture.componentInstance.value.set(
      and(where('name', 'contains', 'a'), or(where('score', 'gt', 1), where('score', 'lt', 9))),
    );
    await settle();
    expect(conditions()).toHaveLength(3);
    // Root plus the nested `or`.
    expect(queryAll('.dg-fb-group')).toHaveLength(2);
  });

  it('applies the expression it was opened on, unchanged', async () => {
    const node = and(where('name', 'contains', 'a'), not(where('score', 'gt', 1)));
    fixture.componentInstance.value.set(node);
    await settle();
    button('apply').click();
    expect(fixture.componentInstance.applied()).toEqual(node);
  });

  it('adds a condition seeded on the first field and its first operator', async () => {
    button('add-condition').click();
    await settle();
    expect(conditions()).toHaveLength(1);
    type(textEditor(), 'ada');
    button('apply').click();
    expect(fixture.componentInstance.applied()).toEqual(where('name', 'contains', 'ada'));
  });

  it('adds a nested group, which combines its own conditions', async () => {
    button('add-condition').click();
    await settle();
    button('add-group').click();
    await settle();
    expect(queryAll('.dg-fb-group')).toHaveLength(2);
  });

  it('removes one condition and leaves its siblings', async () => {
    fixture.componentInstance.value.set(
      and(where('name', 'contains', 'a'), where('name', 'endsWith', 'b')),
    );
    await settle();
    const remove = conditions()[1]?.querySelector<HTMLElement>('.dg-fb-remove');
    remove?.click();
    await settle();
    expect(conditions()).toHaveLength(1);
    button('apply').click();
    expect(fixture.componentInstance.applied()).toEqual(where('name', 'contains', 'a'));
  });

  it('marks a condition with no value and never applies it silently', async () => {
    button('add-condition').click();
    await settle();
    expect(conditions()[0]?.hasAttribute('data-incomplete')).toBe(true);
    // The mark is not colour alone: the row carries text and the tree a note.
    expect(query('.dg-fb-flag').textContent.trim()).not.toBe('');
    expect(query('.dg-fb-note')).toBeTruthy();
    button('apply').click();
    expect(fixture.componentInstance.applied()).toBeNull();
  });

  it('drops the mark once the condition collects a value', async () => {
    button('add-condition').click();
    await settle();
    type(textEditor(), 'x');
    await settle();
    expect(conditions()[0]?.hasAttribute('data-incomplete')).toBe(false);
  });

  it('reports the column filters the expression does not hold', async () => {
    expect(queryAll('.dg-fb-note')).toHaveLength(0);
    fixture.componentInstance.otherFilterCount.set(2);
    await settle();
    expect(queryAll('.dg-fb-note')).toHaveLength(1);
  });

  it('empties the expression without applying it', async () => {
    fixture.componentInstance.value.set(where('name', 'contains', 'a'));
    await settle();
    button('clear').click();
    await settle();
    expect(conditions()).toHaveLength(0);
    expect(fixture.componentInstance.applied()).toBeUndefined();
  });

  it('reports a cancel and applies nothing', async () => {
    fixture.componentInstance.value.set(where('name', 'contains', 'a'));
    await settle();
    button('cancel').click();
    expect(fixture.componentInstance.canceledCount()).toBe(1);
    expect(fixture.componentInstance.applied()).toBeUndefined();
  });

  it('draws both ends of a range, unlike the filter row cell', async () => {
    fixture.componentInstance.value.set(where('score', 'between', [1, 9]));
    await settle();
    expect(conditions()[0]?.querySelectorAll('lib-input-number')).toHaveLength(2);
  });

  // A select draws its list inline, so a scrolling ancestor clips it and the
  // list grows whatever surface the editor opens in. Every chooser here is a
  // button over one shared overlay menu instead.
  it('draws no control that would open a list inside the panel', async () => {
    fixture.componentInstance.value.set(
      and(where('name', 'contains', 'a'), where('score', 'between', [1, 9])),
    );
    await settle();
    expect(queryAll('lib-select')).toHaveLength(0);
    expect(queryAll('.dg-fb-chooser').length).toBeGreaterThan(0);
  });
});

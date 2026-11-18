/**
 * The column-to-card mapping, which is the whole of "define the columns once".
 * Tested without a view: the plan is a pure function of the columns.
 */
import { describe, expect, it } from 'vitest';
import { planCardFields } from './card-fields';
import { selectionColumn, rowNumberColumn, detailColumn } from './builtin-columns';
import type { ColumnDef } from './types/column.types';

interface Row {
  id: number;
  name: string;
  city: string;
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', primary: true },
  { id: 'city', field: 'city', caption: 'City' },
  { id: 'code', field: 'code' },
];

const OPTIONS = { isPrimary: (id: string) => id === 'name', showLabels: true };

describe('planCardFields', () => {
  it('makes the primary column the title and the rest labelled fields', () => {
    const plan = planCardFields(COLUMNS, OPTIONS);

    expect(plan.title?.id).toBe('name');
    expect(plan.fields.map((field) => field.id)).toEqual(['city', 'code']);
    expect(plan.actions).toEqual([]);
  });

  it('labels a field by its caption, and falls back to the field name', () => {
    const plan = planCardFields(COLUMNS, OPTIONS);

    expect(plan.fields[0].label).toBe('City');
    expect(plan.fields[1].label).toBe('code');
  });

  it('draws the title without a caption and a field with one', () => {
    const plan = planCardFields(COLUMNS, OPTIONS);

    expect(plan.title?.hideLabel).toBe(true);
    expect(plan.fields[0].hideLabel).toBe(false);
  });

  it('hides every caption when the card view asks for none', () => {
    const plan = planCardFields(COLUMNS, { ...OPTIONS, showLabels: false });

    expect(plan.fields.every((field) => field.hideLabel)).toBe(true);
  });

  it('honours a declared role over the resolved one', () => {
    const plan = planCardFields(
      [
        { id: 'name', field: 'name', primary: true },
        { id: 'city', field: 'city', card: { role: 'subtitle' } },
        { id: 'actions', card: { role: 'actions' } },
      ],
      OPTIONS,
    );

    expect(plan.subtitle?.id).toBe('city');
    expect(plan.actions.map((entry) => entry.id)).toEqual(['actions']);
    expect(plan.fields).toEqual([]);
  });

  it('leaves a column off the card without taking it out of the table', () => {
    const plan = planCardFields(
      [...COLUMNS, { id: 'sortHelper', field: 'sortHelper', card: { role: 'none' } }],
      OPTIONS,
    );

    expect(plan.all.map((entry) => entry.id)).not.toContain('sortHelper');
  });

  it('drops the grid’s own columns, which are card chrome rather than fields', () => {
    const plan = planCardFields(
      [detailColumn<Row>(40), selectionColumn<Row>(44), rowNumberColumn<Row>(56), ...COLUMNS],
      OPTIONS,
    );

    expect(plan.all).toHaveLength(3);
  });

  it('orders by the declared order, then by column order', () => {
    const plan = planCardFields(
      [
        { id: 'a', field: 'a' },
        { id: 'b', field: 'b', card: { order: -1 } },
        { id: 'c', field: 'c' },
      ],
      { isPrimary: () => false, showLabels: true },
    );

    expect(plan.fields.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
  });

  it('demotes a second title rather than dropping it', () => {
    const plan = planCardFields(
      [
        { id: 'name', field: 'name', card: { role: 'title' } },
        { id: 'other', field: 'other', card: { role: 'title' } },
      ],
      { isPrimary: () => false, showLabels: true },
    );

    expect(plan.title?.id).toBe('name');
    expect(plan.fields.map((entry) => entry.id)).toEqual(['other']);
  });
});

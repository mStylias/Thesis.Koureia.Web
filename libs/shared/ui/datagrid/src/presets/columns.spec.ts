import { describe, expect, it, vi } from 'vitest';
import {
  actionsColumn,
  booleanColumn,
  checkColumnFields,
  currencyColumn,
  dateColumn,
  linkColumn,
  numberColumn,
  percentColumn,
  tagColumn,
  textColumn,
} from './columns';
import { DatagridActionsCell } from './datagrid-actions-cell';
import { DatagridBooleanCell } from './datagrid-boolean-cell';
import { DatagridLinkCell } from './datagrid-link-cell';
import { DatagridTagCell } from './datagrid-tag-cell';
import { readPresetOptions } from './preset-options';
import type { ActionsSpec, TagSpec } from './preset.types';

interface Booking {
  id: number;
  code: string;
  price: number;
  status: string;
  customer: { name: string };
}

describe('formatting presets', () => {
  it('declares the data type and leaves everything else to the host', () => {
    expect(textColumn<Booking>({ id: 'code', field: 'code' })).toEqual({
      dataType: 'string',
      id: 'code',
      field: 'code',
    });
  });

  it('carries a precision into the format spec', () => {
    expect(numberColumn<Booking>({ id: 'n' }, { precision: 2 }).format).toEqual({
      type: 'number',
      precision: 2,
    });
  });

  it('omits precision entirely when none is asked for, so the locale decides', () => {
    expect(percentColumn<Booking>({ id: 'p' }).format).toEqual({ type: 'percent' });
  });

  it('defaults currency to the product own', () => {
    expect(currencyColumn<Booking>({ id: 'price', field: 'price' }).format).toEqual({
      type: 'currency',
      currency: 'EUR',
    });
  });

  it('lets the host override anything the factory set', () => {
    const column = dateColumn<Booking>({ id: 'day', dataType: 'datetime' });
    expect(column.dataType).toBe('datetime');
  });

  it('composes by spread without re-stating the rest', () => {
    const column = { ...textColumn<Booking>({ id: 'code', field: 'code' }), width: 120 };
    expect(column).toMatchObject({ id: 'code', dataType: 'string', width: 120 });
  });
});

describe('renderer presets', () => {
  it('attaches the renderer as a component type, which survives a wrapper', () => {
    expect(tagColumn<Booking>({ id: 'status' }).cell).toBe(DatagridTagCell);
    expect(linkColumn<Booking>({ id: 'link' }, { href: () => '/x' }).cell).toBe(DatagridLinkCell);
    expect(actionsColumn<Booking>({ id: 'a' }, { actions: [] }).cell).toBe(DatagridActionsCell);
  });

  it('keeps the boolean fast path unless a glyph was asked for', () => {
    expect(booleanColumn<Booking>({ id: 'b' }).cell).toBeUndefined();
    expect(booleanColumn<Booking>({ id: 'b' }, { display: 'check' }).cell).toBe(
      DatagridBooleanCell,
    );
  });

  it('carries its options where the renderer reads them back', () => {
    const spec: TagSpec<Booking> = { tone: { open: 'success' } };
    const column = tagColumn<Booking>({ id: 'status' }, spec);
    expect(readPresetOptions<TagSpec<Booking>>(column, {})).toBe(spec);
  });

  it('leaves the host own meta entries untouched', () => {
    const column = tagColumn<Booking>({ id: 'status', meta: { audit: true } }, {});
    expect(column.meta?.['audit']).toBe(true);
  });

  it('refuses the operations an actions column has no value for', () => {
    const spec: ActionsSpec<Booking> = { actions: [] };
    expect(actionsColumn<Booking>({ id: 'a' }, spec).allow).toEqual({
      sorting: false,
      filtering: false,
      grouping: false,
      headerFiltering: false,
      exporting: false,
    });
  });

  it('pins actions to the end, where a list of actions belongs', () => {
    expect(actionsColumn<Booking>({ id: 'a' }, { actions: [] }).pinned).toBe('end');
  });
});

describe('field checking', () => {
  const row: Booking = {
    id: 1,
    code: 'A1',
    price: 10,
    status: 'open',
    customer: { name: 'Ada' },
  };

  it('says nothing for a field that resolves, nested paths included', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    checkColumnFields([{ id: 'c', field: 'customer.name' }], row, new Set());
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports a field that resolves on no row', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    checkColumnFields([{ id: 'c', field: 'customer.nmae' }], row, new Set());
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('reports one column once, however often the rows change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reported = new Set<string>();
    checkColumnFields([{ id: 'c', field: 'nope' }], row, reported);
    checkColumnFields([{ id: 'c', field: 'nope' }], row, reported);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('says nothing for a column that computes its own value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    checkColumnFields([{ id: 'c', field: 'nope', value: () => 1 }], row, new Set());
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('export visuals', () => {
  const row: Booking = { id: 1, code: 'A1', price: 9, status: 'open', customer: { name: 'Ann' } };

  it('describes every tag with its label and tone, maxVisible ignored', () => {
    const column = tagColumn<Booking>(
      { id: 'status', field: 'status' },
      {
        tone: { open: 'success' },
        label: (value) => `#${String(value)}`,
        maxVisible: 1,
      },
    );
    expect(column.exportVisual?.(row, ['open', 'closed'])).toEqual({
      kind: 'tags',
      tags: [
        { label: '#open', tone: 'success' },
        { label: '#closed', tone: 'neutral' },
      ],
    });
  });

  it('describes an empty tag cell as no visual, so its text exports', () => {
    const column = tagColumn<Booking>({ id: 'status', field: 'status' });
    expect(column.exportVisual?.(row, null)).toBeNull();
  });

  it('describes a check column as a check, and a labelled boolean as text', () => {
    const check = booleanColumn<Booking>({ id: 'b' }, { display: 'check' });
    expect(check.exportVisual?.(row, true)).toEqual({ kind: 'check', checked: true });
    expect(check.exportVisual?.(row, null)).toEqual({ kind: 'check', checked: false });
    expect(booleanColumn<Booking>({ id: 'b' }).exportVisual).toBeUndefined();
  });

  it('describes a link with its target, and a row without one as text', () => {
    const column = linkColumn<Booking>(
      { id: 'code', field: 'code' },
      { href: (entry) => (entry.id === 1 ? `/b/${entry.code}` : '') },
    );
    expect(column.exportVisual?.(row, 'A1')).toEqual({ kind: 'link', href: '/b/A1', label: 'A1' });
    expect(column.exportVisual?.({ ...row, id: 2 }, 'A1')).toBeNull();
  });

  it("lets a host's own exportVisual win over the preset's", () => {
    const own = (): null => null;
    expect(tagColumn<Booking>({ id: 's', exportVisual: own }).exportVisual).toBe(own);
  });
});

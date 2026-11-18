/**
 * The PDF writer and what it loads. The fonts are absent here, so the writer
 * uses the standard font and every fixture is Latin.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPdfBlob } from './pdf-document';
import { parseColor, resolvePdfResources } from './pdf-resources';
import type { PdfResources } from './pdf-document.types';
import type { ExportCell, ExportRow, ExportTable } from '../../types/export.types';

function cell(text: string, extra: Partial<ExportCell> = {}): ExportCell {
  return { value: text, text, type: 'string', colSpan: 1, indent: 0, style: null, ...extra };
}

function table(rows: number): ExportTable {
  const data: ExportRow[] = Array.from({ length: rows }, (_, index) => ({
    kind: 'data',
    level: 0,
    key: index,
    cells: [
      cell(`Row ${index.toString()}`),
      cell('open', { visual: { kind: 'tags', tags: [{ label: 'Open', tone: 'success' }] } }),
      cell('Yes', { visual: { kind: 'check', checked: index % 2 === 0 } }),
      cell('A1', { visual: { kind: 'link', href: '/a/1', label: 'A1' } }),
    ],
  }));
  return {
    format: 'pdf',
    fileName: 'bookings',
    sheetName: 'Bookings',
    columns: ['name', 'status', 'paid', 'link'].map((id) => ({
      id,
      caption: id,
      dataType: undefined,
      width: 120,
    })),
    rows: [
      {
        kind: 'header',
        level: 0,
        key: null,
        cells: ['Name', 'Status', 'Paid', 'Link'].map((text) => cell(text)),
      },
      ...data,
    ],
  };
}

async function resources(): Promise<PdfResources> {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const resolved = await resolvePdfResources(document, {});
  warn.mockRestore();
  return resolved;
}

async function text(blob: Blob): Promise<string> {
  return new TextDecoder('latin1').decode(await blob.arrayBuffer());
}

describe('PDF colors', () => {
  it('reads rgb(), rgba() over white and color(srgb)', () => {
    expect(parseColor('rgb(158, 95, 40)')).toEqual([158, 95, 40]);
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual([128, 128, 128]);
    expect(parseColor('color(srgb 1 0 0.5)')).toEqual([255, 0, 128]);
  });

  it('treats a transparent or foreign color as no color', () => {
    expect(parseColor('rgba(0, 0, 0, 0)')).toBeNull();
    expect(parseColor('oklch(0.5 0.1 40)')).toBeNull();
    expect(parseColor('')).toBeNull();
  });
});

describe('PDF resources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails the export when the regular font does not load, rather than drop its glyphs', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 404 })));
    await expect(
      resolvePdfResources(document, { fonts: { regular: '/missing.ttf' } }),
    ).rejects.toThrow('/missing.ttf');
  });

  it('reuses the regular face for a bold face that does not load', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      Promise.resolve(
        url === '/bold.ttf'
          ? new Response(null, { status: 404 })
          : new Response(new Uint8Array([0, 1, 0, 0, 65])),
      ),
    );
    const resolved = await resolvePdfResources(document, {
      fonts: { regular: '/regular.ttf', bold: '/bold.ttf' },
    });
    expect(resolved.fonts).toEqual({
      regular: '\u0000\u0001\u0000\u0000A',
      medium: null,
      bold: null,
    });
  });

  it('drops a logo that is not an image, and does not fail the export', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('<html>')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resolved = await resolvePdfResources(document, { logo: { url: '/logo.png' } });
    warn.mockRestore();
    expect(resolved.logo).toBeNull();
  });

  it('falls back to a full palette when the page has no theme, and leaves no probe', async () => {
    const resolved = await resources();
    expect(resolved.palette.tones.success.fill).toHaveLength(3);
    expect(document.querySelector('[data-theme="light"]')).toBeNull();
  });
});

describe('PDF document', () => {
  it('writes a PDF named after the sheet, with one page per page of rows', async () => {
    const blob = toPdfBlob(table(80), await resources(), {});
    const source = await text(blob);
    expect(blob.type).toBe('application/pdf');
    expect(source.startsWith('%PDF-')).toBe(true);
    expect(source).toContain('/Title (Bookings)');
    expect(source.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });

  it('makes a link cell open its target, resolved against the page', async () => {
    const source = await text(toPdfBlob(table(1), await resources(), {}));
    expect(source).toContain(new URL('/a/1', document.baseURI).href);
  });

  it('lays a narrow table out in portrait and a wide one in landscape', async () => {
    const pageBox = async (width: number): Promise<string> => {
      const wide = table(1);
      wide.columns = wide.columns.map((column) => ({ ...column, width }));
      const source = await text(toPdfBlob(wide, await resources(), {}));
      const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(source)?.slice(1) ?? [];
      return box.map((side) => Math.round(Number(side)).toString()).join('x');
    };
    expect(await pageBox(100)).toBe('595x842');
    expect(await pageBox(400)).toBe('842x595');
  });
});

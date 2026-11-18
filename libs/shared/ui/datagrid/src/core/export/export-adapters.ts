/**
 * Export registration (§15, §23).
 *
 * Adapters and the file saver attach through providers rather than through a
 * binding: they are application policy, they are heavy, and both have to cross
 * a wrapper. This module holds only the tokens and the registration functions,
 * so importing it pulls in no writer — `provideDatagridExcel()` and
 * `provideDatagridPdf()` reach their writers through `import()`, and even the
 * built-in text adapters load with the export run rather than with the grid.
 */
import {
  DOCUMENT,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import type { DatagridFileSaver, ExportAdapter, ExportTable } from '../types/export.types';
import type { DatagridExcelBranding, DatagridPdfOptions } from './export-adapters.types';

/** Host-registered adapters, resolved beneath the built-in text formats. */
export const DATAGRID_EXPORT_ADAPTERS = new InjectionToken<readonly ExportAdapter[]>(
  'DATAGRID_EXPORT_ADAPTERS',
);

/** Where a finished file goes. Absent means the built-in browser download. */
export const DATAGRID_FILE_SAVER = new InjectionToken<DatagridFileSaver>('DATAGRID_FILE_SAVER');

/**
 * The brand every spreadsheet export beneath the injector carries.
 *
 * An application states it once, so a grid registers the writer without
 * repeating the brand and no screen can dress its export differently:
 *
 * ```ts
 * // The app's root providers. A workbook holds no `var()`, so a factory is
 * // what resolves the hues the theme already owns.
 * {
 *   provide: DATAGRID_EXCEL_BRANDING,
 *   useFactory: () => ({ subtitle: name, logo: { url: logo }, accent: hueOf('--brand-500') }),
 * }
 * ```
 *
 * The factory runs when the first grid beneath it is created, which is in the
 * browser for a hydrated page and on the server for a rendered one, so it must
 * not require a live document.
 */
export const DATAGRID_EXCEL_BRANDING = new InjectionToken<DatagridExcelBranding>(
  'DATAGRID_EXCEL_BRANDING',
);

/**
 * Registers export adapters for every grid beneath the injector.
 *
 * ```ts
 * providers: [provideDatagridExport(myPdfAdapter)]
 * ```
 *
 * A registration replaces a built-in of the same format name, so a host that
 * wants semicolon-separated CSV registers its own `csv` and the grid stops
 * offering the library's.
 */
export function provideDatagridExport(...adapters: readonly ExportAdapter[]): EnvironmentProviders {
  return makeEnvironmentProviders(
    adapters.map((adapter) => ({
      provide: DATAGRID_EXPORT_ADAPTERS,
      useValue: adapter,
      multi: true,
    })),
  );
}

/**
 * Registers the `xlsx` adapter.
 *
 * The writer is reached through a dynamic import, so an application that never
 * calls this ships none of it, and one that does loads it on the first export
 * rather than with the grid.
 *
 * ```ts
 * providers: [provideDatagridExcel()]
 * ```
 *
 * The workbook carries the brand registered on {@link DATAGRID_EXCEL_BRANDING},
 * which an application states once at its root. Pass `branding` here to dress
 * one route differently, or `adapterOptions.branding` on an export run to dress
 * one file.
 */
export function provideDatagridExcel(branding?: DatagridExcelBranding): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: DATAGRID_EXPORT_ADAPTERS,
      multi: true,
      useFactory: (): ExportAdapter =>
        excelAdapter(branding ?? inject(DATAGRID_EXCEL_BRANDING, { optional: true })),
    },
  ]);
}

function excelAdapter(registered: DatagridExcelBranding | null): ExportAdapter {
  return {
    format: 'xlsx',
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    write: async (table: ExportTable, options): Promise<Blob> => {
      const requested = options?.['branding'];
      const branded =
        typeof requested === 'object' && requested !== null
          ? (requested as DatagridExcelBranding)
          : registered;
      const { toXlsxBlob } = await import('./xlsx/workbook');
      if (branded == null) {
        return toXlsxBlob(table, options);
      }
      const { resolveExcelBranding } = await import('./xlsx/branding');
      return toXlsxBlob(table, { ...options, branding: await resolveExcelBranding(branded) });
    },
  };
}

/**
 * What every PDF export beneath the injector carries: the fonts, the banner
 * and the page. An application states it once at its root:
 *
 * ```ts
 * {
 *   provide: DATAGRID_PDF_OPTIONS,
 *   useFactory: () => ({ fonts: { regular: '/fonts/sans.ttf' }, subtitle: name, logo: { url: logo } }),
 * }
 * ```
 *
 * The factory can run on the server, so it must not require a live document.
 */
export const DATAGRID_PDF_OPTIONS = new InjectionToken<DatagridPdfOptions>('DATAGRID_PDF_OPTIONS');

/**
 * Registers the `pdf` adapter.
 *
 * jsPDF, the fonts and the writer load on the first PDF export, through
 * `import()` and `fetch`. An application that never calls this ships none of
 * it, and one that does adds nothing to the grid's own bundle.
 *
 * ```ts
 * providers: [provideDatagridPdf()]
 * ```
 *
 * `options` win over {@link DATAGRID_PDF_OPTIONS}, and an export run's
 * `adapterOptions` win over both.
 */
export function provideDatagridPdf(options?: DatagridPdfOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: DATAGRID_EXPORT_ADAPTERS,
      multi: true,
      useFactory: (): ExportAdapter =>
        pdfAdapter(inject(DOCUMENT), {
          ...inject(DATAGRID_PDF_OPTIONS, { optional: true }),
          ...options,
        }),
    },
  ]);
}

function pdfAdapter(document: Document, registered: DatagridPdfOptions): ExportAdapter {
  return {
    format: 'pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    write: async (table: ExportTable, options): Promise<Blob> => {
      const settings: DatagridPdfOptions = { ...registered, ...options };
      const [{ resolvePdfResources }, { toPdfBlob }] = await Promise.all([
        import('./pdf/pdf-resources'),
        import('./pdf/pdf-document'),
      ]);
      return toPdfBlob(table, await resolvePdfResources(document, settings), settings);
    },
  };
}

/**
 * Replaces where a finished file goes.
 *
 * ```ts
 * providers: [provideDatagridFileSaver((blob, name) => upload(blob, name))]
 * ```
 *
 * Without one the grid triggers a browser download. Overriding it is how a
 * host uploads the file instead, and how a server-rendered or tested build
 * keeps the grid away from the DOM.
 */
export function provideDatagridFileSaver(saver: DatagridFileSaver): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DATAGRID_FILE_SAVER, useValue: saver }]);
}

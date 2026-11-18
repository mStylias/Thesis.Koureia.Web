/**
 * The brand a spreadsheet export carries.
 *
 * The name and the logo come from the brand token, and the hues from the
 * theme's own custom properties: a workbook holds no `var()`, so a color has to
 * be resolved to hex somewhere, and this file resolves it rather than repeating
 * what `libs/themes/koureia` already says.
 *
 * The raw ramp is read, never a semantic alias. An export is a light document
 * whatever the visitor set the screen to.
 */
import { DOCUMENT, inject } from '@angular/core';
import { DATAGRID_EXCEL_BRANDING, type DatagridExcelBranding } from '@ui/datagrid';
import { injectBrand } from '@util/brand';

/** Drawn size of the logo in the banner, in pixels. */
const LOGO_SIZE = 26;

/** Registers the brand every grid's spreadsheet export wears. */
export function provideExcelBranding() {
  return [{ provide: DATAGRID_EXCEL_BRANDING, useFactory: excelBranding }];
}

function excelBranding(): DatagridExcelBranding {
  const brand = injectBrand();
  const token = paletteReader(inject(DOCUMENT));
  return {
    // No title: the writer falls back to the sheet name, which is the screen's
    // own caption and already translated.
    subtitle: brand.name,
    logo: { url: brand.logo, width: LOGO_SIZE, height: LOGO_SIZE },
    ...token('accent', '--brand-500'),
    ...token('band', '--paper'),
    ...token('muted', '--neutral-500'),
  };
}

/**
 * Reads one token off `:root` as a branding field, or nothing.
 *
 * A value that is not a plain hex is refused, because the writer needs
 * `#RRGGBB` and a theme is free to hold a color a spreadsheet cannot express.
 * Nothing is also the answer on the server, where there is no stylesheet to
 * read; the field is optional and the banner drops that part of its dressing.
 */
function paletteReader(
  document: Document,
): (field: keyof DatagridExcelBranding, token: string) => Partial<DatagridExcelBranding> {
  const view = document.defaultView;
  const styles =
    view == null || typeof view.getComputedStyle !== 'function'
      ? null
      : view.getComputedStyle(document.documentElement);
  return (field, token) => {
    const value = styles?.getPropertyValue(token).trim() ?? '';
    return /^#[0-9a-f]{6}$/i.test(value) ? { [field]: value } : {};
  };
}

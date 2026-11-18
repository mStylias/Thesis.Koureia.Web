/**
 * What every grid's PDF export carries: the brand banner and the brand's font.
 *
 * The font is the theme's `--font-sans` as TrueType, because a PDF cannot embed the WOFF2 the page
 * loads. The files sit in `public/fonts` and load on the first PDF export only.
 */
import { DATAGRID_PDF_OPTIONS, type DatagridPdfOptions } from '@ui/datagrid';
import { injectBrand } from '@util/brand';

/** Drawn size of the logo in the banner, in pixels. */
const LOGO_SIZE = 26;

const FONT_DIR = '/fonts/alegreya-sans';

/** Registers the banner and the font every grid's PDF export uses. */
export function providePdfExport() {
  return [{ provide: DATAGRID_PDF_OPTIONS, useFactory: pdfOptions }];
}

function pdfOptions(): DatagridPdfOptions {
  const brand = injectBrand();
  return {
    // No title: the writer falls back to the sheet name, which is the screen's own caption.
    subtitle: brand.name,
    logo: { url: brand.logo, width: LOGO_SIZE, height: LOGO_SIZE },
    fonts: {
      regular: `${FONT_DIR}/AlegreyaSans-Regular.ttf`,
      medium: `${FONT_DIR}/AlegreyaSans-Medium.ttf`,
      bold: `${FONT_DIR}/AlegreyaSans-Bold.ttf`,
    },
  };
}

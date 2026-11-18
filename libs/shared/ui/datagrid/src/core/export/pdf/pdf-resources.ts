/**
 * What a PDF needs from outside the table: fonts, a logo and the palette.
 *
 * Only this module touches the network and the DOM, so `toPdfBlob` stays a
 * pure function of its input.
 */
import { isDevMode } from '@angular/core';
import type {
  DatagridExcelLogo,
  DatagridPdfFonts,
  DatagridPdfOptions,
} from '../export-adapters.types';
import type {
  PdfColor,
  PdfFontFiles,
  PdfLogo,
  PdfPalette,
  PdfResources,
} from './pdf-document.types';

/** Drawn size of the logo when the options state none, in pixels. */
const DEFAULT_LOGO_SIZE = 28;

/** The palette when the page has no stylesheet to read, such as in a test. */
const FALLBACK_PALETTE: PdfPalette = {
  text: [33, 33, 33],
  textSecondary: [97, 97, 97],
  textMuted: [117, 117, 117],
  surface: [255, 255, 255],
  header: [245, 245, 245],
  border: [224, 224, 224],
  borderSubtle: [235, 235, 235],
  accent: [33, 33, 33],
  accentText: [33, 33, 33],
  tagFill: [255, 255, 255],
  tagBorder: [189, 189, 189],
  tones: {
    accent: { fill: [33, 33, 33], text: [255, 255, 255] },
    success: { fill: [46, 125, 50], text: [255, 255, 255] },
    warning: { fill: [178, 106, 0], text: [255, 255, 255] },
    error: { fill: [198, 40, 40], text: [255, 255, 255] },
    info: { fill: [21, 101, 192], text: [255, 255, 255] },
  },
};

export async function resolvePdfResources(
  document: Document,
  options: DatagridPdfOptions,
): Promise<PdfResources> {
  const [fonts, logo] = await Promise.all([loadFonts(options.fonts), loadLogo(options.logo)]);
  return { fonts, logo, palette: readPalette(document), baseUrl: document.baseURI };
}

/**
 * Fetches the faces.
 *
 * A regular face that fails to load fails the export: the standard font has
 * no Greek, and a file of empty boxes is worse than an error. A missing
 * medium or bold face falls back to the regular one.
 */
async function loadFonts(fonts: DatagridPdfFonts | undefined): Promise<PdfFontFiles | null> {
  if (fonts == null) {
    if (isDevMode()) {
      console.warn(
        'datagrid: a PDF export has no fonts. The standard font has no Greek glyphs; pass `fonts` to provideDatagridPdf().',
      );
    }
    return null;
  }
  const [regular, medium, bold] = await Promise.all([
    fetchBinary(fonts.regular),
    fonts.medium == null ? null : fetchBinary(fonts.medium).catch(() => null),
    fonts.bold == null ? null : fetchBinary(fonts.bold).catch(() => null),
  ]);
  return { regular, medium, bold };
}

async function fetchBinary(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`datagrid: the PDF font ${url} answered ${response.status.toString()}`);
  }
  return binaryString(new Uint8Array(await response.arrayBuffer()));
}

/** Bytes as a binary string. Chunked, because a spread of a whole font overflows the stack. */
function binaryString(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)));
  }
  return chunks.join('');
}

/** A logo that fails to load is dropped. A missing decoration must not fail the export. */
async function loadLogo(logo: DatagridExcelLogo | undefined): Promise<PdfLogo | null> {
  if (logo == null) {
    return null;
  }
  try {
    const response = await fetch(logo.url);
    if (!response.ok) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const format = imageFormat(bytes);
    return format == null
      ? null
      : {
          bytes,
          format,
          width: logo.width ?? DEFAULT_LOGO_SIZE,
          height: logo.height ?? DEFAULT_LOGO_SIZE,
        };
  } catch {
    return null;
  }
}

/** Read from the signature, because a server can send the wrong content type. */
function imageFormat(bytes: Uint8Array): 'PNG' | 'JPEG' | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'PNG';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'JPEG';
  }
  return null;
}

/**
 * Reads the light theme off the page.
 *
 * A probe carries `data-theme="light"`, so a visitor on the dark theme still
 * exports a light document, as paper is. Each token is read as the probe's
 * `color`, which the browser resolves to `rgb()` whatever form the theme
 * wrote it in. A token the page does not define keeps the fallback.
 */
function readPalette(document: Document): PdfPalette {
  const view = document.defaultView;
  if (view == null || typeof view.getComputedStyle !== 'function') {
    return FALLBACK_PALETTE;
  }
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', 'light');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  try {
    const read = (token: string, fallback: PdfColor): PdfColor => {
      probe.style.color = `var(${token}, transparent)`;
      return parseColor(view.getComputedStyle(probe).color) ?? fallback;
    };
    const tone = (name: 'success' | 'warning' | 'error' | 'info') => ({
      fill: read(`--${name}`, FALLBACK_PALETTE.tones[name].fill),
      text: read(`--on-${name}`, FALLBACK_PALETTE.tones[name].text),
    });
    const fallback = FALLBACK_PALETTE;
    return {
      text: read('--text-primary', fallback.text),
      textSecondary: read('--text-secondary', fallback.textSecondary),
      textMuted: read('--text-muted', fallback.textMuted),
      surface: read('--surface', fallback.surface),
      header: read('--surface-2', fallback.header),
      border: read('--border', fallback.border),
      borderSubtle: read('--border-subtle', fallback.borderSubtle),
      accent: read('--accent', fallback.accent),
      accentText: read('--accent-text', fallback.accentText),
      tagFill: read('--tag-bg', fallback.tagFill),
      tagBorder: read('--tag-border', fallback.tagBorder),
      tones: {
        accent: {
          fill: read('--accent', fallback.tones.accent.fill),
          text: read('--accent-fg', fallback.tones.accent.text),
        },
        success: tone('success'),
        warning: tone('warning'),
        error: tone('error'),
        info: tone('info'),
      },
    };
  } finally {
    probe.remove();
  }
}

/**
 * Channels of a computed color, composited over white.
 *
 * `rgb()` is what a browser computes for a hex or `rgb` token, and
 * `color(srgb …)` for a `color-mix` in sRGB. Any other space returns `null`.
 */
export function parseColor(value: string): PdfColor | null {
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(
    value.trim(),
  );
  if (rgb != null) {
    return composite([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], alpha(rgb[4]));
  }
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
    value.trim(),
  );
  if (srgb != null) {
    const channels = [srgb[1], srgb[2], srgb[3]].map((channel) => Number(channel) * 255);
    return composite([channels[0], channels[1], channels[2]], alpha(srgb[4]));
  }
  return null;
}

function alpha(value: string | undefined): number {
  if (value == null) {
    return 1;
  }
  return value.endsWith('%') ? Number(value.slice(0, -1)) / 100 : Number(value);
}

/** A transparent color, such as an undefined token's fallback, is no color. */
function composite(channels: PdfColor, opacity: number): PdfColor | null {
  if (!(opacity > 0)) {
    return null;
  }
  const over = (channel: number): number => Math.round(channel * opacity + 255 * (1 - opacity));
  return [over(channels[0]), over(channels[1]), over(channels[2])];
}

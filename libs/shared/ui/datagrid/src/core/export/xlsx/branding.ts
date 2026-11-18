/**
 * Turns registered branding into what the writer takes.
 *
 * The logo arrives as a URL and leaves as bytes: `toXlsxBlob` stays
 * synchronous and pure, so only this module touches the network. A logo that
 * fails to load is dropped rather than raised — an export the user asked for
 * must not fail over a missing decoration.
 */
import type { DatagridExcelBranding } from '../export-adapters.types';
import type { XlsxBranding } from './workbook.types';

/** Drawn size of the logo when the branding states none, in pixels. */
const DEFAULT_LOGO_SIZE = 28;

export async function resolveExcelBranding(branding: DatagridExcelBranding): Promise<XlsxBranding> {
  const { logo, ...rest } = branding;
  if (logo == null) {
    return rest;
  }
  const png = await loadPng(logo.url);
  if (png == null) {
    return rest;
  }
  return {
    ...rest,
    logo: {
      png,
      width: logo.width ?? DEFAULT_LOGO_SIZE,
      height: logo.height ?? DEFAULT_LOGO_SIZE,
    },
  };
}

async function loadPng(url: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

import { TestBed } from '@angular/core/testing';
import { DATAGRID_EXCEL_BRANDING } from '@ui/datagrid';
import { BRAND, type BrandConfig } from '@util/brand';

import { provideExcelBranding } from './excel-branding';

const BRAND_FIXTURE: BrandConfig = {
  id: 'koureia',
  name: 'Koureia',
  wordmark: 'koureia',
  logo: '/brand/koureia_icon.png',
  heroImage: '/images/hero.webp',
  defaultTheme: 'system',
};

function branding() {
  TestBed.configureTestingModule({
    providers: [{ provide: BRAND, useValue: BRAND_FIXTURE }, provideExcelBranding()],
  });
  return TestBed.inject(DATAGRID_EXCEL_BRANDING);
}

function setToken(token: string, value: string): void {
  document.documentElement.style.setProperty(token, value);
}

describe('provideExcelBranding', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('carries the brand name and its logo, and titles nothing', () => {
    const excel = branding();

    expect(excel.subtitle).toBe('Koureia');
    expect(excel.logo?.url).toBe('/brand/koureia_icon.png');
    // The writer falls back to the sheet name, which the screen has translated.
    expect(excel.title).toBeUndefined();
  });

  it('resolves the hues off the theme rather than naming them', () => {
    setToken('--brand-500', '#9e5f28');
    setToken('--paper', '#fbf8f2');
    setToken('--neutral-500', '#7a6e5f');

    const excel = branding();

    expect(excel.accent).toBe('#9e5f28');
    expect(excel.band).toBe('#fbf8f2');
    expect(excel.muted).toBe('#7a6e5f');
  });

  it('drops a hue a spreadsheet cannot express', () => {
    setToken('--brand-500', 'color-mix(in oklab, red, blue)');
    setToken('--paper', 'rgb(251 248 242)');

    const excel = branding();

    expect(excel.accent).toBeUndefined();
    expect(excel.band).toBeUndefined();
  });
});

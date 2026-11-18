import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { By } from '@angular/platform-browser';
import { CompanyApi, type CompanyLogoResponse, type CompanySettingsResponse } from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { providePageSections } from '@features/management-shared-page-sections';
import { Result } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Dialog } from '@ui/dialog';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom, of, Subject, type Observable } from 'rxjs';

import { companyInlineLoader } from '../company.i18n';
import { CompanyStore } from '../company.store';
import { CompanyShop } from './company-shop';
import { LogoCropDialog, logoFile } from './logo-crop-dialog';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const SETTINGS: CompanySettingsResponse = {
  id: 'c1',
  slug: 'kouremeno-psalidi',
  name: 'Κουρεμένο Ψαλίδι',
  street: 'Ερμού 12',
  neighborhood: 'Σύνταγμα',
  city: 'Αθήνα',
  region: 'Αττική',
  postalCode: '105 63',
  countryCode: 'GR',
  phone: '+302101234567',
  email: 'info@psalidi.gr',
  website: 'https://psalidi.gr/',
  timezone: 'Europe/Athens',
  currency: 'EUR',
  logoUrl: null,
  businessHours: [],
  bookingRules: {
    slotIntervalMinutes: 15,
    minLeadTimeMinutes: 60,
    maxAdvanceDays: 60,
    cancellationCutoffMinutes: 1440,
  },
  supportEmail: 'support@koureia.gr',
};

describe('CompanyShop', () => {
  let fixture: ComponentFixture<CompanyShop>;
  let codes: Set<string>;
  const api = {
    settings: vi.fn<() => Observable<Result<CompanySettingsResponse>>>(),
    uploadLogo: vi.fn<(file: Blob) => Observable<Result<CompanyLogoResponse>>>(),
    deleteLogo: vi.fn<() => Observable<Result<null>>>(),
  };
  const confirmation = { open: vi.fn(() => Promise.resolve('confirmed')) };
  const toaster = { success: vi.fn(), error: vi.fn() };

  async function render(
    settings: Result<CompanySettingsResponse>,
    held: readonly string[] = [],
  ): Promise<void> {
    api.settings.mockReturnValue(of(settings));
    codes = new Set(held);
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        providePageSections({ discardMessage: 'managementCompany.discard.message' }),
        CompanyStore,
        { provide: CompanyApi, useValue: api },
        {
          provide: StaffAccessStore,
          useValue: {
            has: (code: string) => codes.has(code),
            company: () => ({ id: 'c1', name: 'Shop', timezone: null }),
          },
        },
        { provide: ToasterService, useValue: toaster },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    });
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('managementCompany/en', {
        inlineLoader: companyInlineLoader,
      }),
    );
    fixture = TestBed.createComponent(CompanyShop);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent.replace(/\s+/g, ' ');
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the name, the address on two lines and the contact details', async () => {
    await render(Result.Ok(SETTINGS));

    expect(host().querySelector('lib-page-section')?.id).toBe('shop');
    expect(text()).toContain('Κουρεμένο Ψαλίδι');
    const lines = Array.from(host().querySelectorAll('address span')).map((line) =>
      line.textContent.trim(),
    );
    expect(lines).toEqual(['Ερμού 12, Σύνταγμα', '105 63 Αθήνα, Αττική']);
    expect(text()).toContain('+30 210 123 4567');
    expect(host().querySelector('a[href="mailto:info@psalidi.gr"]')).not.toBeNull();
    expect(host().querySelector<HTMLAnchorElement>('a[href="https://psalidi.gr/"]')?.target).toBe(
      '_blank',
    );
    expect(text()).toContain('psalidi.gr');
  });

  it('leaves out an empty neighborhood, region and website', async () => {
    await render(Result.Ok({ ...SETTINGS, neighborhood: null, region: null, website: null }));

    const lines = Array.from(host().querySelectorAll('address span')).map((line) =>
      line.textContent.trim(),
    );
    expect(lines).toEqual(['Ερμού 12', '105 63 Αθήνα']);
    expect(text()).not.toContain('Website');
  });

  it('links the public page in the current language, in a new tab', async () => {
    await render(Result.Ok(SETTINGS));

    const link = host().querySelector<HTMLAnchorElement>('a[href^="/en/barbershops/"]');
    expect(link?.getAttribute('href')).toBe('/en/barbershops/kouremeno-psalidi');
    expect(link?.target).toBe('_blank');
  });

  it('names support with its address, and without one when there is none', async () => {
    await render(Result.Ok(SETTINGS));
    expect(text()).toContain('contact support.');
    expect(host().querySelector('a[href="mailto:support@koureia.gr"]')).not.toBeNull();

    TestBed.resetTestingModule();
    await render(Result.Ok({ ...SETTINGS, supportEmail: null }));
    expect(text()).toContain('contact support.');
    expect(host().querySelector('a[href^="mailto:support"]')).toBeNull();
  });

  it('shows the logo, or a store icon without one', async () => {
    await render(Result.Ok(SETTINGS));
    expect(host().querySelector('.shop-logo svg')).not.toBeNull();

    TestBed.resetTestingModule();
    await render(Result.Ok({ ...SETTINGS, logoUrl: 'https://cdn.test/logo.webp' }));
    expect(host().querySelector('.shop-logo img')?.getAttribute('src')).toBe(
      'https://cdn.test/logo.webp',
    );
  });

  it('tells a reader without the permission who changes the settings', async () => {
    await render(Result.Ok(SETTINGS));
    expect(text()).toContain('Edit company settings');

    TestBed.resetTestingModule();
    await render(Result.Ok(SETTINGS), ['company:update']);
    expect(text()).not.toContain('Edit company settings');
  });

  it('shows the failure with a retry', async () => {
    await render(Result.Fail({ errorCode: 'HTTP_500', httpCode: 500, validationErrors: [] }));

    expect(host().querySelector('[role="alert"]')).not.toBeNull();
    api.settings.mockReturnValue(of(Result.Ok(SETTINGS)));
    host().querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Κουρεμένο Ψαλίδι');
  });

  describe('the logo', () => {
    beforeAll(() => {
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        this.open = true;
      };
      HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
        this.open = false;
      };
    });

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }

    function button(label: string): HTMLButtonElement | undefined {
      return Array.from(host().querySelectorAll('button')).find(
        (candidate) => candidate.textContent.trim() === label,
      );
    }

    /** Puts files in the hidden chooser, as the browser does after a pick. */
    async function choose(file: File): Promise<void> {
      const input = host().querySelector<HTMLInputElement>('input[type="file"]');
      if (input === null) throw new Error('chooser not rendered');
      // jsdom has no `DataTransfer` to build a real `FileList` with.
      const files = Object.assign([file], { item: (index: number) => (index === 0 ? file : null) });
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
    }

    it('offers Change and Remove only with company:update, and Remove only with a logo', async () => {
      await render(Result.Ok({ ...SETTINGS, logoUrl: 'https://cdn.test/logo.webp' }));
      expect(button('Change logo')).toBeUndefined();

      TestBed.resetTestingModule();
      await render(Result.Ok(SETTINGS), ['company:update']);
      expect(button('Change logo')).toBeDefined();
      expect(button('Remove logo')).toBeUndefined();

      TestBed.resetTestingModule();
      await render(Result.Ok({ ...SETTINGS, logoUrl: 'https://cdn.test/logo.webp' }), [
        'company:update',
      ]);
      expect(button('Remove logo')).toBeDefined();
    });

    it('refuses a file the API would refuse before the crop', async () => {
      await render(Result.Ok(SETTINGS), ['company:update']);

      await choose(new File(['x'], 'logo.gif', { type: 'image/gif' }));

      expect(toaster.error).toHaveBeenCalledWith(
        'File not accepted. JPEG, PNG or WebP up to 10 MB.',
      );
      expect(host().querySelector('lib-image-cropper')).toBeNull();
    });

    it('sends the cropped square as a file that keeps its image type', async () => {
      const cropped = new Blob(['webp'], { type: 'image/webp' });
      api.uploadLogo.mockReturnValue(of(Result.Ok({ logoUrl: 'https://cdn.test/new.webp' })));
      await render(Result.Ok(SETTINGS), ['company:update']);

      await choose(new File(['x'], 'shop.png', { type: 'image/png' }));
      const dialog = fixture.debugElement.query(By.directive(LogoCropDialog))
        .componentInstance as LogoCropDialog;
      const cropper = (
        dialog as unknown as { cropper(): { crop(): Promise<Blob | null> } }
      ).cropper();
      vi.spyOn(cropper, 'crop').mockResolvedValue(cropped);
      await (dialog as unknown as { save(): Promise<void> }).save();
      await settle();

      const sent = api.uploadLogo.mock.calls.at(0)?.[0];
      expect(sent).toBeInstanceOf(File);
      expect(sent?.type).toBe('image/webp');
      expect(toaster.success).toHaveBeenCalledWith('Logo saved.');
      expect(host().querySelector('.shop-logo img')?.getAttribute('src')).toBe(
        'https://cdn.test/new.webp',
      );
    });

    it('cannot be closed during an upload, and opens again after a failure', async () => {
      const upload = new Subject<Result<CompanyLogoResponse>>();
      api.uploadLogo.mockReturnValue(upload);
      await render(Result.Ok(SETTINGS), ['company:update']);

      await choose(new File(['x'], 'shop.png', { type: 'image/png' }));
      const debug = fixture.debugElement.query(By.directive(LogoCropDialog));
      const dialog = debug.componentInstance as LogoCropDialog;
      const cropper = (
        dialog as unknown as { cropper(): { crop(): Promise<Blob | null> } }
      ).cropper();
      vi.spyOn(cropper, 'crop').mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
      const saving = (dialog as unknown as { save(): Promise<void> }).save();
      await settle();

      const frame = debug.query(By.directive(Dialog)).componentInstance as Dialog;
      expect(frame.closable()).toBe(false);
      expect(frame.closeOnEscape()).toBe(false);

      upload.next(
        Result.Fail({ errorCode: 'COMPANY_LOGO_INVALID', httpCode: 400, validationErrors: [] }),
      );
      upload.complete();
      await saving;
      await settle();
      expect(frame.closable()).toBe(true);
      dialog.visible.set(false);
      await settle();

      await choose(new File(['x'], 'shop.png', { type: 'image/png' }));
      expect(dialog.visible()).toBe(true);
    });

    it('names a JPEG crop as one', () => {
      const file = logoFile(new Blob(['x'], { type: 'image/jpeg' }));
      expect(file.type).toBe('image/jpeg');
      expect(file.name).toBe('logo.jpg');
    });

    it('asks before it removes the logo, and keeps it on Cancel', async () => {
      confirmation.open.mockResolvedValueOnce('cancelled');
      await render(Result.Ok({ ...SETTINGS, logoUrl: 'https://cdn.test/logo.webp' }), [
        'company:update',
      ]);

      button('Remove logo')?.click();
      await settle();

      expect(confirmation.open).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remove the logo?' }),
      );
      expect(api.deleteLogo).not.toHaveBeenCalled();
    });

    it('removes the logo after the confirmation and shows the icon', async () => {
      api.deleteLogo.mockReturnValue(of(Result.Ok(null)));
      await render(Result.Ok({ ...SETTINGS, logoUrl: 'https://cdn.test/logo.webp' }), [
        'company:update',
      ]);

      button('Remove logo')?.click();
      await settle();

      expect(api.deleteLogo).toHaveBeenCalledOnce();
      expect(host().querySelector('.shop-logo img')).toBeNull();
      expect(toaster.success).toHaveBeenCalledWith('Logo removed.');
    });
  });
});

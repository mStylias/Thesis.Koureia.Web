import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import {
  CompanyApi,
  type CompanyPhotoResponse,
  type CompanySettingsResponse,
  type ReorderCompanyPhotosRequest,
} from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import { providePageSections } from '@features/management-shared-page-sections';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { Result, type HttpError } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import type { MenuItem } from '@ui/menu';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom, of, Subject, type Observable } from 'rxjs';

import { companyErrorMessages } from '../company.errors';
import { companyInlineLoader } from '../company.i18n';
import { CompanyStore } from '../company.store';
import { CompanyPhotos } from './company-photos';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

function photo(id: string): CompanyPhotoResponse {
  return { id, url: `https://cdn.test/${id}.webp`, width: 1600, height: 1200, altTexts: [] };
}

function image(name: string, type = 'image/jpeg', size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const SETTINGS = { id: 'c1', name: 'Shop', timezone: 'Europe/Athens' } as CompanySettingsResponse;

function failure(code: string, httpCode: number, onFile = false): HttpError {
  return {
    errorCode: onFile ? 'VALIDATION_FAILED' : code,
    httpCode,
    validationErrors: onFile ? [{ code, description: 'Server text', propertyName: 'file' }] : [],
  };
}

describe('CompanyPhotos', () => {
  let fixture: ComponentFixture<CompanyPhotos>;
  let codes: Set<string>;
  const api = {
    settings: vi.fn<() => Observable<Result<CompanySettingsResponse>>>(),
    photos: vi.fn<() => Observable<Result<CompanyPhotoResponse[]>>>(),
    uploadPhoto: vi.fn<(file: Blob) => Observable<Result<CompanyPhotoResponse>>>(),
    reorderPhotos:
      vi.fn<(request: ReorderCompanyPhotosRequest) => Observable<Result<CompanyPhotoResponse[]>>>(),
    deletePhoto: vi.fn<(id: string) => Observable<Result<null>>>(),
  };
  const confirmation = { open: vi.fn(() => Promise.resolve('confirmed')) };
  const toaster = { success: vi.fn(), error: vi.fn() };

  async function render(
    photos: readonly CompanyPhotoResponse[] = [photo('p1'), photo('p2'), photo('p3')],
    held: readonly string[] = ['company:update'],
  ): Promise<void> {
    api.settings.mockReturnValue(of(Result.Ok(SETTINGS)));
    api.photos.mockReturnValue(of(Result.Ok([...photos])));
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
        { provide: SYNAX_ERROR_MESSAGES, useFactory: companyErrorMessages },
      ],
    });
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('managementCompany/en', {
        inlineLoader: companyInlineLoader,
      }),
    );
    fixture = TestBed.createComponent(CompanyPhotos);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function order(): string[] {
    return Array.from(host().querySelectorAll<HTMLImageElement>('.photo-image')).map((img) =>
      img.src.replace('https://cdn.test/', '').replace('.webp', ''),
    );
  }

  /** Puts files in the hidden chooser, as the browser does after a pick. */
  async function choose(...files: File[]): Promise<void> {
    const input = host().querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('chooser not rendered');
    // jsdom has no `DataTransfer` to build a real `FileList` with.
    Object.defineProperty(input, 'files', {
      value: Object.assign([...files], { item: (index: number) => files.at(index) ?? null }),
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  /** The menu of the photo at `index`, as the component builds it. */
  function menu(index: number): readonly MenuItem[] {
    const card = fixture.componentInstance as unknown as {
      tiles(): readonly { items: readonly MenuItem[] }[];
    };
    return card.tiles().at(index)?.items ?? [];
  }

  async function pick(index: number, label: string): Promise<void> {
    menu(index)
      .find((item) => item.label === label)
      ?.command?.({ item: {} });
    await settle();
    await settle();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the photos in order, the first tagged as the main one, and the count', async () => {
    await render();

    expect(host().querySelector('lib-page-section')?.id).toBe('photos');
    expect(order()).toEqual(['p1', 'p2', 'p3']);
    const main = host().querySelector('.photo-tile:first-child .photo-main');
    expect(main?.textContent.trim()).toBe('Main');
    expect(host().querySelectorAll('.photo-main')).toHaveLength(1);
    expect(host().querySelector('.photos-count')?.textContent.trim()).toBe('3 of 20 photos');
  });

  it('says the limit is reached and disables Add at 20 photos', async () => {
    await render(Array.from({ length: 20 }, (_, index) => photo(`p${String(index)}`)));

    expect(host().querySelector('.photos-count')?.textContent.trim()).toBe(
      'The limit of 20 photos is reached. Delete one to add another.',
    );
    const add = host().querySelector<HTMLButtonElement>('[libPageSectionActions] button');
    expect(add?.disabled).toBe(true);
  });

  it('says when there are none', async () => {
    await render([]);

    expect(host().textContent).toContain('No photos.');
  });

  it('offers no Add and no menu without company:update', async () => {
    await render(undefined, []);

    expect(host().querySelector('input[type="file"]')).toBeNull();
    expect(host().querySelector('.photo-menu')).toBeNull();
  });

  it('uploads one file at a time, each as a tile until it lands', async () => {
    const first = new Subject<Result<CompanyPhotoResponse>>();
    const second = new Subject<Result<CompanyPhotoResponse>>();
    api.uploadPhoto.mockReturnValueOnce(first).mockReturnValueOnce(second);
    await render([]);

    await choose(image('a.jpg'), image('b.jpg'));

    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(host().querySelectorAll('.photo-upload')).toHaveLength(2);

    first.next(Result.Ok(photo('a')));
    first.complete();
    await settle();
    expect(api.uploadPhoto).toHaveBeenCalledTimes(2);
    expect(order()).toEqual(['a']);

    second.next(Result.Ok(photo('b')));
    second.complete();
    await settle();
    expect(order()).toEqual(['a', 'b']);
    expect(host().querySelectorAll('.photo-upload')).toHaveLength(0);
  });

  it('refuses a file the API would refuse, and the files beyond the limit', async () => {
    api.uploadPhoto.mockImplementation(() => of(Result.Ok(photo(`n${String(Math.random())}`))));
    await render(Array.from({ length: 19 }, (_, index) => photo(`p${String(index)}`)));

    await choose(image('big.jpg', 'image/jpeg', 16 * 1024 * 1024), image('a.jpg'), image('b.jpg'));

    expect(toaster.error).toHaveBeenCalledWith('File not accepted. JPEG, PNG or WebP up to 15 MB.');
    expect(toaster.error).toHaveBeenCalledWith(
      'Only 1 more photo fits. The others were not uploaded.',
    );
    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it('stops the remaining uploads at the limit, with a toast', async () => {
    api.uploadPhoto.mockReturnValue(of(Result.Fail(failure('COMPANY_PHOTO_LIMIT_REACHED', 409))));
    await render([]);

    await choose(image('a.jpg'), image('b.jpg'), image('c.jpg'));

    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(toaster.error).toHaveBeenCalledWith(
      'The shop already has 20 photos. The others were not uploaded.',
    );
    expect(host().querySelectorAll('.photo-upload')).toHaveLength(0);
  });

  it('shows a photo that is too small with its error on its tile, and removes the tile', async () => {
    api.uploadPhoto.mockReturnValue(of(Result.Fail(failure('COMPANY_PHOTO_TOO_SMALL', 400, true))));
    await render([]);

    await choose(image('small.jpg'));

    const tile = host().querySelector('.photo-upload[data-failed]');
    expect(tile?.textContent).toContain('The photo must be at least 600 pixels on its short side.');
    tile?.querySelectorAll('button')[1]?.click();
    await settle();
    expect(host().querySelector('.photo-upload')).toBeNull();
  });

  it('sends a failed file again on Try again', async () => {
    api.uploadPhoto
      .mockReturnValueOnce(of(Result.Fail(failure('COMPANY_PHOTO_TOO_SMALL', 400, true))))
      .mockReturnValueOnce(of(Result.Ok(photo('a'))));
    await render([]);
    await choose(image('a.jpg'));

    host().querySelector<HTMLButtonElement>('.photo-upload[data-failed] button')?.click();
    await settle();

    expect(api.uploadPhoto).toHaveBeenCalledTimes(2);
    expect(order()).toEqual(['a']);
    expect(host().querySelector('.photo-upload')).toBeNull();
  });

  it('queues a second choice behind the first, so the photos land in the order chosen', async () => {
    const first = new Subject<Result<CompanyPhotoResponse>>();
    api.uploadPhoto.mockReturnValueOnce(first).mockReturnValueOnce(of(Result.Ok(photo('b'))));
    await render([]);

    await choose(image('a.jpg'));
    await choose(image('b.jpg'));
    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);

    first.next(Result.Ok(photo('a')));
    first.complete();
    await settle();
    expect(api.uploadPhoto).toHaveBeenCalledTimes(2);
    expect(order()).toEqual(['a', 'b']);
  });

  it('stops the queue when the card goes away', async () => {
    const first = new Subject<Result<CompanyPhotoResponse>>();
    api.uploadPhoto.mockReturnValue(first);
    await render([]);
    await choose(image('a.jpg'), image('b.jpg'));

    fixture.destroy();
    first.next(Result.Ok(photo('a')));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(first.observed).toBe(false);
    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it('offers no move while a file goes up', async () => {
    api.uploadPhoto.mockReturnValue(new Subject<Result<CompanyPhotoResponse>>());
    await render();

    await choose(image('a.jpg'));

    expect(menu(1).find((item) => item.label === 'Move earlier')?.disabled).toBe(true);
    expect(menu(1).find((item) => item.label === 'Move later')?.disabled).toBe(true);
  });

  it('moves a photo from its menu, saves every id in the new order, and announces it', async () => {
    api.reorderPhotos.mockImplementation((request) =>
      of(Result.Ok(request.photoIds.map((id) => photo(id)))),
    );
    await render();

    await pick(2, 'Move earlier');

    expect(api.reorderPhotos).toHaveBeenCalledWith({ photoIds: ['p1', 'p3', 'p2'] });
    expect(order()).toEqual(['p1', 'p3', 'p2']);
    expect(host().querySelector('[aria-live="polite"]')?.textContent).toContain(
      'The photo moved to position 2.',
    );
  });

  it('offers no move past either end', async () => {
    await render();

    expect(menu(0).find((item) => item.label === 'Move earlier')?.disabled).toBe(true);
    expect(menu(2).find((item) => item.label === 'Move later')?.disabled).toBe(true);
    expect(menu(1).find((item) => item.label === 'Move later')?.disabled).toBe(false);
  });

  it('puts the order back with a toast when the save fails', async () => {
    api.reorderPhotos.mockReturnValue(
      of(Result.Fail({ errorCode: 'HTTP_500', httpCode: 500, validationErrors: [] })),
    );
    await render();

    await pick(0, 'Move later');

    expect(order()).toEqual(['p1', 'p2', 'p3']);
    expect(toaster.error).toHaveBeenCalledWith('The new order was not saved.');
  });

  it('reads the list again when the photos changed in the meantime', async () => {
    api.reorderPhotos.mockReturnValue(
      of(Result.Fail(failure('COMPANY_PHOTO_ORDER_MISMATCH', 409))),
    );
    await render();

    await pick(0, 'Move later');

    expect(api.photos).toHaveBeenCalledTimes(2);
  });

  it('asks before it deletes a photo', async () => {
    api.deletePhoto.mockReturnValue(of(Result.Ok(null)));
    await render();

    await pick(1, 'Delete');

    expect(confirmation.open).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete the photo?' }),
    );
    expect(api.deletePhoto).toHaveBeenCalledWith('p2');
    expect(order()).toEqual(['p1', 'p3']);
  });
});

import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';

import { Gallery } from './gallery';
import type { GalleryImage } from './gallery.types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

function photos(count: number): GalleryImage[] {
  return Array.from({ length: count }, (_, index) => ({
    src: `/photo-${String(index + 1)}.jpg`,
    alt: `Photo ${String(index + 1)}`,
    width: 1200,
    height: 800,
  }));
}

@Component({
  imports: [Gallery],
  template: `<lib-gallery [images]="images()" />`,
})
class GalleryHost {
  readonly images = signal<readonly GalleryImage[]>(photos(3));
}

describe('Gallery', () => {
  let fixture: ComponentFixture<GalleryHost>;
  let host: GalleryHost;
  let location: SpyLocation;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(selector: string): HTMLElement {
    const found = element().querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`${selector} not rendered`);
    return found;
  }

  function mosaicTiles(): HTMLButtonElement[] {
    return Array.from(
      element().querySelectorAll<HTMLButtonElement>('.gallery__mosaic .gallery__tile'),
    );
  }

  function tile(index: number): HTMLButtonElement {
    const found = mosaicTiles().at(index);
    if (found === undefined) throw new Error(`tile ${String(index)} not rendered`);
    return found;
  }

  function viewerImage(): HTMLImageElement | null {
    return element().querySelector<HTMLImageElement>('.viewer__image');
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(GalleryHost);
    host = fixture.componentInstance;
    location = TestBed.inject(Location) as SpyLocation;
    // A pipe must transform before the scope is loaded.
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('gallery/en'));
    await settle();
  });

  it('renders nothing without photos', async () => {
    host.images.set([]);
    await settle();

    expect(element().querySelector('.gallery')).toBeNull();
    expect(element().querySelector('lib-gallery-viewer')).toBeNull();
  });

  it('shows at most five tiles and offers every photo past them', async () => {
    host.images.set(photos(12));
    await settle();

    expect(mosaicTiles()).toHaveLength(5);
    expect(query('lib-gallery').getAttribute('data-count')).toBe('5');
    expect(query('.gallery__all').textContent).toContain('Show all photos (12)');
    expect(element().querySelectorAll('.gallery__strip .gallery__tile')).toHaveLength(12);
  });

  it('does not offer "show all" when every photo has a tile', async () => {
    host.images.set(photos(5));
    await settle();

    expect(element().querySelector('.gallery__all')).toBeNull();
  });

  it('names each tile after its photo and keeps the image itself decorative', () => {
    expect(tile(1).getAttribute('aria-label')).toBe('View full screen: Photo 2');
    expect(tile(1).querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('loads the main photo first and every other photo lazily', () => {
    const [main, second] = mosaicTiles().map((tile) => tile.querySelector('img'));

    expect(main?.getAttribute('fetchpriority')).toBe('high');
    expect(main?.hasAttribute('loading')).toBe(false);
    expect(second?.getAttribute('loading')).toBe('lazy');
    expect(second?.hasAttribute('fetchpriority')).toBe(false);
  });

  it('follows the phone strip with its counter', async () => {
    host.images.set(photos(4));
    await settle();
    expect(query('.gallery__counter').textContent.trim()).toBe('1 / 4');

    const strip = query('.gallery__strip');
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
    strip.scrollLeft = 600;
    strip.dispatchEvent(new Event('scroll'));
    await settle();

    expect(query('.gallery__counter').textContent.trim()).toBe('3 / 4');
  });

  it('opens the viewer at the photo that was chosen', async () => {
    tile(2).click();
    await settle();

    expect(viewerImage()?.getAttribute('src')).toBe('/photo-3.jpg');
    expect(viewerImage()?.getAttribute('alt')).toBe('Photo 3');
    expect(query('.viewer__caption').textContent.trim()).toBe('Photo 3');
    expect(query('.viewer__counter').textContent.trim()).toBe('3 / 3');
  });

  // Regression: pipes inside the dialog's headless template resolved against the dialog's scope
  // and every name in the viewer rendered as an empty string.
  it('names every viewer control and announces the position', async () => {
    tile(1).click();
    await settle();

    expect(query('.viewer__bar button').getAttribute('aria-label')).toBe('Close photos');
    expect(query('.viewer__step--previous').getAttribute('aria-label')).toBe('Previous photo');
    expect(query('.viewer__step--next').getAttribute('aria-label')).toBe('Next photo');
    expect(query('[aria-live="polite"]').textContent.trim()).toBe('Photo 2 of 3');
  });

  it('steps with the buttons and the arrow keys', async () => {
    tile(0).click();
    await settle();

    query('.viewer__step--next').click();
    await settle();
    expect(viewerImage()?.getAttribute('src')).toBe('/photo-2.jpg');

    query('.viewer').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await settle();
    expect(viewerImage()?.getAttribute('src')).toBe('/photo-3.jpg');

    query('.viewer').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    await settle();
    expect(viewerImage()?.getAttribute('src')).toBe('/photo-2.jpg');
  });

  // Regression: `libButton` binds `aria-disabled` on its host, and on the first render its `null`
  // overwrote this one, so the first photo offered a live "previous".
  it('marks "previous" unavailable when the viewer first opens on the first photo', async () => {
    tile(0).click();
    await settle();

    expect(query('.viewer__step--previous').getAttribute('aria-disabled')).toBe('true');
    expect(query('.viewer__step--next').hasAttribute('aria-disabled')).toBe(false);
  });

  it('stops at either end without disabling the focused button', async () => {
    tile(2).click();
    await settle();

    const next = query('.viewer__step--next') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(query('.viewer__step--previous').hasAttribute('aria-disabled')).toBe(false);

    next.click();
    await settle();
    expect(viewerImage()?.getAttribute('src')).toBe('/photo-3.jpg');
  });

  it('steps on a sideways swipe past the threshold and not before it', async () => {
    tile(0).click();
    await settle();
    const stage = query('.viewer__stage');

    stage.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { clientX: 180 }));
    await settle();
    expect(viewerImage()?.getAttribute('src')).toBe('/photo-1.jpg');

    stage.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 }));
    await settle();
    expect(viewerImage()?.getAttribute('src')).toBe('/photo-2.jpg');
  });

  it('fetches the photos either side of the current one', async () => {
    host.images.set(photos(6));
    await settle();
    tile(2).click();
    await settle();

    const preloaded = Array.from(element().querySelectorAll('.viewer__preload')).map((image) =>
      image.getAttribute('src'),
    );
    expect(preloaded).toEqual(['/photo-2.jpg', '/photo-4.jpg']);
  });

  it('pushes a history entry on open and spends it when the close button closes', async () => {
    // `SpyLocation.go` drops a push to the URL it is already on, so the call is what is asserted.
    const go = vi.spyOn(location, 'go');
    const back = vi.spyOn(location, 'back');
    tile(0).click();
    await settle();
    expect(go).toHaveBeenCalledTimes(1);

    query('.viewer__bar button').click();
    await settle();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('closes on the back gesture without going back a second time', async () => {
    const back = vi.spyOn(location, 'back');
    tile(0).click();
    await settle();

    location.simulateUrlPop('');
    await settle();

    expect(query('dialog').hasAttribute('data-closing')).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });
});

describe('Gallery copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'gallery.label': 'customer.galleryLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(GalleryHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { galleryLabel: 'Our work' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('gallery/en'));
    fixture.detectChanges();

    const section = (fixture.nativeElement as HTMLElement).querySelector('.gallery');
    expect(section?.getAttribute('aria-label')).toBe('Our work');
  });
});

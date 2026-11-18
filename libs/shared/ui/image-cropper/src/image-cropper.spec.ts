import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';

import { clampCenter, cropRectOf, layoutOf, panBy, visibleSide } from './core/crop-geometry';
import { ImageCropper } from './image-cropper';

describe('crop geometry', () => {
  const wide = { width: 2000, height: 1000 };

  it('shows the shorter side whole at zoom 1, and less as it zooms in', () => {
    expect(visibleSide(wide, 1)).toBe(1000);
    expect(visibleSide(wide, 2)).toBe(500);
    expect(visibleSide(wide, 0.5)).toBe(1000);
  });

  it('keeps the square inside the image', () => {
    expect(clampCenter(wide, { x: 0, y: 0 }, 1)).toEqual({ x: 500, y: 500 });
    expect(clampCenter(wide, { x: 5000, y: 5000 }, 2)).toEqual({ x: 1750, y: 750 });
  });

  it('moves the square against the drag, in image pixels', () => {
    // A 200 px square shows 1000 image px, so 20 px of drag is 100 image px.
    expect(panBy(wide, { x: 1000, y: 500 }, 1, 20, 0, 200)).toEqual({ x: 900, y: 500 });
  });

  it('lays the image out in percentages of the square', () => {
    expect(layoutOf(wide, { x: 1000, y: 500 }, 1)).toEqual({
      width: 200,
      height: 100,
      left: -50,
      top: 0,
    });
  });

  it('crops the square around the center', () => {
    expect(cropRectOf(wide, { x: 1000, y: 500 }, 2)).toEqual({ x: 750, y: 250, side: 500 });
  });
});

@Component({
  imports: [ImageCropper],
  template: `<lib-image-cropper [source]="source()" [maxZoom]="3" />`,
})
class Host {
  readonly source = signal<Blob | null>(null);
}

describe('ImageCropper', () => {
  let fixture: ComponentFixture<Host>;
  let revoke: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    revoke = vi.fn<(url: string) => void>();
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = revoke;
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    fixture = TestBed.createComponent(Host);
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function area(): HTMLElement {
    const element = root().querySelector('.cropper-area');
    if (!(element instanceof HTMLElement)) throw new Error('area not rendered');
    return element;
  }

  function slider(): HTMLInputElement {
    const element = root().querySelector('.cropper-slider');
    if (!(element instanceof HTMLInputElement)) throw new Error('slider not rendered');
    return element;
  }

  /** jsdom decodes nothing, so the image reports its size by hand. */
  async function loadImage(width: number, height: number): Promise<HTMLImageElement> {
    fixture.componentInstance.source.set(new Blob(['x'], { type: 'image/png' }));
    await settle();
    const image = root().querySelector('.cropper-image');
    if (!(image instanceof HTMLImageElement)) throw new Error('image not rendered');
    Object.defineProperty(image, 'naturalWidth', { value: width });
    Object.defineProperty(image, 'naturalHeight', { value: height });
    image.dispatchEvent(new Event('load'));
    await settle();
    return image;
  }

  it('is a focusable, described group with a disabled slider until an image loads', async () => {
    await settle();
    expect(area().getAttribute('role')).toBe('group');
    expect(area().tabIndex).toBe(0);
    expect(area().getAttribute('aria-describedby')).toMatch(/^image-cropper-hint-/);
    expect(slider().disabled).toBe(true);
  });

  it('centers a wide image and zooms with + and -', async () => {
    const image = await loadImage(2000, 1000);
    expect(image.style.width).toBe('200%');
    expect(image.style.left).toBe('-50%');
    expect(slider().disabled).toBe(false);

    area().dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    await settle();
    expect(Number(slider().value)).toBeCloseTo(1.1);

    for (let press = 0; press < 40; press++) {
      area().dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    }
    await settle();
    expect(Number(slider().value)).toBe(3);
  });

  it('moves the square with the arrow keys and stops at the edge', async () => {
    const image = await loadImage(2000, 1000);
    for (let press = 0; press < 100; press++) {
      area().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }
    await settle();
    // The square reached the image's right edge, so the image's left edge sits at -100%.
    expect(image.style.left).toBe('-100%');
  });

  it('revokes the object URL when the source changes', async () => {
    await loadImage(100, 100);
    fixture.componentInstance.source.set(null);
    await settle();
    expect(revoke).toHaveBeenCalledWith('blob:photo');
  });
});

describe('ImageCropper copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'imageCropper.hint': 'customer.hint' }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { hint: 'Drag your photo' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('imageCropper/en'));
    fixture.detectChanges();
    await fixture.whenStable();

    const hint = (fixture.nativeElement as HTMLElement).querySelector('.cropper-hint');
    if (!(hint instanceof HTMLElement)) throw new Error('hint not rendered');
    expect(hint.textContent.trim()).toBe('Drag your photo');
  });
});

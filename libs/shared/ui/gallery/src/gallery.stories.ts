import { Component, computed, input } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';

import { Gallery } from './gallery';
import type { GalleryImage } from './gallery.types';

/**
 * A per-story description plus an explicit "Show code" snippet. Every example renders through a
 * demo component, so the generated source would otherwise show the demo tag, not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const PHOTO_IDS = [
  '1585747860715-2ba37e788b70',
  '1536520002442-39764a41e987',
  '1592647420148-bfcc177e2117',
  '1503951914875-452162b0f3f1',
  '1599351431202-1e0f0137899a',
  '1605497788044-5a32c7078486',
];

/** Fictional demo photos. The set repeats past six, which is enough to show paging. */
function photos(count: number): GalleryImage[] {
  return Array.from({ length: count }, (_, index) => ({
    src: `https://images.unsplash.com/photo-${PHOTO_IDS[index % PHOTO_IDS.length]}?auto=format&fit=crop&w=1200&h=800&q=80`,
    alt: `Barbershop interior, photo ${String(index + 1)}`,
    width: 1200,
    height: 800,
  }));
}

@Component({
  selector: 'lib-gallery-demo',
  imports: [Gallery],
  template: `
    <div style="max-width: 65rem;">
      <lib-gallery [images]="images()" ariaLabel="Photos of the barbershop" />
    </div>
  `,
})
class GalleryDemo {
  readonly count = input(12);
  protected readonly images = computed(() => photos(this.count()));
}

const meta: Meta<GalleryDemo> = {
  title: 'Layout & Navigation/Gallery',
  component: GalleryDemo,
  decorators: [
    applicationConfig({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    }),
    moduleMetadata({ imports: [GalleryDemo] }),
  ],
  argTypes: {
    count: { control: { type: 'number', min: 0, max: 51 } },
  },
  args: { count: 12 },
};

export default meta;

type Story = StoryObj<GalleryDemo>;

export const Mosaic: Story = {
  parameters: doc(
    'The main photo and four more. More photos than tiles adds **Show all photos**. Narrow the ' +
      'canvas below `md` to see the swipeable strip.',
    `<lib-gallery [images]="photos" ariaLabel="Photos of the barbershop" />`,
  ),
};

export const ThreePhotos: Story = {
  args: { count: 3 },
  parameters: doc(
    'Fewer than five photos rearranges the mosaic, so no tile is ever empty.',
    `<lib-gallery [images]="photos.slice(0, 3)" />`,
  ),
};

export const OnePhoto: Story = {
  args: { count: 1 },
  parameters: doc('One photo fills the frame.', `<lib-gallery [images]="[photo]" />`),
};

export const Empty: Story = {
  args: { count: 0 },
  parameters: doc(
    'No photos renders nothing. The consumer owns the placeholder.',
    `<lib-gallery [images]="[]" />`,
  ),
};

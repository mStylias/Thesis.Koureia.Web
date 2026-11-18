import { Component, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { ImageCropper } from './image-cropper';
import type { ImageCropperShape } from './image-cropper.types';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const COLUMN = 'display: flex; flex-direction: column; gap: var(--space-3); max-width: 22rem;';
const ROW = 'display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;';
const PREVIEW =
  'width: var(--space-20); height: var(--space-20); border-radius: 50%; object-fit: cover;';

/** A wide sample so the crop has something to cut: stripes and a centered disc. */
function sampleImage(): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext('2d');
  if (context === null) return Promise.resolve(null);
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string): string => styles.getPropertyValue(name).trim();
  for (let stripe = 0; stripe < 12; stripe++) {
    context.fillStyle = token(stripe % 2 === 0 ? '--accent' : '--surface');
    context.fillRect(stripe * 100, 0, 100, 800);
  }
  context.fillStyle = token('--text-primary');
  context.beginPath();
  context.arc(600, 400, 220, 0, Math.PI * 2);
  context.fill();
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

@Component({
  selector: 'lib-image-cropper-demo',
  imports: [Button, ImageCropper],
  template: `
    <div style="${COLUMN}">
      <input type="file" accept="image/jpeg,image/png,image/webp" (change)="choose($event)" />
      <lib-image-cropper #cropper [source]="source()" [shape]="shape()" />
      <div style="${ROW}">
        <button libButton type="button" [disabled]="!cropper.ready()" (click)="crop(cropper)">
          Crop
        </button>
        @if (result(); as url) {
          <img alt="The cropped square" style="${PREVIEW}" [src]="url" />
        }
      </div>
    </div>
  `,
})
class ImageCropperDemo {
  /** The mask over the square. */
  readonly shape = input<ImageCropperShape>('circle');

  protected readonly source = signal<Blob | null>(null);
  protected readonly result = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      void sampleImage().then((blob) => {
        this.source.set(blob);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      const url = this.result();
      if (url !== null) URL.revokeObjectURL(url);
    });
  }

  protected choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (file) this.source.set(file);
  }

  protected async crop(cropper: ImageCropper): Promise<void> {
    const blob = await cropper.crop();
    const previous = this.result();
    if (previous !== null) URL.revokeObjectURL(previous);
    this.result.set(blob === null ? null : URL.createObjectURL(blob));
  }
}

const meta: Meta<ImageCropperDemo> = {
  title: 'Forms & input/Image cropper',
  component: ImageCropperDemo,
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
    moduleMetadata({ imports: [ImageCropperDemo] }),
  ],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<ImageCropperDemo>;

export const Avatar: Story = {
  args: { shape: 'circle' },
  argTypes: { shape: { control: 'inline-radio', options: ['circle', 'square'] } },
  render: (args) => ({
    props: args,
    template: `<lib-image-cropper-demo [shape]="shape" />`,
  }),
  parameters: doc(
    'Drag the image, or focus the square and use the arrow keys. Zoom with the slider or with ' +
      '`+` and `-`. Crop shows the square `crop()` returns. Choose a file to try a real photo.',
    `
<lib-image-cropper #cropper [source]="file" shape="circle" />
<button libButton [disabled]="!cropper.ready()" (click)="save(cropper)">Save</button>

// const square = await cropper.crop();
`,
  ),
};

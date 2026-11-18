import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Textarea } from './textarea';
import { TextareaResize, TextareaSize } from './textarea.types';

@Component({
  imports: [Textarea],
  template: `
    <textarea
      libTextarea
      [size]="size()"
      [invalid]="invalid()"
      [disabled]="disabled()"
      [resize]="resize()"
      [autoResize]="autoResize()"
      aria-label="Notes"
    ></textarea>
  `,
})
class TextareaHost {
  readonly size = signal<TextareaSize>('md');
  readonly invalid = signal(false);
  readonly disabled = signal(false);
  readonly resize = signal<TextareaResize>('vertical');
  readonly autoResize = signal(false);
}

describe('Textarea', () => {
  let fixture: ComponentFixture<TextareaHost>;
  let host: TextareaHost;

  function textarea(): HTMLTextAreaElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('textarea');
    if (!element) {
      throw new Error('textarea not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function type(value: string): Promise<void> {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(TextareaHost);
    host = fixture.componentInstance;
    await settle();
  });

  it('reflects the size for the styles to key off', async () => {
    expect(textarea().getAttribute('data-size')).toBe('md');

    host.size.set('lg');
    await settle();
    expect(textarea().getAttribute('data-size')).toBe('lg');
  });

  it('reflects invalid as data attribute and aria-invalid', async () => {
    expect(textarea().hasAttribute('data-invalid')).toBe(false);
    expect(textarea().hasAttribute('aria-invalid')).toBe(false);

    host.invalid.set(true);
    await settle();

    expect(textarea().hasAttribute('data-invalid')).toBe(true);
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
  });

  it('stays a native textarea — disabled works natively', async () => {
    host.disabled.set(true);
    await settle();
    expect(textarea().disabled).toBe(true);
  });

  it('maps the resize input to the data attribute', async () => {
    expect(textarea().getAttribute('data-resize')).toBe('vertical');

    host.resize.set('none');
    await settle();
    expect(textarea().getAttribute('data-resize')).toBe('none');
  });

  it('auto-resize overrides manual resize and marks the host', async () => {
    host.resize.set('both');
    host.autoResize.set(true);
    await settle();

    expect(textarea().hasAttribute('data-auto-resize')).toBe(true);
    // Auto-sizing owns the height, so the manual handle is suppressed.
    expect(textarea().getAttribute('data-resize')).toBe('none');
  });

  it('grows to fit content when autoResize is on', async () => {
    host.autoResize.set(true);
    await settle();

    // jsdom reports scrollHeight as 0, so stub it to a growing value to
    // prove the directive writes it back onto the inline height.
    Object.defineProperty(textarea(), 'scrollHeight', {
      configurable: true,
      get: () => 120,
    });

    await type('Several\nlines\nof\ntext');
    expect(textarea().style.height).toBe('120px');
  });

  it('does not touch the height when autoResize is off', async () => {
    await type('Several\nlines\nof\ntext');
    expect(textarea().style.height).toBe('');
  });

  it('releases the auto-sized height when autoResize is turned off', async () => {
    host.autoResize.set(true);
    await settle();
    Object.defineProperty(textarea(), 'scrollHeight', {
      configurable: true,
      get: () => 120,
    });
    await type('Several\nlines\nof\ntext');
    expect(textarea().style.height).toBe('120px');

    host.autoResize.set(false);
    await settle();

    // Otherwise the control stays frozen at its last auto-sized height,
    // ignoring both the stylesheet and the manual resize handle.
    expect(textarea().style.height).toBe('');
  });

  it('adds the border to the fitted height', async () => {
    host.autoResize.set(true);
    await settle();

    // border-box: `scrollHeight` stops at the border, so writing it back
    // bare left the control two hairlines short and clipped the last line.
    Object.defineProperty(textarea(), 'scrollHeight', {
      configurable: true,
      get: () => 120,
    });
    Object.defineProperty(textarea(), 'clientHeight', {
      configurable: true,
      get: () => 118,
    });
    Object.defineProperty(textarea(), 'offsetHeight', {
      configurable: true,
      get: () => 120,
    });

    await type('Several\nlines\nof\ntext');
    expect(textarea().style.height).toBe('122px');
  });

  it('does not re-measure while content and width are unchanged', async () => {
    host.autoResize.set(true);
    await settle();
    Object.defineProperty(textarea(), 'scrollHeight', {
      configurable: true,
      get: () => 120,
    });
    await type('Several\nlines\nof\ntext');

    // The render hook fires on every change-detection pass in the app, and
    // each re-measure writes `height` twice — which the Storybook host's
    // `style` MutationObserver turns into a resize loop.
    let stored = textarea().style.height;
    let writes = 0;
    Object.defineProperty(textarea().style, 'height', {
      configurable: true,
      get: () => stored,
      set: (next: string) => {
        writes = writes + 1;
        stored = next;
      },
    });

    await settle();
    await settle();
    expect(writes).toBe(0);

    // A genuine content change still re-fits.
    await type('More\ntext\nthan\nbefore\nby\nfar');
    expect(writes).toBeGreaterThan(0);
  });

  it('leaves a consumer-set inline height alone', async () => {
    textarea().style.height = '200px';
    await settle();
    await type('Several\nlines\nof\ntext');

    expect(textarea().style.height).toBe('200px');
  });
});

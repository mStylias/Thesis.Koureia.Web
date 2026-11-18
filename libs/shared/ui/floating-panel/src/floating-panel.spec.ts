import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';

import { FloatingPanel, FloatingPanelContent } from './floating-panel';

/** The bounds the probe reports, and the box the docked panel reports inside them. */
const BOUNDS = { left: 12, top: 68, width: 1000, height: 600 };
const DOCKED = { left: 692, top: 68, width: 320, height: 600 };

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

@Component({
  imports: [FloatingPanel, FloatingPanelContent],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Open</button>
    <div class="toolbar" #toolbar></div>
    <lib-floating-panel
      [(open)]="open"
      header="Columns"
      [insetTop]="insetTop()"
      [dockBelow]="docked() ? toolbar : null"
    >
      <ng-template libFloatingPanelContent>
        <input id="first" aria-label="Search" />
      </ng-template>
    </lib-floating-panel>
  `,
})
class Host {
  readonly open = signal(false);
  readonly insetTop = signal('');
  readonly docked = signal(false);
}

function setup(overrides: Record<string, string> = {}): ComponentFixture<Host> {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
      }),
      provideUiCopy(overrides),
    ],
  });
  return TestBed.createComponent(Host);
}

describe('FloatingPanel', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function panel(): HTMLElement {
    const found = document.querySelector<HTMLElement>('.fp');
    if (found == null) throw new Error('panel not rendered');
    return found;
  }

  function header(): HTMLElement {
    const found = panel().querySelector<HTMLElement>('.fp-header');
    if (found == null) throw new Error('header not rendered');
    return found;
  }

  function grip(): HTMLElement {
    const found = panel().querySelector<HTMLElement>('[data-fp-grip]');
    if (found == null) throw new Error('grip not rendered');
    return found;
  }

  function edge(name: string): HTMLElement {
    const found = panel().querySelector<HTMLElement>(`[data-edge="${name}"]`);
    if (found == null) throw new Error(`${name} grip not rendered`);
    return found;
  }

  function opener(): HTMLButtonElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '#opener',
    );
    if (found == null) throw new Error('opener not rendered');
    return found;
  }

  /** jsdom has no layout, so the bounds probe and the panel report a fixed box. */
  function stubLayout(): void {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const box = this.classList.contains('fp-bounds') ? BOUNDS : DOCKED;
      return { ...box, x: box.left, y: box.top, right: 0, bottom: 0, toJSON: () => ({}) };
    });
  }

  function drag(target: HTMLElement, dx: number, dy: number): void {
    target.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }),
    );
    target.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 100 + dx, clientY: 100 + dy }),
    );
    target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  }

  async function open(): Promise<void> {
    opener().focus();
    opener().click();
    await settle();
    stubLayout();
  }

  beforeEach(async () => {
    fixture = setup();
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('renders nothing until it opens', () => {
    expect(document.querySelector('.fp')).toBeNull();
  });

  it('opens a non-modal dialog named by its heading', async () => {
    await open();

    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().hasAttribute('aria-modal')).toBe(false);
    const title = document.getElementById(panel().getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent.trim()).toBe('Columns');
  });

  it('moves focus to the first control of its body', async () => {
    await open();

    expect(document.activeElement?.id).toBe('first');
  });

  it('closes on Escape, keeps the key to itself and gives focus back', async () => {
    await open();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);

    panel().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await settle();

    document.removeEventListener('keydown', outer);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener());
  });

  it('closes from its close button', async () => {
    await open();
    const close = header().querySelector<HTMLButtonElement>('button:not([data-fp-grip])');

    close?.click();
    await settle();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(opener());
  });

  it('starts docked, with no box of its own', async () => {
    await open();

    expect(panel().hasAttribute('data-placed')).toBe(false);
    expect(panel().style.left).toBe('');
  });

  it('moves when the header is dragged', async () => {
    await open();

    drag(header(), -200, 40);
    await settle();

    expect(panel().hasAttribute('data-placed')).toBe(true);
    expect(panel().style.left).toBe('492px');
    // The docked panel is as tall as the bounds, so it cannot move down.
    expect(panel().style.top).toBe('68px');
    expect(panel().style.width).toBe('320px');
  });

  it('does not move when the press lands on the close button', async () => {
    await open();
    const close = header().querySelector<HTMLElement>('button:not([data-fp-grip])');
    if (close == null) throw new Error('close button not rendered');

    drag(close, -200, 0);
    await settle();

    expect(panel().hasAttribute('data-placed')).toBe(false);
  });

  it('grows to the left from the west grip and keeps its right edge', async () => {
    await open();

    drag(edge('w'), -100, 0);
    await settle();

    expect(panel().style.left).toBe('592px');
    expect(panel().style.width).toBe('420px');
  });

  it('shrinks from the top grip and keeps its bottom edge', async () => {
    await open();

    drag(edge('n'), 0, 100);
    await settle();

    expect(panel().style.top).toBe('168px');
    expect(panel().style.height).toBe('500px');
  });

  it('moves with the arrow keys and resizes with Shift on the grip', async () => {
    await open();

    grip().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await settle();
    expect(panel().style.left).toBe('676px');

    grip().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
    );
    await settle();
    expect(panel().style.width).toBe('304px');
  });

  it('docks again on a double click of the header', async () => {
    await open();
    drag(header(), -200, 0);
    await settle();

    header().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();

    expect(panel().hasAttribute('data-placed')).toBe(false);
  });

  it('reopens where the user left it', async () => {
    await open();
    drag(header(), -200, 0);
    await settle();

    fixture.componentInstance.open.set(false);
    await settle();
    await open();

    expect(panel().style.left).toBe('492px');
  });

  it('opens below its anchor, so it never covers the trigger', async () => {
    fixture.componentInstance.docked.set(true);
    await settle();
    const toolbar = (fixture.nativeElement as HTMLElement).querySelector('.toolbar');
    if (toolbar == null) throw new Error('toolbar not rendered');
    vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue({
      ...BOUNDS,
      x: 0,
      y: 0,
      right: 0,
      bottom: 140,
      toJSON: () => ({}),
    });

    opener().click();
    await settle();

    expect(panel().style.getPropertyValue('--fp-dock-top')).toBe('140px');
  });

  it('opens with no anchor where the bounds start', async () => {
    await open();

    expect(panel().style.getPropertyValue('--fp-dock-top')).toBe('');
  });

  it('passes the top inset to its bounds', async () => {
    fixture.componentInstance.insetTop.set('var(--shell-header-height)');
    await open();

    const layer = document.querySelector<HTMLElement>('.fp-layer');
    expect(layer?.style.getPropertyValue('--floating-panel-inset-top')).toBe(
      'var(--shell-header-height)',
    );
  });
});

describe('FloatingPanel copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    const fixture = setup({ 'floatingPanel.close': 'customer.close' });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { close: 'Close it' } }, 'en', { merge: true });
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('floatingPanel/en'));
    fixture.detectChanges();
    await fixture.whenStable();

    const close = document.querySelector('.fp-header button:not([data-fp-grip])');
    expect(close?.getAttribute('aria-label')).toBe('Close it');
    fixture.destroy();
  });
});

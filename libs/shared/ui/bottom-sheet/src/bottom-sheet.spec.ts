import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideUiCopy } from '@util/ui-copy';

import { BottomSheet } from './bottom-sheet';

@Component({
  imports: [BottomSheet],
  template: `
    <lib-bottom-sheet [(expanded)]="expanded">
      <p libBottomSheetPeek class="peek">one line</p>
      <button libBottomSheetActions class="action" type="button">act</button>
      <button class="inside" type="button">inside</button>
    </lib-bottom-sheet>
  `,
})
class BottomSheetHost {
  readonly expanded = signal(false);
}

/** A pointer gesture as the sheet sees it: capture, move, release. */
function pointer(type: string, clientY: number): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'clientY', { value: clientY });
  Object.defineProperty(event, 'button', { value: 0 });
  return event;
}

describe('BottomSheet', () => {
  let fixture: ComponentFixture<BottomSheetHost>;
  let host: BottomSheetHost;

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

  function surface(): HTMLElement {
    return query('.sheet__surface');
  }

  function toggle(): HTMLElement {
    return query('.sheet__toggle');
  }

  // The grab starts on the header, which is where the handler is bound; the move
  // and the release go to the surface, which captured the pointer.
  function drag(from: number, to: number): void {
    query('.sheet__header').dispatchEvent(pointer('pointerdown', from));
    surface().dispatchEvent(pointer('pointermove', to));
    surface().dispatchEvent(pointer('pointerup', to));
  }

  /** Gives the sheet a layout, which jsdom otherwise reports as zero everywhere. */
  function layout(surfaceHeight: number, headerHeight: number, actionsHeight: number): void {
    const heights = new Map<string, number>([
      ['.sheet__surface', surfaceHeight],
      ['.sheet__header', headerHeight],
      ['.sheet__actions', actionsHeight],
    ]);
    for (const [selector, height] of heights) {
      Object.defineProperty(query(selector), 'offsetHeight', { value: height, configurable: true });
    }
  }

  beforeEach(async () => {
    // jsdom has no pointer capture.
    Element.prototype.setPointerCapture = function () {
      /* no-op */
    };
    Element.prototype.releasePointerCapture = function () {
      /* no-op */
    };
    Element.prototype.hasPointerCapture = function () {
      return false;
    };

    TestBed.configureTestingModule({
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
    });
    fixture = TestBed.createComponent(BottomSheetHost);
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('bottomSheet/en'));
    await settle();
  });

  it('collapses to a bar rather than disappearing', async () => {
    await settle();

    // The surface and the peek content are both present while collapsed. That is
    // the whole difference between this and a drawer.
    expect(host.expanded()).toBe(false);
    expect(surface()).toBeTruthy();
    expect(query('.peek').textContent).toBe('one line');
    expect(element().querySelector('.sheet__backdrop')).toBeNull();
  });

  it('holds the panel inert while collapsed so nothing tabs into it', async () => {
    await settle();
    expect(query('.sheet__panel').getAttribute('inert')).toBe('');

    host.expanded.set(true);
    await settle();
    expect(query('.sheet__panel').getAttribute('inert')).toBeNull();
  });

  it('expands on a tap of the bar', async () => {
    await settle();

    toggle().click();
    await settle();

    expect(host.expanded()).toBe(true);
    expect(element().querySelector('.sheet__backdrop')).toBeTruthy();
  });

  it('reports its state on the toggle without renaming it', async () => {
    await settle();
    const collapsedName = toggle().getAttribute('aria-label');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    host.expanded.set(true);
    await settle();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe(collapsedName);
  });

  it('expands on a drag up and collapses on a drag down', async () => {
    await settle();

    drag(400, 300);
    await settle();
    expect(host.expanded()).toBe(true);

    drag(300, 400);
    await settle();
    expect(host.expanded()).toBe(false);
  });

  it('never lets a drag lift the sheet off the edge it is pinned to', async () => {
    await settle();
    // 400 tall, showing a 100px band: it has 300px of travel and not a pixel more. Without a
    // stop, a long drag up translates past its resting place and opens a gap under the sheet.
    layout(400, 60, 40);

    query('.sheet__header').dispatchEvent(pointer('pointerdown', 700));
    surface().dispatchEvent(pointer('pointermove', 100));

    expect(surface().style.getPropertyValue('--drag')).toBe('-300px');

    surface().dispatchEvent(pointer('pointerup', 100));
    await settle();
    expect(host.expanded()).toBe(true);
  });

  it('stops an expanded sheet at the collapsed resting place', async () => {
    host.expanded.set(true);
    await settle();
    layout(400, 60, 40);

    query('.sheet__header').dispatchEvent(pointer('pointerdown', 100));
    surface().dispatchEvent(pointer('pointermove', 900));

    expect(surface().style.getPropertyValue('--drag')).toBe('300px');
  });

  it('keeps the actions slot out of the panel, so it shows while collapsed', async () => {
    await settle();

    expect(query('.sheet__actions .action')).toBeTruthy();
    expect(query('.sheet__panel').querySelector('.action')).toBeNull();
    // The panel goes inert while collapsed; the actions band must not.
    expect(query('.sheet__actions').hasAttribute('inert')).toBe(false);
  });

  it('ignores a drag too short to be meant', async () => {
    await settle();

    drag(400, 396);
    await settle();

    expect(host.expanded()).toBe(false);
  });

  it('does not let the click ending a drag undo it', async () => {
    await settle();

    drag(400, 300);
    // The browser fires a click on the button the drag ended over.
    toggle().click();
    await settle();

    expect(host.expanded()).toBe(true);
  });

  it('collapses on Escape and leaves the key alone when already collapsed', async () => {
    host.expanded.set(true);
    await settle();

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    query('lib-bottom-sheet').dispatchEvent(escape);
    await settle();
    expect(host.expanded()).toBe(false);

    const second = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const reached = vi.fn();
    element().addEventListener('keydown', reached);
    query('lib-bottom-sheet').dispatchEvent(second);
    await settle();

    expect(reached).toHaveBeenCalledOnce();
  });

  it('collapses when the backdrop is tapped', async () => {
    host.expanded.set(true);
    await settle();

    query('.sheet__backdrop').click();
    await settle();

    expect(host.expanded()).toBe(false);
  });

  it('locks page scrolling only while expanded', async () => {
    await settle();
    expect(document.body.style.overflow).toBe('');

    host.expanded.set(true);
    await settle();
    expect(document.body.style.overflow).toBe('hidden');

    host.expanded.set(false);
    await settle();
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus into the panel and hands it back to the bar', async () => {
    await settle();

    host.expanded.set(true);
    await settle();
    expect(document.activeElement).toBe(query('.sheet__panel'));

    host.expanded.set(false);
    await settle();
    expect(document.activeElement).toBe(toggle());
  });

  it('takes no focus on first paint', async () => {
    await settle();

    expect(document.activeElement).not.toBe(toggle());
    expect(document.activeElement).not.toBe(query('.sheet__panel'));
  });
});

describe('BottomSheet copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'bottomSheet.toggle': 'customer.sheetToggle' }),
      ],
    });
    const fixture = TestBed.createComponent(BottomSheetHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { sheetToggle: 'Your booking' } }, 'en', { merge: true });
    fixture.componentInstance.expanded.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('bottomSheet/en'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.sheet__toggle')?.getAttribute('aria-label')).toBe(
      'Your booking',
    );
    expect(element.querySelector('.sheet__backdrop')?.getAttribute('aria-label')).toBe(
      'Close details',
    );
  });
});

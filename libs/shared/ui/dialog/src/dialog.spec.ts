import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideUiCopy } from '@util/ui-copy';
import { Dialog, DialogFooter, DialogHeadless } from './dialog';
import { DIALOG_CLOSE_DELAY } from './dialog.constants';
import { DialogClosedEvent, DialogMaxHeight, DialogPosition, DialogSize } from './dialog.types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
    this.setAttribute('data-shown-modally', '');
  };
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
    this.removeAttribute('data-shown-modally');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.removeAttribute('data-shown-modally');
    this.dispatchEvent(new Event('close'));
  };
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

@Component({
  imports: [Dialog, DialogFooter, DialogHeadless],
  template: `
    <button id="opener" type="button">Open</button>
    <lib-dialog
      [(visible)]="visible"
      [(position)]="position"
      [(maximized)]="maximized"
      [size]="size()"
      [maxHeight]="maxHeight()"
      [header]="header()"
      [modal]="modal()"
      [closable]="closable()"
      [dismissible]="dismissible()"
      [closeOnEscape]="closeOnEscape()"
      [draggable]="draggable()"
      [maximizable]="maximizable()"
      [fullScreen]="fullScreen()"
      [ariaLabel]="ariaLabel()"
      (opened)="openedCount = openedCount + 1"
      (closed)="closedEvents.push($event)"
    >
      @if (headless()) {
        <ng-template libDialogHeadless let-dialog>
          <section class="custom-surface">
            <h2>Custom account dialog</h2>
            <button type="button" (click)="dialog.close()">Custom close</button>
          </section>
        </ng-template>
      } @else {
        <p class="body-copy">Dialog body</p>
        @if (footer()) {
          <ng-template libDialogFooter>Footer actions</ng-template>
        }
      }
    </lib-dialog>
  `,
})
class DialogHost {
  readonly visible = signal(false);
  readonly position = signal<DialogPosition>('center');
  readonly maximized = signal(false);
  readonly size = signal<DialogSize>('md');
  readonly maxHeight = signal<DialogMaxHeight>('viewport');
  readonly header = signal('Edit profile');
  readonly modal = signal(true);
  readonly closable = signal(true);
  readonly dismissible = signal(false);
  readonly closeOnEscape = signal(true);
  readonly draggable = signal(false);
  readonly maximizable = signal(false);
  readonly fullScreen = signal(false);
  readonly ariaLabel = signal('');
  readonly footer = signal(false);
  readonly headless = signal(false);
  openedCount = 0;
  readonly closedEvents: DialogClosedEvent[] = [];
}

describe('Dialog', () => {
  let fixture: ComponentFixture<DialogHost>;
  let host: DialogHost;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => {
    const element = root().querySelector<HTMLDialogElement>('dialog.dialog');
    if (!element) throw new Error('Dialog element not rendered');
    return element;
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
  };
  const finishClose = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, DIALOG_CLOSE_DELAY + 30));
    await settle();
  };

  beforeEach(async () => {
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
    fixture = TestBed.createComponent(DialogHost);
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('dialog/en'));
    await settle();
  });

  it('opens modally by default and labels itself from the heading', async () => {
    host.visible.set(true);
    await settle();

    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-shown-modally')).toBe(true);
    expect(dialog().getAttribute('aria-labelledby')).toMatch(/^lib-dialog-title-/);
    expect(dialog().textContent).toContain('Edit profile');
    expect(host.openedCount).toBe(1);
  });

  it('uses native non-modal mode without modal semantics', async () => {
    host.modal.set(false);
    host.visible.set(true);
    await settle();

    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-shown-modally')).toBe(false);
    expect(dialog().hasAttribute('aria-modal')).toBe(false);
  });

  it('reflects a stable maximum-height preset for scrollable content', async () => {
    host.maxHeight.set('md');
    host.visible.set(true);
    await settle();

    expect(dialog().getAttribute('data-max-height')).toBe('md');
  });

  it('lets an explicit aria label replace the built-in labelledby', async () => {
    host.ariaLabel.set('Account settings');
    host.visible.set(true);
    await settle();

    expect(dialog().getAttribute('aria-label')).toBe('Account settings');
    expect(dialog().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('closes from the translated close button and reports the reason', async () => {
    host.visible.set(true);
    await settle();
    root().querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')?.click();
    await finishClose();

    expect(dialog().open).toBe(false);
    expect(host.visible()).toBe(false);
    expect(host.closedEvents).toEqual([{ reason: 'close-button' }]);
  });

  it('honors Escape and backdrop dismissal independently', async () => {
    host.visible.set(true);
    await settle();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await finishClose();
    expect(host.closedEvents.at(-1)?.reason).toBe('escape');

    host.dismissible.set(true);
    host.visible.set(true);
    await settle();
    dialog().click();
    await finishClose();
    expect(host.closedEvents.at(-1)?.reason).toBe('backdrop');
  });

  it('ignores a backdrop click unless dismissible is enabled', async () => {
    host.visible.set(true);
    await settle();
    dialog().click();
    await finishClose();

    expect(dialog().open).toBe(true);
    expect(host.closedEvents).toHaveLength(0);
  });

  it('pins projected footer outside the scrolling content region', async () => {
    host.footer.set(true);
    host.visible.set(true);
    await settle();

    expect(dialog().querySelector('.dialog-content')?.textContent).toContain('Dialog body');
    expect(dialog().querySelector('.dialog-footer')?.textContent).toContain('Footer actions');
  });

  it('toggles maximization and supports permanent full-screen mode', async () => {
    host.maximizable.set(true);
    host.visible.set(true);
    await settle();

    const toggle = root().querySelector<HTMLButtonElement>('[aria-label="Maximize dialog"]');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    toggle?.click();
    await settle();
    expect(host.maximized()).toBe(true);
    expect(dialog().hasAttribute('data-full-screen')).toBe(true);
    // The name is stable across states; only aria-pressed flips, so a label
    // change is never re-announced while the button holds focus.
    expect(root().querySelector('[aria-label="Maximize dialog"]')).toBe(toggle);
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');

    host.fullScreen.set(true);
    host.maximized.set(false);
    await settle();
    expect(dialog().hasAttribute('data-full-screen')).toBe(true);
    expect(root().querySelector('[aria-label="Maximize dialog"]')).toBeNull();
  });

  it('offers a keyboard-accessible non-drag position chooser', async () => {
    host.draggable.set(true);
    host.visible.set(true);
    await settle();

    root().querySelector<HTMLButtonElement>('[aria-label="Move dialog"]')?.click();
    await settle();
    const right = root().querySelector<HTMLButtonElement>('[aria-label="Right"]');
    expect(right).not.toBeNull();
    right?.click();
    await settle();

    expect(host.position()).toBe('right');
    expect(dialog().getAttribute('data-position')).toBe('right');
    expect(root().querySelector('[role="group"]')).toBeNull();
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Move dialog');
  });

  it('closes only the position chooser on Escape, not a non-modal dialog', async () => {
    host.modal.set(false);
    host.draggable.set(true);
    host.visible.set(true);
    await settle();

    root().querySelector<HTMLButtonElement>('[aria-label="Move dialog"]')?.click();
    await settle();
    expect(root().querySelector('[role="group"]')).not.toBeNull();

    root()
      .querySelector('[role="group"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await finishClose();

    // The chooser handled Escape; the event must not reach the dialog's own
    // non-modal Escape handler, which would have closed the whole dialog.
    expect(root().querySelector('[role="group"]')).toBeNull();
    expect(dialog().open).toBe(true);
    expect(host.visible()).toBe(true);
    expect(host.closedEvents).toHaveLength(0);
  });

  it('free-drags with pointer events and emits only at drag end', async () => {
    host.draggable.set(true);
    host.visible.set(true);
    await settle();
    vi.spyOn(dialog(), 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 500,
      bottom: 400,
      width: 400,
      height: 300,
      toJSON: () => ({}),
    });
    const header = dialog().querySelector<HTMLElement>('.dialog-header');
    header?.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 150,
      }),
    );
    header?.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 190,
        clientY: 180,
      }),
    );
    expect(dialog().style.translate).toBe('40px 30px');
    header?.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await settle();
    expect(dialog().hasAttribute('data-dragging')).toBe(false);
  });

  it('does not carry an aborted close reason into the next close', async () => {
    host.visible.set(true);
    await settle();

    // Escape starts the exit animation…
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    // …and reopening before the delay elapses aborts that teardown.
    host.visible.set(true);
    await settle();
    await finishClose();
    expect(host.closedEvents).toHaveLength(0);
    expect(dialog().open).toBe(true);

    host.visible.set(false);
    await finishClose();

    expect(host.closedEvents).toEqual([{ reason: 'programmatic' }]);
  });

  it('renders only the consumer surface in headless mode', async () => {
    host.headless.set(true);
    host.ariaLabel.set('Custom account dialog');
    host.visible.set(true);
    await settle();

    expect(dialog().querySelector('.custom-surface')).not.toBeNull();
    expect(dialog().querySelector('.dialog-header')).toBeNull();
    expect(dialog().querySelector('.dialog-content')).toBeNull();

    dialog().querySelector<HTMLButtonElement>('.custom-surface button')?.click();
    await finishClose();
    expect(host.closedEvents.at(-1)?.reason).toBe('programmatic');
  });
});

describe('Dialog copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'dialog.closeDialog': 'customer.close' }),
      ],
    });
    const fixture = TestBed.createComponent(DialogHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { close: 'Close this' } }, 'en', { merge: true });
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    await firstValueFrom(transloco.load('dialog/en'));
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Close this"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Close dialog"]')).toBeNull();
  });
});

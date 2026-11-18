import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Drawer, DrawerFooter, DrawerHeader, DrawerToolbar } from './drawer';
import { DRAWER_CLOSE_DELAY } from './drawer.constants';
import { DrawerHandoff } from './drawer-handoff';
import { DrawerMode, DrawerPosition } from './drawer.types';

// jsdom does not implement the <dialog> methods; the component drives
// the dialog with showModal()/show()/close().
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
    this.setAttribute('data-shown-modally', '');
  };
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.removeAttribute('data-shown-modally');
    this.dispatchEvent(new Event('close'));
  };
});

@Component({
  imports: [Drawer, DrawerFooter, DrawerToolbar],
  template: `
    <lib-drawer
      [(visible)]="visible"
      [position]="position()"
      [mode]="mode()"
      [header]="header()"
      [closable]="closable()"
      [modal]="modal()"
      [dismissible]="dismissible()"
      [showBackdrop]="showBackdrop()"
      [closeOnEscape]="closeOnEscape()"
      [blockScroll]="blockScroll()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
      [closeAriaLabel]="closeAriaLabel()"
      [closeGuard]="closeGuard()"
      (opened)="openedCount = openedCount + 1"
      (closed)="closedCount = closedCount + 1"
    >
      @if (withToolbar()) {
        <div libDrawerToolbar>Toolbar actions</div>
      }

      <p>Drawer body</p>

      @if (withFooter()) {
        <div libDrawerFooter>Footer actions</div>
      }
    </lib-drawer>
  `,
})
class DrawerHost {
  readonly visible = signal(false);
  readonly position = signal<DrawerPosition>('left');
  readonly mode = signal<DrawerMode>('over');
  readonly header = signal('Your booking');
  readonly closable = signal(true);
  readonly modal = signal(true);
  readonly dismissible = signal(true);
  readonly showBackdrop = signal(true);
  readonly closeOnEscape = signal(true);
  readonly blockScroll = signal(false);
  readonly ariaLabel = signal('');
  readonly ariaLabelledby = signal('');
  // Left empty so the translated fallback path stays live — pinning it
  // would short-circuit the very binding that carries the pipe.
  readonly closeAriaLabel = signal('');
  readonly withToolbar = signal(false);
  readonly withFooter = signal(false);
  readonly closeGuard = signal<(() => boolean | Promise<boolean>) | null>(null);

  openedCount = 0;
  closedCount = 0;
}

describe('Drawer', () => {
  let fixture: ComponentFixture<DrawerHost>;
  let host: DrawerHost;

  function dialog(): HTMLDialogElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>(
      'dialog.drawer',
    );
    if (!element) {
      throw new Error('drawer dialog not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Waits out the exit transition so the drawer can close for real. */
  async function closeDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, DRAWER_CLOSE_DELAY + 50));
    await settle();
  }

  function closeButton(): HTMLButtonElement {
    const element = dialog().querySelector<HTMLButtonElement>('.drawer-close');
    if (!element) {
      throw new Error('drawer close button not rendered');
    }
    return element;
  }

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
    fixture = TestBed.createComponent(DrawerHost);
    host = fixture.componentInstance;
    await settle();
    // The `drawer` scope loads lazily via dynamic import, and only a
    // transformed pipe registers the inline loader — hence the settle()
    // above before the load, never the other way round.
    await firstValueFrom(TestBed.inject(TranslocoService).load('drawer/en'));
    await settle();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('stays closed until visible becomes true, then opens modally', async () => {
    expect(dialog().open).toBe(false);

    host.visible.set(true);
    await settle();

    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-shown-modally')).toBe(true);
    expect(dialog().textContent).toContain('Your booking');
    expect(dialog().textContent).toContain('Drawer body');
    expect(host.openedCount).toBe(1);
  });

  it('opens non-modally when modal is false', async () => {
    host.modal.set(false);
    host.visible.set(true);
    await settle();

    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-shown-modally')).toBe(false);
  });

  it('reflects position and size on the dialog element', async () => {
    host.position.set('right');
    host.visible.set(true);
    await settle();

    expect(dialog().getAttribute('data-position')).toBe('right');
    expect(dialog().getAttribute('data-size')).toBe('md');
  });

  it('closes through the × button, syncing visible and emitting closed', async () => {
    host.visible.set(true);
    await settle();

    dialog().querySelector<HTMLButtonElement>('.drawer-close')?.click();
    await closeDelay();

    expect(dialog().open).toBe(false);
    expect(host.visible()).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  describe('the close guard', () => {
    it('keeps the drawer open when it answers false', async () => {
      const guard = vi.fn(() => Promise.resolve(false));
      host.closeGuard.set(guard);
      host.visible.set(true);
      await settle();

      closeButton().click();
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      await closeDelay();

      expect(guard).toHaveBeenCalled();
      expect(dialog().open).toBe(true);
      expect(host.visible()).toBe(true);
    });

    it('closes when it answers true', async () => {
      host.closeGuard.set(() => true);
      host.visible.set(true);
      await settle();

      closeButton().click();
      await closeDelay();

      expect(host.visible()).toBe(false);
      expect(host.closedCount).toBe(1);
    });

    it('asks once while an answer is pending', async () => {
      let answer: (value: boolean) => void = () => undefined;
      const guard = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            answer = resolve;
          }),
      );
      host.closeGuard.set(guard);
      host.visible.set(true);
      await settle();

      closeButton().click();
      closeButton().click();
      answer(true);
      await closeDelay();

      expect(guard).toHaveBeenCalledTimes(1);
      expect(host.visible()).toBe(false);
    });

    it('is not asked when visible is set to false from outside', async () => {
      const guard = vi.fn(() => false);
      host.closeGuard.set(guard);
      host.visible.set(true);
      await settle();

      host.visible.set(false);
      await closeDelay();

      expect(guard).not.toHaveBeenCalled();
      expect(dialog().open).toBe(false);
    });
  });

  it('puts the content back at its top on request', async () => {
    host.visible.set(true);
    await settle();
    const content = dialog().querySelector<HTMLElement>('.drawer-content');
    if (content === null) throw new Error('drawer content not rendered');
    content.scrollTop = 120;

    const drawer: Drawer = fixture.debugElement.query(By.directive(Drawer)).injector.get(Drawer);
    drawer.scrollToTop();

    expect(content.scrollTop).toBe(0);
  });

  // A host destroyed by the router renders no more bindings, so the exit is written to the DOM.
  describe('a drawer that takes the place of another', () => {
    function swap(): string | null {
      return dialog().getAttribute('data-swap');
    }

    async function openHandedOff(direction: 'forward' | 'back' | 'none'): Promise<void> {
      TestBed.inject(DrawerHandoff).pass(direction);
      host.visible.set(true);
      await settle();
    }

    it('opens without its own entrance, and its content drifts in', async () => {
      await openHandedOff('forward');

      expect(dialog().hasAttribute('data-instant')).toBe(false);
      expect(swap()).toBe('forward');
    });

    it('swaps at once at the same level', async () => {
      await openHandedOff('none');

      expect(swap()).toBeNull();
    });

    it('ends when the content has settled', async () => {
      await openHandedOff('back');

      dialog()
        .querySelector('.drawer-content')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));

      expect(swap()).toBeNull();
    });

    it('plays its own entrance once a pass has expired', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        TestBed.inject(DrawerHandoff).pass('forward');
        vi.setSystemTime(Date.now() + 2000);
        host.visible.set(true);
        await settle();

        expect(swap()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('plays its exit on request, and waits out one already running', async () => {
    host.visible.set(true);
    await settle();
    const drawer: Drawer = fixture.debugElement.query(By.directive(Drawer)).injector.get(Drawer);

    const started = Date.now();
    const exited = drawer.exit();
    expect(dialog().hasAttribute('data-closing')).toBe(true);
    await exited;
    expect(Date.now() - started).toBeGreaterThanOrEqual(DRAWER_CLOSE_DELAY - 5);
    expect(dialog().open).toBe(false);

    host.visible.set(true);
    await settle();
    host.visible.set(false);
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const joined = Date.now();
    await drawer.exit();
    expect(Date.now() - joined).toBeLessThan(DRAWER_CLOSE_DELAY - 150);
  });

  it('hides the × button when not closable', async () => {
    host.closable.set(false);
    host.visible.set(true);
    await settle();

    expect(dialog().querySelector('.drawer-close')).toBeNull();
    // No header string beyond the default and no close button → headless.
    host.header.set('');
    await settle();
    expect(dialog().querySelector('.drawer-header')).toBeNull();
  });

  it('names the × button from the drawer scope when none is given', async () => {
    host.visible.set(true);
    await settle();

    expect(closeButton().getAttribute('aria-label')).toBe('Close drawer');
    // Decorative — the button already carries the name.
    expect(closeButton().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lets a consumer override the × button name', async () => {
    host.closeAriaLabel.set('Κλείσιμο');
    host.visible.set(true);
    await settle();

    expect(closeButton().getAttribute('aria-label')).toBe('Κλείσιμο');
  });

  it('withholds autofocus from push drawers', async () => {
    host.visible.set(true);
    await settle();
    // An overlay drawer is always opened by an action, so pulling focus
    // to the × is right.
    expect(closeButton().hasAttribute('autofocus')).toBe(true);

    host.mode.set('push');
    await settle();
    // Page furniture that can start open: the native dialog focusing
    // steps run for show() too, so this would grab focus on first paint.
    expect(closeButton().hasAttribute('autofocus')).toBe(false);
  });

  it('leaves focus where it was when a push drawer opens', async () => {
    // Browsers run the dialog focusing steps for show() too, which focus the
    // first focusable descendant even with no autofocus.
    const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'show');
    HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector<HTMLElement>('button')?.focus();
    };
    try {
      const trigger = document.createElement('button');
      document.body.append(trigger);
      trigger.focus();
      host.mode.set('push');
      host.visible.set(true);
      await settle();

      expect(dialog().open).toBe(true);
      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    } finally {
      if (show !== undefined) {
        Object.defineProperty(HTMLDialogElement.prototype, 'show', show);
      }
    }
  });

  describe('the entrance of a push drawer', () => {
    /** Whether `show()` found the dialog marked instant, per call. */
    let instantAtShow: boolean[];
    let show: PropertyDescriptor | undefined;

    beforeEach(() => {
      instantAtShow = [];
      show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'show');
      HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
        instantAtShow.push(this.hasAttribute('data-instant'));
        this.open = true;
      };
    });

    afterEach(() => {
      if (show !== undefined) {
        Object.defineProperty(HTMLDialogElement.prototype, 'show', show);
      }
    });

    it('skips it when the drawer is open on its first render', async () => {
      // Regression: a calendar that restored its filters panel slid across on every load.
      const fresh = TestBed.createComponent(DrawerHost);
      fresh.componentInstance.mode.set('push');
      fresh.componentInstance.visible.set(true);
      fresh.detectChanges();
      await fresh.whenStable();

      expect(instantAtShow).toEqual([true]);
      const opened = (fresh.nativeElement as HTMLElement).querySelector('dialog.drawer');
      expect(opened?.hasAttribute('data-instant')).toBe(false);
    });

    it('keeps it for an open the user asks for later', async () => {
      host.mode.set('push');
      host.visible.set(true);
      await settle();

      expect(instantAtShow).toEqual([false]);
    });
  });

  it('names the dialog from its header', async () => {
    host.visible.set(true);
    await settle();

    const labelledBy = dialog().getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(dialog().querySelector(`#${labelledBy}`)?.textContent).toContain('Your booking');
  });

  it('names a headless dialog from ariaLabel', async () => {
    host.header.set('');
    host.closable.set(false);
    host.ariaLabel.set('Filters');
    host.visible.set(true);
    await settle();

    // No header at all — the label input is the only accessible name.
    expect(dialog().querySelector('.drawer-header')).toBeNull();
    expect(dialog().getAttribute('aria-label')).toBe('Filters');
  });

  it('names a headless dialog from ariaLabelledby', async () => {
    host.header.set('');
    host.closable.set(false);
    host.ariaLabelledby.set('external-heading');
    host.visible.set(true);
    await settle();

    expect(dialog().getAttribute('aria-labelledby')).toBe('external-heading');
  });

  it('prefers its own header over a supplied ariaLabelledby', async () => {
    host.ariaLabelledby.set('external-heading');
    host.visible.set(true);
    await settle();

    expect(dialog().getAttribute('aria-labelledby')).not.toBe('external-heading');
  });

  it('closes when visible is set to false from outside', async () => {
    host.visible.set(true);
    await settle();

    host.visible.set(false);
    await closeDelay();

    expect(dialog().open).toBe(false);
    expect(host.closedCount).toBe(1);
  });

  it('closes on Escape (native cancel) by default', async () => {
    host.visible.set(true);
    await settle();

    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await closeDelay();

    expect(dialog().open).toBe(false);
    expect(host.visible()).toBe(false);
  });

  it('ignores Escape when closeOnEscape is false', async () => {
    host.closeOnEscape.set(false);
    host.visible.set(true);
    await settle();

    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await closeDelay();

    expect(dialog().open).toBe(true);
    expect(host.visible()).toBe(true);
  });

  it('closes on a mask click when dismissible', async () => {
    host.visible.set(true);
    await settle();

    dialog().click();
    await closeDelay();

    expect(dialog().open).toBe(false);
  });

  it('ignores mask clicks when not dismissible', async () => {
    host.dismissible.set(false);
    host.visible.set(true);
    await settle();

    dialog().click();
    await closeDelay();

    expect(dialog().open).toBe(true);
  });

  it('does not treat clicks inside the panel as mask clicks', async () => {
    host.visible.set(true);
    await settle();

    dialog().querySelector<HTMLParagraphElement>('p')?.click();
    await closeDelay();

    expect(dialog().open).toBe(true);
  });

  it('marks the dialog when the backdrop is disabled', async () => {
    host.visible.set(true);
    await settle();
    expect(dialog().hasAttribute('data-no-backdrop')).toBe(false);

    host.showBackdrop.set(false);
    await settle();
    expect(dialog().hasAttribute('data-no-backdrop')).toBe(true);
  });

  it('renders the footer only when footer content is projected', async () => {
    host.visible.set(true);
    await settle();
    expect(dialog().querySelector('.drawer-footer')).toBeNull();

    host.withFooter.set(true);
    await settle();
    expect(dialog().querySelector('.drawer-footer')?.textContent).toContain('Footer actions');
  });

  it('renders the toolbar only when toolbar content is projected', async () => {
    host.visible.set(true);
    await settle();
    expect(dialog().querySelector('.drawer-toolbar')).toBeNull();

    host.withToolbar.set(true);
    await settle();
    expect(dialog().querySelector('.drawer-toolbar')?.textContent).toContain('Toolbar actions');
  });

  it('keeps the toolbar outside the scrolling content, between header and body', async () => {
    host.withToolbar.set(true);
    host.visible.set(true);
    await settle();

    const toolbar = dialog().querySelector('.drawer-toolbar');
    if (toolbar == null) {
      throw new Error('toolbar not rendered');
    }
    expect(toolbar.closest('.drawer-content')).toBeNull();
    expect(toolbar.previousElementSibling?.classList.contains('drawer-header')).toBe(true);
    expect(toolbar.nextElementSibling?.classList.contains('drawer-content')).toBe(true);
  });

  it('opens push drawers non-modally even when modal is set', async () => {
    host.mode.set('push');
    host.modal.set(true);
    host.visible.set(true);
    await settle();

    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-shown-modally')).toBe(false);
    expect(dialog().getAttribute('data-mode')).toBe('push');
  });

  it('ignores mask clicks in push mode', async () => {
    host.mode.set('push');
    host.visible.set(true);
    await settle();

    dialog().click();
    await closeDelay();

    expect(dialog().open).toBe(true);
  });

  it('closes push drawers on Escape via keydown', async () => {
    host.mode.set('push');
    host.visible.set(true);
    await settle();

    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await closeDelay();

    expect(dialog().open).toBe(false);
    expect(host.visible()).toBe(false);
  });

  it('blocks page scroll until the exit transition has finished', async () => {
    host.blockScroll.set(true);
    host.visible.set(true);
    await settle();
    expect(document.body.style.overflow).toBe('hidden');

    host.visible.set(false);
    await settle();
    // Still sliding out — releasing here would jump the page behind it.
    expect(document.body.style.overflow).toBe('hidden');

    await closeDelay();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the page overflow it found rather than clearing it', async () => {
    document.body.style.overflow = 'clip';
    host.blockScroll.set(true);
    host.visible.set(true);
    await settle();
    expect(document.body.style.overflow).toBe('hidden');

    host.visible.set(false);
    await settle();
    await closeDelay();

    expect(document.body.style.overflow).toBe('clip');
  });

  it('keeps the page locked while another drawer still holds it', async () => {
    const second = TestBed.createComponent(DrawerHost);
    second.componentInstance.blockScroll.set(true);
    try {
      host.blockScroll.set(true);
      host.visible.set(true);
      await settle();

      second.componentInstance.visible.set(true);
      second.detectChanges();
      await second.whenStable();
      expect(document.body.style.overflow).toBe('hidden');

      host.visible.set(false);
      await settle();
      await closeDelay();

      // The second drawer is still open; the page must stay locked.
      expect(document.body.style.overflow).toBe('hidden');

      second.componentInstance.visible.set(false);
      second.detectChanges();
      await second.whenStable();
      await new Promise((resolve) => setTimeout(resolve, DRAWER_CLOSE_DELAY + 50));
      second.detectChanges();
      await second.whenStable();

      expect(document.body.style.overflow).toBe('');
    } finally {
      second.destroy();
    }
  });
});

describe('Drawer copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'drawer.closeDrawer': 'customer.closeDrawer' }),
      ],
    });
    const fixture = TestBed.createComponent(DrawerHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { closeDrawer: 'Close this' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('drawer/en'));
    fixture.detectChanges();

    const close = (fixture.nativeElement as HTMLElement).querySelector('.drawer-close');
    expect(close?.getAttribute('aria-label')).toBe('Close this');
  });
});

@Component({
  imports: [Drawer, DrawerHeader],
  template: `
    <lib-drawer [visible]="true" [ariaLabelledby]="ariaLabelledby()">
      <div libDrawerHeader>
        <button type="button">Upload photo</button>
        <h2 id="member-name">Ada Lovelace</h2>
      </div>
    </lib-drawer>
  `,
})
class ProjectedHeaderHost {
  readonly ariaLabelledby = signal('member-name');
}

describe('Drawer with a projected header', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
  });

  async function render(): Promise<ComponentFixture<ProjectedHeaderHost>> {
    const fixture = TestBed.createComponent(ProjectedHeaderHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function dialogOf(fixture: ComponentFixture<ProjectedHeaderHost>): HTMLDialogElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('dialog.drawer');
    if (!(element instanceof HTMLDialogElement)) throw new Error('drawer dialog not rendered');
    return element;
  }

  // A header that holds a button must not put the button's name in the dialog's.
  it('takes its name from ariaLabelledby', async () => {
    const fixture = await render();
    expect(dialogOf(fixture).getAttribute('aria-labelledby')).toBe('member-name');
  });

  it('names itself from the whole header without one', async () => {
    const fixture = await render();
    fixture.componentInstance.ariaLabelledby.set('');
    fixture.detectChanges();
    await fixture.whenStable();
    const labelledBy = dialogOf(fixture).getAttribute('aria-labelledby');
    expect(dialogOf(fixture).querySelector(`#${labelledBy ?? ''}`)?.textContent).toContain(
      'Ada Lovelace',
    );
  });
});

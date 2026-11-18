import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MenuItem, MenuItemCommandEvent } from '@ui/menu';
import { ContextMenu } from './context-menu';
import { ContextMenuTrigger } from './context-menu-trigger';

@Component({
  imports: [ContextMenu, ContextMenuTrigger],
  template: `
    <div class="target" tabindex="0" [libContextMenu]="menu" [contextMenuDisabled]="disabled()">
      Right-click me
    </div>
    <lib-context-menu
      #menu
      [items]="items()"
      ariaLabel="File actions"
      (opened)="openedCount = openedCount + 1"
      (closed)="closedCount = closedCount + 1"
    />
  `,
})
class ContextMenuHost {
  readonly items = signal<readonly MenuItem[]>([]);
  readonly disabled = signal(false);
  openedCount = 0;
  closedCount = 0;
}

@Component({
  imports: [ContextMenu],
  template: `<lib-context-menu global [items]="items()" />`,
})
class GlobalContextMenuHost {
  readonly items = signal<readonly MenuItem[]>([{ label: 'Anywhere' }]);
}

describe('ContextMenu', () => {
  let fixture: ComponentFixture<ContextMenuHost>;
  let host: ContextMenuHost;
  let commandEvents: MenuItemCommandEvent[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ContextMenuHost);
    host = fixture.componentInstance;
    commandEvents = [];
    host.items.set([
      {
        label: 'Open',
        command: (event) => commandEvents.push(event),
      },
      { label: 'Disabled', disabled: true, command: (e) => commandEvents.push(e) },
      { separator: true },
      {
        label: 'Share',
        items: [{ label: 'Email', command: (e) => commandEvents.push(e) }, { label: 'Copy link' }],
      },
      { label: 'Bookings', routerLink: ['/bookings'], queryParams: { d: '1' } },
      { label: 'Docs', url: 'https://example.com', target: '_blank' },
    ]);
    fixture.detectChanges();
  });

  function target(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('.target');
    if (!element) {
      throw new Error('target not rendered');
    }
    return element as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function rightClick(x = 120, y = 80): Promise<void> {
    target().dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }),
    );
    await settle();
  }

  function pane(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.cdk-overlay-pane');
  }

  function rootMenu(): HTMLElement {
    const element = pane()?.querySelector<HTMLElement>('[role="menu"]');
    if (!element) {
      throw new Error('menu not rendered');
    }
    return element;
  }

  function rootItems(): HTMLElement[] {
    return Array.from(rootMenu().querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  function label(item: HTMLElement): string {
    return item.textContent;
  }

  it('opens at the pointer on contextmenu with the aria menu contract', async () => {
    await rightClick();

    expect(pane()).toBeTruthy();
    expect(rootMenu().getAttribute('aria-label')).toBe('File actions');
    expect(rootItems().length).toBe(5);
    expect(rootMenu().querySelectorAll('[role="separator"]').length).toBe(1);
    expect(host.openedCount).toBe(1);
  });

  it('prevents the native browser menu', () => {
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    target().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('moves focus onto the menu without highlighting an item on pointer open', async () => {
    await rightClick();
    await settle();

    const active = document.activeElement;
    expect(active?.getAttribute('role')).toBe('menu');
  });

  it('focuses the first item on keyboard invocation', async () => {
    // Keyboard-invoked contextmenu events carry (0, 0) coordinates.
    await rightClick(0, 0);
    await settle();

    const active = document.activeElement;
    expect(active?.getAttribute('role')).toBe('menuitem');
  });

  it('runs the command of a clicked item and closes', async () => {
    await rightClick();

    const open = rootItems().find((item) => label(item).includes('Open'));
    open?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(commandEvents.length).toBe(1);
    expect(commandEvents[0].item.label).toBe('Open');
    expect(host.closedCount).toBe(1);
  });

  it('ignores activation of disabled items', async () => {
    await rightClick();

    const disabled = rootItems().find((item) => label(item).includes('Disabled'));
    disabled?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(commandEvents).toEqual([]);
    expect(host.closedCount).toBe(0);
  });

  it('opens a submenu with ArrowRight and activates its items', async () => {
    await rightClick();

    const share = rootItems().find((item) => label(item).includes('Share'));
    expect(share?.getAttribute('aria-haspopup')).toBe('true');

    // Active-item tracking is keyboard-driven and starts from nothing
    // on pointer open: walk down to Share (index 2 — disabled items
    // stay focusable), then expand.
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight']) {
      rootMenu().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await settle();
    }

    expect(share?.getAttribute('aria-expanded')).toBe('true');

    const submenus = document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role="menu"]');
    expect(submenus.length).toBeGreaterThan(1);

    const email = Array.from(
      document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role="menuitem"]'),
    ).find((item) => label(item).includes('Email'));
    email?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(commandEvents.length).toBe(1);
    expect(commandEvents[0].item.label).toBe('Email');
    expect(host.closedCount).toBe(1);
  });

  it('closes on Escape and restores focus to the previously focused element', async () => {
    target().focus();
    await rightClick();

    pane()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(host.closedCount).toBe(1);
    expect(document.activeElement).toBe(target());
  });

  async function keyboardActivate(itemLabel: string): Promise<void> {
    // Keyboard open highlights the first item; step down to the target
    // (disabled items stay focusable) and activate with Enter.
    await rightClick(0, 0);
    const menu = rootMenu();
    const index = rootItems().findIndex((item) => label(item).includes(itemLabel));
    for (let i = 0; i < index; i++) {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await settle();
    }
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
  }

  it('renders routerLink items as anchors and lets the router handle pointer clicks', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await rightClick();
    const bookings = rootItems().find((item) => label(item).includes('Bookings'));
    expect(bookings?.tagName).toBe('A');
    expect(bookings?.getAttribute('href')).toBe('/bookings?d=1');

    bookings?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle();

    // RouterLink navigated natively; we did not navigate a second time.
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalled();
    expect(host.closedCount).toBe(1);
  });

  it('navigates programmatically for routerLink items activated by keyboard', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await keyboardActivate('Bookings');

    expect(navigate).toHaveBeenCalledWith(['/bookings'], {
      queryParams: { d: '1' },
    });
    expect(host.closedCount).toBe(1);
  });

  it('renders url items as anchors with target and rel', async () => {
    await rightClick();
    const docs = rootItems().find((item) => label(item).includes('Docs'));

    expect(docs?.tagName).toBe('A');
    expect(docs?.getAttribute('href')).toBe('https://example.com');
    expect(docs?.getAttribute('target')).toBe('_blank');
    expect(docs?.getAttribute('rel')).toBe('noopener');
  });

  it('opens external urls programmatically for keyboard activation', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    await keyboardActivate('Docs');

    expect(open).toHaveBeenCalledWith('https://example.com', '_blank');
    open.mockRestore();
  });

  it('advertises the menu on the trigger while it is enabled', () => {
    expect(target().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('opens nothing and advertises nothing while disabled', async () => {
    host.disabled.set(true);
    await settle();

    // A trigger that will not open must not claim it has a menu.
    expect(target().hasAttribute('aria-haspopup')).toBe(false);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
    });
    target().dispatchEvent(event);
    await settle();

    expect(pane()).toBeNull();
    expect(host.openedCount).toBe(0);
    // The native browser menu is left alone — the trigger is inert, not silent.
    expect(event.defaultPrevented).toBe(false);
  });

  it('anchors to the target element for keyboard invocations', async () => {
    // Keyboard-invoked contextmenu events carry (0, 0) coordinates.
    await rightClick(0, 0);

    expect(pane()).toBeTruthy();
    expect(host.openedCount).toBe(1);
  });
});

describe('ContextMenu (global)', () => {
  it('opens from a contextmenu event anywhere in the document', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(GlobalContextMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();

    document.body.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 15,
        clientY: 25,
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const item = document.querySelector('.cdk-overlay-container [role="menuitem"]');
    expect(item?.textContent).toContain('Anywhere');
  });
});

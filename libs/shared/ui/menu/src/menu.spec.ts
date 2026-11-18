import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Menu } from './menu';
import { MenuTrigger } from './menu-trigger';
import { MenuItem, MenuItemCommandEvent } from './menu.types';

@Component({
  imports: [Menu, MenuTrigger],
  template: `
    <button
      type="button"
      class="trigger"
      [libMenuTriggerFor]="menu"
      [menuDisabled]="menuDisabled()"
    >
      Actions
    </button>
    <lib-menu
      #menu
      [items]="items()"
      ariaLabel="Actions"
      (opened)="openedCount = openedCount + 1"
      (closed)="closedCount = closedCount + 1"
    />
  `,
})
class MenuHost {
  readonly items = signal<readonly MenuItem[]>([]);
  readonly menuDisabled = signal(false);
  openedCount = 0;
  closedCount = 0;
}

describe('Menu', () => {
  let fixture: ComponentFixture<MenuHost>;
  let host: MenuHost;
  let commandEvents: MenuItemCommandEvent[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(MenuHost);
    host = fixture.componentInstance;
    commandEvents = [];
    host.items.set([
      { label: 'Section', heading: true },
      { label: 'Open', command: (event) => commandEvents.push(event) },
      { label: 'Disabled', disabled: true },
      { separator: true },
      { label: 'Share', items: [{ label: 'Email' }] },
    ]);
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('.trigger');
    if (!element) {
      throw new Error('trigger not rendered');
    }
    return element as HTMLButtonElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
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

  async function clickTrigger(): Promise<void> {
    // A real click is preceded by pointerdown, which the trigger uses
    // to snapshot open-state for correct toggling.
    trigger().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  }

  it('marks the trigger with the menu-button ARIA contract', () => {
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on trigger click and wires aria-expanded / aria-controls', async () => {
    await clickTrigger();

    expect(pane()).toBeTruthy();
    expect(host.openedCount).toBe(1);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(rootMenu().id);
    expect(rootMenu().getAttribute('aria-label')).toBe('Actions');
  });

  it('renders headings, items, and separators from the model', async () => {
    await clickTrigger();

    expect(rootMenu().querySelectorAll('.menu-heading').length).toBe(1);
    expect(rootMenu().querySelectorAll('[role="separator"]').length).toBe(1);
    expect(rootItems().map((i) => i.textContent.trim())).toEqual(['Open', 'Disabled', 'Share']);
  });

  it('toggles closed on a second trigger click', async () => {
    await clickTrigger();
    await clickTrigger();

    // The panel's leave animation keeps the pane mounted briefly; the
    // close is observable synchronously through these.
    expect(host.closedCount).toBe(1);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on pointer click without highlighting an item', async () => {
    await clickTrigger();

    expect(document.activeElement?.getAttribute('role')).toBe('menu');
  });

  it('opens on keyboard with the first item highlighted', async () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(pane()).toBeTruthy();
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    expect(document.activeElement?.textContent.trim()).toBe('Open');
  });

  // Regression: the wait for the rows looked for `menuitem` only, so a menu of checked rows kept
  // the place it got while empty, where a trigger near the bottom opens it off screen.
  it('focuses and repositions a menu whose rows are all checked', async () => {
    host.items.set([
      { label: 'Day', checked: true },
      { label: 'Week', checked: false },
    ]);
    await settle();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(document.activeElement?.getAttribute('role')).toBe('menuitemradio');
    expect(document.activeElement?.textContent.trim()).toBe('Day');
  });

  it('runs the command of a clicked item and closes', async () => {
    await clickTrigger();

    const open = rootItems().find((i) => i.textContent.includes('Open'));
    open?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(commandEvents.length).toBe(1);
    expect(commandEvents[0].item.label).toBe('Open');
    expect(host.closedCount).toBe(1);
  });

  /**
   * Regression: `menuDisabled` swallowed pointer and keyboard activation
   * while leaving the trigger indistinguishable from an operable one, so
   * assistive technology announced a button that simply did nothing.
   */
  it('announces and enforces a disabled trigger', async () => {
    host.menuDisabled.set(true);
    await settle();

    expect(trigger().getAttribute('aria-disabled')).toBe('true');
    // The identity of the control does not change with its state.
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');

    await clickTrigger();
    expect(pane()).toBeNull();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(pane()).toBeNull();
    expect(host.openedCount).toBe(0);

    host.menuDisabled.set(false);
    await settle();
    expect(trigger().hasAttribute('aria-disabled')).toBe(false);

    await clickTrigger();
    expect(pane()).toBeTruthy();
    expect(host.openedCount).toBe(1);
  });

  it('omits items marked not visible', async () => {
    host.items.set([
      { label: 'Kept' },
      { label: 'Hidden', visible: false },
      { label: 'Also kept' },
    ]);
    await clickTrigger();

    expect(rootItems().map((i) => i.textContent.trim())).toEqual(['Kept', 'Also kept']);
  });

  it('closes when focus leaves without a nameable target', async () => {
    await clickTrigger();
    expect(document.activeElement).toBe(rootMenu());

    // Blur with nothing to move to: `relatedTarget` is null and focus
    // lands on the body. The menu has been left, so it must close.
    rootMenu().blur();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();

    expect(host.closedCount).toBe(1);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when focus leaves the document (browser chrome)', async () => {
    await clickTrigger();

    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    try {
      rootMenu().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      await settle();
      await new Promise((resolve) => setTimeout(resolve));
      await settle();

      expect(host.closedCount).toBe(1);
    } finally {
      hasFocus.mockRestore();
    }
  });

  it('closes when focus moves to an unrelated menu elsewhere', async () => {
    await clickTrigger();

    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'menu');
    foreign.tabIndex = 0;
    document.body.appendChild(foreign);
    try {
      rootMenu().dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: foreign }),
      );
      await settle();

      expect(host.closedCount).toBe(1);
    } finally {
      foreign.remove();
    }
  });

  it('stays open while focus moves between its own items', async () => {
    await clickTrigger();
    const [first, second] = rootItems();

    rootMenu().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: first }));
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: second }));
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();

    expect(host.closedCount).toBe(0);
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    trigger().focus();
    await clickTrigger();

    pane()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(host.closedCount).toBe(1);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });
});

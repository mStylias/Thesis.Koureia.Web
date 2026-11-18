import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideScissors } from '@lucide/angular';
import { MenuPanel } from './menu-panel';
import { MenuItemTemplate } from './menu-templates';
import { MenuItem } from './menu.types';

const ITEMS: MenuItem[] = [
  { label: 'Actions', heading: true },
  { label: 'Book', icon: LucideScissors, shortcut: '⌘B' },
  { label: 'Hidden', visible: false },
  { separator: true },
  { label: 'Cancel', disabled: true },
  {
    label: 'Share',
    items: [{ label: 'Email' }, { label: 'Copy link' }],
  },
];

const LINK_ITEMS: MenuItem[] = [
  { label: 'Profile', routerLink: '/profile' },
  { label: 'Billing', routerLink: '/billing', disabled: true },
  { label: 'Docs', url: 'https://example.com/docs' },
  { label: 'Support', url: 'https://example.com/support', disabled: true },
];

@Component({
  imports: [MenuPanel, MenuItemTemplate],
  template: `
    <lib-menu-panel [items]="items()" ariaLabel="Actions" (itemSelected)="selected.push($event)">
    </lib-menu-panel>
    @if (withTemplate()) {
      <lib-menu-panel [items]="items()" [itemTemplate]="customTemplate.templateRef" />
      <ng-template libMenuItem let-item #customTemplate="libMenuItem">
        <em class="custom-row">{{ item.label }}</em>
      </ng-template>
    }
  `,
})
class MenuPanelHost {
  readonly items = signal<readonly MenuItem[]>(ITEMS);
  readonly withTemplate = signal(false);
  readonly selected: MenuItem[] = [];
}

describe('MenuPanel', () => {
  let fixture: ComponentFixture<MenuPanelHost>;
  let host: MenuPanelHost;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(MenuPanelHost);
    host = fixture.componentInstance;
    await settle();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function menu(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('[role="menu"]');
    if (!element) {
      throw new Error('menu not rendered');
    }
    return element as HTMLElement;
  }

  function menuItems(): HTMLElement[] {
    return Array.from(menu().querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  it('renders items with the aria menu contract', () => {
    expect(menu().getAttribute('aria-label')).toBe('Actions');
    const labels = menuItems().map((item) => item.textContent);
    expect(labels.length).toBe(3);
    expect(labels[0]).toContain('Book');
    expect(labels[0]).toContain('⌘B');
    expect(labels[1]).toContain('Cancel');
    expect(labels[2]).toContain('Share');
  });

  it('omits items with visible set to false', () => {
    const labels = menuItems().map((item) => item.textContent);
    expect(labels.join(' ')).not.toContain('Hidden');
  });

  it('renders separators with the separator role', () => {
    expect(menu().querySelectorAll('[role="separator"]').length).toBe(1);
  });

  it('renders headings as non-interactive presentation rows', () => {
    const headings = menu().querySelectorAll<HTMLElement>('.menu-heading');
    expect(headings.length).toBe(1);
    expect(headings[0].getAttribute('role')).toBe('presentation');
    expect(headings[0].textContent).toContain('Actions');
    // A heading is never a focusable menu item.
    expect(headings[0].getAttribute('role')).not.toBe('menuitem');
  });

  // A bare heading row inside `role="menu"` is dropped from the accessibility tree.
  it('names a group of the rows up to the next heading with each heading', async () => {
    host.items.set([
      { label: 'Top' },
      { label: 'Kimonas', heading: true },
      { label: 'Profile' },
      { separator: true },
      { label: 'Session', heading: true },
      { label: 'Sign out' },
    ]);
    await settle();

    const groups = Array.from(menu().querySelectorAll<HTMLElement>('[role="group"]'));
    expect(groups).toHaveLength(2);
    const names = groups.map(
      (group) => document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent,
    );
    expect(names.map((name) => name?.trim())).toEqual(['Kimonas', 'Session']);
    const rows = (group: HTMLElement): string[] =>
      Array.from(group.querySelectorAll('[role="menuitem"]')).map((row) => row.textContent.trim());
    expect(rows(groups[0])).toEqual(['Profile']);
    expect(groups[0].querySelector('[role="separator"]')).not.toBeNull();
    expect(rows(groups[1])).toEqual(['Sign out']);
    // A row before the first heading stays outside every group.
    expect(menuItems()[0].closest('[role="group"]')).toBeNull();
  });

  it('marks disabled items with aria-disabled', () => {
    const cancel = menuItems()[1];
    expect(cancel.getAttribute('aria-disabled')).toBe('true');
  });

  it('reports a checked item as a selected menuitemradio', async () => {
    host.items.set([
      { label: 'Ascending', checked: true },
      { label: 'Descending', checked: false },
      { label: 'Rename' },
    ]);
    await settle();

    const rows = Array.from(menu().querySelectorAll<HTMLElement>('.menu-item'));
    expect(rows.map((row) => row.getAttribute('role'))).toEqual([
      'menuitemradio',
      'menuitemradio',
      'menuitem',
    ]);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false', null]);
  });

  it('marks a danger item for the error colour and leaves the others plain', async () => {
    host.items.set([{ label: 'Rename' }, { label: 'Delete', danger: true }]);
    await settle();

    const rows = Array.from(menu().querySelectorAll<HTMLElement>('.menu-item'));
    expect(rows.map((row) => row.hasAttribute('data-danger'))).toEqual([false, true]);
  });

  it('takes menuitemcheckbox for an independent toggle', async () => {
    host.items.set([{ label: 'Row numbers', checked: true, checkedRole: 'checkbox' }]);
    await settle();

    const row = menu().querySelector<HTMLElement>('.menu-item');
    expect(row?.getAttribute('role')).toBe('menuitemcheckbox');
    expect(row?.getAttribute('aria-checked')).toBe('true');
  });

  it('keeps a checked item activatable, unlike a disabled one', async () => {
    host.items.set([{ label: 'Ascending', checked: true }]);
    await settle();

    const row = menu().querySelector<HTMLElement>('.menu-item');
    expect(row?.getAttribute('aria-disabled')).not.toBe('true');
    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.selected.length).toBe(1);
  });

  it('leaves a submenu trigger a plain menuitem', async () => {
    host.items.set([{ label: 'Share', checked: true, items: [{ label: 'Email' }] }]);
    await settle();

    const row = menu().querySelector<HTMLElement>('.menu-item');
    expect(row?.getAttribute('role')).toBe('menuitem');
    expect(row?.getAttribute('aria-checked')).toBeNull();
  });

  it('marks submenu triggers with aria-haspopup', () => {
    const share = menuItems()[2];
    expect(share.getAttribute('aria-haspopup')).toBe('true');
    expect(share.getAttribute('aria-expanded')).toBe('false');
  });

  it('emits itemSelected when an item is clicked', () => {
    menuItems()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(host.selected.map((item) => item.label)).toEqual(['Book']);
  });

  it('does not emit for disabled items', () => {
    menuItems()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(host.selected).toEqual([]);
  });

  it('renders enabled link items as anchors', async () => {
    host.items.set(LINK_ITEMS);
    await settle();

    const [profile, , docs] = menuItems();
    expect(profile.tagName).toBe('A');
    expect(profile.getAttribute('href')).toBe('/profile');
    expect(docs.tagName).toBe('A');
    expect(docs.getAttribute('href')).toBe('https://example.com/docs');
  });

  it('never gives a disabled link item a navigable href', async () => {
    host.items.set(LINK_ITEMS);
    await settle();

    const [, billing, , support] = menuItems();
    expect(billing.hasAttribute('href')).toBe(false);
    expect(support.hasAttribute('href')).toBe(false);
  });

  it('marks disabled link items aria-disabled and never selects them', async () => {
    host.items.set(LINK_ITEMS);
    await settle();

    const [, billing, , support] = menuItems();
    expect(billing.getAttribute('aria-disabled')).toBe('true');
    expect(support.getAttribute('aria-disabled')).toBe('true');

    billing.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    support.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(host.selected).toEqual([]);
  });

  it('renders custom rows through the libMenuItem template', async () => {
    host.withTemplate.set(true);
    await settle();

    const custom = (fixture.nativeElement as HTMLElement).querySelectorAll('.custom-row');
    expect(custom.length).toBeGreaterThan(0);
    expect(custom[0].textContent).toContain('Book');
  });
});

import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { LucideHouse, LucideScissors, LucideSettings } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { Sidebar, SidebarBrand, SidebarBrandText } from './sidebar';
import { SidebarGroup, SidebarItem } from './sidebar.types';

// jsdom implements neither matchMedia (needed by the CDK
// BreakpointObserver) nor the <dialog> methods (driven by the mobile
// drawer). Both are stubbed, with the viewport controllable per test.
type MediaListener = (event: MediaQueryListEvent) => void;

let desktopMatches = true;
const mediaListeners = new Set<MediaListener>();

function setDesktopViewport(matches: boolean): void {
  desktopMatches = matches;
  for (const listener of mediaListeners) {
    listener({ matches, media: '' } as MediaQueryListEvent);
  }
}

beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      get matches() {
        return desktopMatches;
      },
      media: query,
      onchange: null,
      addListener: (listener: MediaListener) => mediaListeners.add(listener),
      removeListener: (listener: MediaListener) => mediaListeners.delete(listener),
      addEventListener: (_type: string, listener: MediaListener) => mediaListeners.add(listener),
      removeEventListener: (_type: string, listener: MediaListener) =>
        mediaListeners.delete(listener),
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

const NAV: readonly SidebarGroup[] = [
  {
    items: [
      { label: 'Home', icon: LucideHouse, routerLink: '/' },
      { label: 'Settings', icon: LucideSettings, routerLink: '/settings' },
      { label: 'Help', url: 'https://example.com/help', target: '_blank' },
      { label: 'Disabled', routerLink: '/disabled', disabled: true },
      { label: 'Hidden', routerLink: '/hidden', visible: false },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'Services', icon: LucideScissors, routerLink: '/services' },
      {
        label: 'Catalog',
        icon: LucideScissors,
        items: [
          { label: 'Haircuts', routerLink: '/catalog/haircuts' },
          { label: 'Shaves', routerLink: '/catalog/shaves' },
          { label: 'Secret', routerLink: '/catalog/secret', visible: false },
        ],
      },
    ],
  },
  {
    label: 'Ghost group',
    items: [{ label: 'Gone', routerLink: '/gone', visible: false }],
  },
];

@Component({
  imports: [Sidebar, SidebarBrand, SidebarBrandText],
  template: `
    <lib-sidebar
      [groups]="groups()"
      [(collapsed)]="collapsed"
      [(mobileOpen)]="mobileOpen"
      [compact]="compact()"
      [ariaLabel]="ariaLabel()"
      (itemSelect)="selected.push($event)"
    >
      @if (withBrand()) {
        <span *libSidebarBrand class="test-brand">
          <span libSidebarBrandText>Barbershop</span>
        </span>
      }
    </lib-sidebar>
  `,
})
class SidebarHost {
  readonly groups = signal<readonly SidebarGroup[]>(NAV);
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly compact = signal(false);
  readonly ariaLabel = signal('');
  readonly withBrand = signal(true);
  readonly selected: SidebarItem[] = [];
}

describe('Sidebar', () => {
  let fixture: ComponentFixture<SidebarHost>;
  let host: SidebarHost;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function sidebar(): HTMLElement {
    const el = element().querySelector<HTMLElement>('lib-sidebar');
    if (!el) {
      throw new Error('sidebar not rendered');
    }
    return el;
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(element().querySelectorAll<HTMLAnchorElement>('.sidebar-link'));
  }

  function linkByLabel(label: string): HTMLAnchorElement {
    const link = links().find((a) => a.textContent.includes(label));
    if (!link) {
      throw new Error(`link "${label}" not rendered`);
    }
    return link;
  }

  function tooltip(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="tooltip"]');
  }

  /** Hovers the element past the tooltip's show delay. */
  async function hover(element: HTMLElement): Promise<void> {
    element.dispatchEvent(new Event('mouseenter'));
    await new Promise((resolve) => setTimeout(resolve, 150));
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    // afterNextRender hooks (the breakpoint subscription) only run on an
    // application tick, which detectChanges alone does not trigger.
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
    // BreakpointObserver pipes changes through debounceTime(0) — let the
    // macrotask flush, then render the result.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    desktopMatches = true;
    mediaListeners.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
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
    fixture = TestBed.createComponent(SidebarHost);
    host = fixture.componentInstance;
    await settle();
    // The `sidebar` scope loads lazily via dynamic import — await it so
    // the translated labels are present before assertions run.
    await firstValueFrom(TestBed.inject(TranslocoService).load('sidebar/en'));
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.style.overflow = '';
  });

  it('renders the visible groups and options, dropping hidden ones', () => {
    const labels = links().map((a) => a.textContent.trim());
    expect(labels).toEqual([
      'Home',
      'Settings',
      'Help',
      'Disabled',
      'Services',
      'Catalog',
      'Haircuts',
      'Shaves',
    ]);
    expect(element().textContent).not.toContain('Secret');
    // Group hidden entirely once all its items are hidden.
    expect(element().querySelectorAll('.sidebar-group')).toHaveLength(2);
    expect(element().textContent).not.toContain('Ghost group');
  });

  it('renders group headings and names each list with its own', () => {
    const headings = Array.from(element().querySelectorAll('.sidebar-group-label'));
    expect(headings.map((el) => el.textContent.trim())).toEqual(['Manage']);

    const lists = Array.from(element().querySelectorAll('.sidebar-group-list'));
    const labelled = lists.filter((ul) => ul.hasAttribute('aria-labelledby'));
    expect(labelled).toHaveLength(1);
    // Ids are module-scoped counters — read the value back, never assert one.
    expect(labelled[0].getAttribute('aria-labelledby')).toBe(headings[0].id);
    expect(headings[0].id).toMatch(/^lib-sidebar-nav-\d+-group-\d+$/);
    // A group with no heading must not point at a missing id.
    expect(lists.filter((ul) => !ul.hasAttribute('aria-labelledby'))).toHaveLength(1);
  });

  it('keeps options with duplicate labels distinct', async () => {
    host.groups.set([
      {
        items: [
          { label: 'Reports', routerLink: '/reports/daily' },
          { label: 'Reports', routerLink: '/reports/monthly' },
        ],
      },
    ]);
    await settle();

    // Tracked by reference, so a repeated label is not a duplicate key.
    expect(links().map((a) => a.getAttribute('href'))).toEqual([
      '/reports/daily',
      '/reports/monthly',
    ]);
  });

  it('marks the link of the current route with aria-current', async () => {
    await TestBed.inject(Router).navigateByUrl('/settings');
    await settle();

    const settings = linkByLabel('Settings');
    expect(settings.getAttribute('aria-current')).toBe('page');
    expect(settings.classList).toContain('is-active');
    expect(linkByLabel('Home').hasAttribute('aria-current')).toBe(false);
  });

  it('renders external options as plain anchors with safe rel', () => {
    const help = linkByLabel('Help');
    expect(help.getAttribute('href')).toBe('https://example.com/help');
    expect(help.getAttribute('target')).toBe('_blank');
    expect(help.getAttribute('rel')).toBe('noopener');
  });

  it('disables options accessibly and swallows their clicks', () => {
    const disabled = linkByLabel('Disabled');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.getAttribute('tabindex')).toBe('-1');

    const event = new MouseEvent('click', { cancelable: true });
    disabled.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(host.selected).toHaveLength(0);
  });

  it('emits itemSelect when an enabled option is activated', () => {
    linkByLabel('Settings').dispatchEvent(new MouseEvent('click', { cancelable: true }));
    expect(host.selected.map((item) => item.label)).toEqual(['Settings']);
  });

  it('reflects the collapsed binding on the host', async () => {
    expect(sidebar().hasAttribute('data-collapsed')).toBe(false);

    host.collapsed.set(true);
    await settle();
    expect(sidebar().hasAttribute('data-collapsed')).toBe(true);

    host.collapsed.set(false);
    await settle();
    expect(sidebar().hasAttribute('data-collapsed')).toBe(false);
  });

  it('ships no collapse trigger of its own', () => {
    // The toggle lives in lib-topbar so it has no motion of its own while
    // the rail resizes — the sidebar's header holds the brand and nothing
    // else. Regression guard for the trigger creeping back in.
    expect(element().querySelectorAll('.sidebar-header button')).toHaveLength(0);
  });

  it('exposes the nav landmark id for an outside toggle to control', () => {
    const nav = element().querySelector('nav.sidebar-nav');
    if (!nav) {
      throw new Error('nav landmark not rendered');
    }
    // Module-scoped counter — read the value back, never assert one.
    expect(nav.id).toMatch(/^lib-sidebar-nav-\d+$/);
    // What `[sidebarControls]="nav.navId"` on the top bar resolves to.
    const instance = fixture.debugElement.query(By.directive(Sidebar)).injector.get(Sidebar);
    expect(instance.navId).toBe(nav.id);
  });

  it('keeps the labels in the DOM while collapsed (accessible name)', async () => {
    host.collapsed.set(true);
    await settle();

    const label = linkByLabel('Settings').querySelector('.sidebar-link-label');
    expect(label?.textContent).toContain('Settings');
  });

  it('shows tooltips only while collapsed', async () => {
    await hover(linkByLabel('Settings'));
    expect(tooltip()).toBeNull();

    host.collapsed.set(true);
    await settle();

    await hover(linkByLabel('Settings'));
    expect(tooltip()?.textContent).toContain('Settings');

    linkByLabel('Settings').dispatchEvent(new Event('mouseleave'));
    await settle();
  });

  it('hides the tooltip when a rail option is activated', async () => {
    host.collapsed.set(true);
    await settle();

    await hover(linkByLabel('Settings'));
    expect(tooltip()).not.toBeNull();

    linkByLabel('Settings').click();
    await settle();
    expect(tooltip()).toBeNull();
  });

  it('marks expandable rail items with a corner indicator', () => {
    const parent = linkByLabel('Catalog');
    expect(parent.querySelector('.sidebar-parent-rail-indicator')).not.toBeNull();
    expect(linkByLabel('Settings').querySelector('.sidebar-parent-rail-indicator')).toBeNull();
  });

  it('names the navigation landmark, translated by default', async () => {
    const nav = element().querySelector('nav.sidebar-nav');
    expect(nav?.getAttribute('aria-label')).toBe('Main navigation');

    host.ariaLabel.set('Account sections');
    await settle();
    expect(nav?.getAttribute('aria-label')).toBe('Account sections');
  });

  it('renders expandable items closed, out of the a11y tree', () => {
    const parent = linkByLabel('Catalog');
    expect(parent.tagName).toBe('BUTTON');
    expect(parent.getAttribute('aria-expanded')).toBe('false');

    const submenu = element().querySelector('.sidebar-submenu');
    expect(submenu?.hasAttribute('inert')).toBe(true);
    expect(submenu?.classList).not.toContain('is-open');
    expect(parent.getAttribute('aria-controls')).toBe(submenu?.id);
  });

  it('toggles a submenu open and closed', async () => {
    const parent = linkByLabel('Catalog');
    parent.click();
    await settle();

    const submenu = element().querySelector('.sidebar-submenu');
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(submenu?.hasAttribute('inert')).toBe(false);
    expect(submenu?.classList).toContain('is-open');

    parent.click();
    await settle();
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    expect(submenu?.hasAttribute('inert')).toBe(true);
  });

  it('honors an initially expanded submenu', async () => {
    host.groups.set([
      {
        items: [
          {
            label: 'Open me',
            expanded: true,
            items: [{ label: 'Child', routerLink: '/child' }],
          },
        ],
      },
    ]);
    await settle();

    expect(linkByLabel('Open me').getAttribute('aria-expanded')).toBe('true');
  });

  it('expands the sidebar when a rail parent is activated', async () => {
    host.collapsed.set(true);
    await settle();

    linkByLabel('Catalog').click();
    await settle();

    expect(host.collapsed()).toBe(false);
    expect(linkByLabel('Catalog').getAttribute('aria-expanded')).toBe('true');
  });

  it('reflects compact density on desktop only', async () => {
    host.compact.set(true);
    await settle();
    expect(sidebar().hasAttribute('data-compact')).toBe(true);

    setDesktopViewport(false);
    await settle();
    expect(sidebar().hasAttribute('data-compact')).toBe(false);
    setDesktopViewport(true);
    await settle();
  });

  it('renders the brand in the desktop header', () => {
    const brand = element().querySelector('.sidebar-header .test-brand');
    expect(brand?.textContent).toContain('Barbershop');
  });

  it('keeps the brand in the collapsed rail', async () => {
    host.collapsed.set(true);
    await settle();

    // The rail shows the brand ICON where the toggle used to sit; only
    // the [libSidebarBrandText] fades (a CSS-only concern, styled by the
    // global partial), so the element itself must survive the collapse.
    const brand = element().querySelector('.sidebar-header .test-brand');
    expect(brand).not.toBeNull();
    expect(brand?.textContent).toContain('Barbershop');
  });

  describe('below the breakpoint', () => {
    beforeEach(async () => {
      setDesktopViewport(false);
      await settle();
    });

    function dialog(): HTMLDialogElement {
      const el = element().querySelector<HTMLDialogElement>('dialog.drawer');
      if (!el) {
        throw new Error('drawer dialog not rendered');
      }
      return el;
    }

    it('replaces the in-flow sidebar with a closed drawer', () => {
      expect(element().querySelector('nav.sidebar-nav')).toBeNull();
      expect(sidebar().hasAttribute('data-mobile')).toBe(true);
      expect(dialog().open).toBe(false);
    });

    it('opens through mobileOpen with full labels and the brand', async () => {
      host.mobileOpen.set(true);
      await settle();

      expect(dialog().open).toBe(true);
      expect(dialog().textContent).toContain('Settings');
      expect(dialog().querySelector('.test-brand')?.textContent).toContain('Barbershop');
      // Never the icon rail in the drawer — no collapsed state applies.
      expect(sidebar().hasAttribute('data-collapsed')).toBe(false);
    });

    it('closes on navigation', async () => {
      host.mobileOpen.set(true);
      await settle();

      await TestBed.inject(Router).navigateByUrl('/services');
      await settle();

      expect(host.mobileOpen()).toBe(false);
    });

    it('closes when an external option is activated', async () => {
      host.mobileOpen.set(true);
      await settle();

      const event = new MouseEvent('click', { cancelable: true });
      // Prevent jsdom from attempting real navigation on the href.
      event.preventDefault();
      linkByLabel('Help').dispatchEvent(event);
      await settle();

      expect(host.mobileOpen()).toBe(false);
      expect(host.selected.map((item) => item.label)).toEqual(['Help']);
    });
  });
});

describe('Sidebar copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    desktopMatches = true;
    mediaListeners.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'sidebar.navLabel': 'customer.navLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(SidebarHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { navLabel: 'Your menu' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('sidebar/en'));
    fixture.detectChanges();

    const nav = (fixture.nativeElement as HTMLElement).querySelector('.sidebar-nav');
    expect(nav?.getAttribute('aria-label')).toBe('Your menu');
    fixture.destroy();
  });
});

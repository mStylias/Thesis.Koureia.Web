import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Topbar } from './topbar';

@Component({
  imports: [Topbar],
  template: `
    <lib-topbar
      [(menuOpen)]="menuOpen"
      [menuAriaLabel]="menuAriaLabel()"
      [showSidebarToggle]="showSidebarToggle()"
      [(sidebarCollapsed)]="sidebarCollapsed"
      [sidebarControls]="sidebarControls()"
      [sidebarToggleAriaLabel]="sidebarToggleAriaLabel()"
    >
      <h1 libTopbarStart class="test-title">Bookings</h1>
      <span class="test-loose">Loose</span>
      <div libTopbarEnd class="test-actions">
        <button type="button">Account</button>
      </div>
    </lib-topbar>
  `,
})
class TopbarHost {
  readonly menuOpen = signal(false);
  readonly menuAriaLabel = signal('');
  readonly showSidebarToggle = signal(true);
  readonly sidebarCollapsed = signal(false);
  readonly sidebarControls = signal('');
  readonly sidebarToggleAriaLabel = signal('');
}

describe('Topbar', () => {
  let fixture: ComponentFixture<TopbarHost>;
  let host: TopbarHost;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function topbar(): HTMLElement {
    const el = element().querySelector<HTMLElement>('lib-topbar');
    if (!el) {
      throw new Error('topbar not rendered');
    }
    return el;
  }

  function menuButton(): HTMLButtonElement {
    const button = element().querySelector<HTMLButtonElement>('.topbar-menu button');
    if (!button) {
      throw new Error('menu button not rendered');
    }
    return button;
  }

  function sidebarToggle(): HTMLButtonElement {
    const button = element().querySelector<HTMLButtonElement>('.topbar-sidebar-toggle button');
    if (!button) {
      throw new Error('sidebar toggle not rendered');
    }
    return button;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
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
    fixture = TestBed.createComponent(TopbarHost);
    host = fixture.componentInstance;
    await settle();
    // The `topbar` scope loads lazily via dynamic import — await it so the
    // translated aria-label is present before assertions run.
    await firstValueFrom(TestBed.inject(TranslocoService).load('topbar/en'));
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('is the banner landmark', () => {
    expect(topbar().getAttribute('role')).toBe('banner');
  });

  it('projects start, end, and unslotted content into their slots', () => {
    const start = topbar().querySelector('.topbar-start');
    const end = topbar().querySelector('.topbar-end');

    expect(start?.querySelector('.test-title')?.textContent).toContain('Bookings');
    // Unslotted content falls through to the leading area.
    expect(start?.querySelector('.test-loose')?.textContent).toContain('Loose');
    expect(end?.querySelector('.test-actions')?.textContent).toContain('Account');
  });

  it('labels the hamburger, translated by default', () => {
    const button = menuButton();
    expect(button.getAttribute('aria-label')).toBe('Open navigation');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('lets menuAriaLabel override the label', async () => {
    host.menuAriaLabel.set('Open the menu');
    await settle();
    expect(menuButton().getAttribute('aria-label')).toBe('Open the menu');
  });

  it('opens the drawer through the hamburger, two-way', async () => {
    expect(host.menuOpen()).toBe(false);

    menuButton().click();
    await settle();

    expect(host.menuOpen()).toBe(true);
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('reflects externally set menuOpen on the hamburger', async () => {
    host.menuOpen.set(true);
    await settle();
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
  });

  describe('sidebar collapse toggle', () => {
    it('renders only when opted into', async () => {
      expect(element().querySelector('.topbar-sidebar-toggle')).not.toBeNull();

      host.showSidebarToggle.set(false);
      await settle();
      // A toggle for a sidebar that is not there does nothing — it must
      // leave the tab order and the a11y tree, not just be hidden.
      expect(element().querySelector('.topbar-sidebar-toggle')).toBeNull();
    });

    it('keeps a stable name and carries state on aria-expanded', async () => {
      const button = sidebarToggle();
      expect(button.getAttribute('aria-label')).toBe('Navigation sidebar');
      expect(button.getAttribute('aria-expanded')).toBe('true');

      host.sidebarCollapsed.set(true);
      await settle();
      // The name must NOT flip to "Expand"/"Collapse": it would be
      // re-announced under the user's own focus mid-interaction.
      expect(sidebarToggle().getAttribute('aria-label')).toBe('Navigation sidebar');
      expect(sidebarToggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('lets sidebarToggleAriaLabel override the name', async () => {
      host.sidebarToggleAriaLabel.set('Πλαϊνή μπάρα');
      await settle();
      expect(sidebarToggle().getAttribute('aria-label')).toBe('Πλαϊνή μπάρα');
    });

    it('collapses the sidebar through the toggle, two-way', async () => {
      sidebarToggle().click();
      await settle();
      expect(host.sidebarCollapsed()).toBe(true);

      sidebarToggle().click();
      await settle();
      expect(host.sidebarCollapsed()).toBe(false);
    });

    it('points aria-controls at the nav id only when given one', async () => {
      expect(sidebarToggle().hasAttribute('aria-controls')).toBe(false);

      host.sidebarControls.set('lib-sidebar-nav-0');
      await settle();
      expect(sidebarToggle().getAttribute('aria-controls')).toBe('lib-sidebar-nav-0');
    });

    it('swaps the icon with the rail state', async () => {
      const swap = () => sidebarToggle().querySelector('svg');
      expect(swap()?.classList).toContain('lucide-panel-left-close');

      host.sidebarCollapsed.set(true);
      await settle();
      expect(swap()?.classList).toContain('lucide-panel-left-open');
    });
  });
});

describe('Topbar copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'topbar.menuLabel': 'customer.menuLabel' }),
      ],
    });
    const fixture = TestBed.createComponent(TopbarHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { menuLabel: 'Your menu' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('topbar/en'));
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('.topbar-menu button');
    expect(button?.getAttribute('aria-label')).toBe('Your menu');
  });
});

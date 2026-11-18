import { Component, getDebugNode, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { Tooltip } from '@ui/tooltip';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Tab } from './tab';
import { TabList } from './tab-list';
import { TabMenu } from './tab-menu';
import { TabContent, TabPanel } from './tab-panel';
import { Tabs } from './tabs';
import { TabMenuItem } from './tabs.types';

/** The text the element's `libTooltip` shows. */
function tooltipOf(element: Element | null | undefined): unknown {
  return element ? getDebugNode(element)?.injector.get(Tooltip).libTooltip() : undefined;
}

// jsdom has no ResizeObserver; the tab list/container measure with one.
class ResizeObserverStub {
  static readonly live = new Set<ResizeObserverStub>();

  /** Reports a size change of `target` to every observer that watches it. */
  static resize(target: Element): void {
    for (const observer of ResizeObserverStub.live) {
      if (observer.targets.has(target)) {
        observer.callback([], observer);
      }
    }
  }

  private readonly targets = new Set<Element>();
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverStub.live.add(this);
  }
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverStub;
});

/** The lib ships a Transloco scope, so every spec needs a root config. */
const TRANSLOCO_PROVIDERS = [
  provideTransloco({
    config: {
      availableLangs: ['el', 'en'],
      defaultLang: 'en',
      fallbackLang: 'en',
      missingHandler: { useFallbackTranslation: true },
    },
  }),
];

/** The `tabs` scope loads through a dynamic import — await it. */
async function loadTabsScope(): Promise<void> {
  await firstValueFrom(TestBed.inject(TranslocoService).load('tabs/en'));
}

@Component({
  imports: [Tabs, TabList, Tab, TabPanel, TabContent],
  template: `
    <lib-tabs [scrollable]="scrollable()">
      <lib-tab-list [selectionMode]="selectionMode()" [(value)]="active">
        <lib-tab value="a">Alpha</lib-tab>
        <lib-tab value="b" [disabled]="disableB()">Beta</lib-tab>
        <lib-tab value="c" closable (closed)="closeCount = closeCount + 1">Gamma</lib-tab>
      </lib-tab-list>

      <lib-tab-panel value="a">Alpha panel</lib-tab-panel>
      <lib-tab-panel value="b">Beta panel</lib-tab-panel>
      <lib-tab-panel value="c">
        <ng-template libTabContent>
          <span class="lazy-marker">Gamma lazy</span>
        </ng-template>
      </lib-tab-panel>
    </lib-tabs>
  `,
})
class TabsHost {
  readonly active = signal('a');
  readonly disableB = signal(false);
  readonly scrollable = signal(false);
  readonly selectionMode = signal<'follow' | 'explicit'>('explicit');
  closeCount = 0;
}

describe('Tabs', () => {
  let fixture: ComponentFixture<TabsHost>;
  let host: TabsHost;

  function tabs(): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]'),
    );
  }

  function tabByValue(value: string): HTMLElement {
    const el = tabs().find((t) => t.textContent.trim().startsWith(labelFor(value)));
    if (!el) {
      throw new Error(`tab ${value} not found`);
    }
    return el;
  }

  function labelFor(value: string): string {
    return { a: 'Alpha', b: 'Beta', c: 'Gamma' }[value] ?? value;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabsHost],
      providers: [...TRANSLOCO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(TabsHost);
    host = fixture.componentInstance;
    await settle();
    await loadTabsScope();
    await settle();
  });

  it('renders the aria tablist/tab/tabpanel roles', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="tablist"]')).toBeTruthy();
    expect(tabs()).toHaveLength(3);
    expect(root.querySelectorAll('[role="tabpanel"]').length).toBeGreaterThan(0);
  });

  it('marks the bound tab as selected and its panel visible', () => {
    const alpha = tabByValue('a');
    expect(alpha.getAttribute('aria-selected')).toBe('true');

    const panels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    );
    const visible = panels.find((p) => !p.hasAttribute('inert'));
    expect(visible?.textContent).toContain('Alpha panel');
  });

  it('selects a tab on click and syncs the two-way value', async () => {
    const beta = tabByValue('b');
    beta.focus();
    beta.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.active()).toBe('b');
    expect(beta.getAttribute('aria-selected')).toBe('true');
  });

  it('reflects a disabled tab via aria and blocks selection', async () => {
    host.disableB.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const beta = tabByValue('b');
    expect(beta.getAttribute('aria-disabled')).toBe('true');

    beta.focus();
    beta.click();
    fixture.detectChanges();
    expect(host.active()).toBe('a');
  });

  it('emits (closed) from the closable × without selecting the tab', () => {
    const gamma = tabByValue('c');
    const closeEl = gamma.querySelector<HTMLElement>('.tab-close');
    if (!closeEl) {
      throw new Error('close affordance not rendered');
    }

    closeEl.click();
    fixture.detectChanges();

    expect(host.closeCount).toBe(1);
    expect(host.active()).toBe('a');
  });

  it('keeps the tab free of nested interactive controls', () => {
    const gamma = tabByValue('c');
    expect(gamma.getAttribute('role')).toBe('tab');
    // ARIA gives `role="tab"` presentational children: anything focusable
    // inside it loses its role and name in the accessibility tree while
    // staying in the tab order — an unnamed stop for keyboard users.
    expect(
      gamma.querySelector('button, a[href], input, select, textarea, [tabindex], [role="button"]'),
    ).toBeNull();
  });

  it('closes a closable tab from the keyboard and advertises the shortcut', () => {
    const gamma = tabByValue('c');
    expect(gamma.getAttribute('aria-keyshortcuts')).toBe('Delete');

    gamma.focus();
    gamma.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fixture.detectChanges();

    expect(host.closeCount).toBe(1);
    expect(host.active()).toBe('a');
  });

  it('offers neither affordance on a non-closable or disabled tab', async () => {
    expect(tabByValue('a').querySelector('.tab-close')).toBeNull();
    expect(tabByValue('a').hasAttribute('aria-keyshortcuts')).toBe(false);

    tabByValue('c').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fixture.detectChanges();
    expect(host.closeCount).toBe(1);

    host.disableB.set(true);
    await fixture.whenStable();
    tabByValue('b').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fixture.detectChanges();
    expect(host.closeCount).toBe(1);
  });

  it('labels the × as a translated tooltip, never a dead aria-label', () => {
    const closeEl = tabByValue('c').querySelector('.tab-close');
    if (!closeEl) {
      throw new Error('close affordance not rendered');
    }

    expect(tooltipOf(closeEl)).toBe('Close tab');
    // The × lives inside `role="tab"`, whose children are presentational:
    // an aria-label here would never reach the accessibility tree.
    expect(closeEl.hasAttribute('aria-label')).toBe(false);
    expect(closeEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels the scroll affordances as translated tooltips', async () => {
    // The buttons render only while the tabs overflow the header.
    const wide = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(500);
    host.scrollable.set(true);
    await settle();
    wide.mockRestore();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.tabs-scroll'),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => tooltipOf(b))).toEqual([
      'Scroll tabs backward',
      'Scroll tabs forward',
    ]);
    // Pointer-only and aria-hidden — an aria-label would be dead markup.
    for (const button of buttons) {
      expect(button.hasAttribute('aria-label')).toBe(false);
      expect(button.getAttribute('aria-hidden')).toBe('true');
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('renders lazy content only once its tab is activated', async () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.lazy-marker')).toBeNull();

    const gamma = tabByValue('c');
    gamma.focus();
    gamma.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.lazy-marker')).toBeTruthy();
  });
});

describe('TabMenu', () => {
  @Component({
    imports: [TabMenu],
    template: `<lib-tab-menu
      [items]="items()"
      ariaLabel="Sections"
      (itemSelect)="picked = $event"
    />`,
  })
  class MenuHost {
    readonly items = signal<readonly TabMenuItem[]>([
      { label: 'Overview', routerLink: '/' },
      { label: 'Bookings', routerLink: '/bookings' },
      { label: 'Reviews', routerLink: '/reviews', disabled: true },
      { label: 'Help', url: 'https://koureia.gr/help', target: '_blank' },
    ]);
    picked: TabMenuItem | undefined;
  }

  let fixture: ComponentFixture<MenuHost>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(root().querySelectorAll<HTMLAnchorElement>('.tab-menu-link'));
  }

  function linkByText(text: string): HTMLAnchorElement {
    const link = links().find((l) => l.textContent.trim() === text);
    if (!link) {
      throw new Error(`link ${text} not found`);
    }
    return link;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuHost],
      providers: [provideRouter([{ path: '**', children: [] }]), ...TRANSLOCO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuHost);
    await settle();
  });

  it('renders a navigation landmark of links with disabled + external handling', () => {
    const nav = root().querySelector('[role="navigation"]');
    expect(nav?.getAttribute('aria-label')).toBe('Sections');
    expect(links()).toHaveLength(4);

    const disabled = linkByText('Reviews');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.getAttribute('tabindex')).toBe('-1');

    const external = linkByText('Help');
    expect(external.getAttribute('href')).toBe('https://koureia.gr/help');
    expect(external.getAttribute('rel')).toBe('noopener');
  });

  it('marks the link of the current route with aria-current', async () => {
    await TestBed.inject(Router).navigateByUrl('/bookings');
    await settle();

    const bookings = linkByText('Bookings');
    expect(bookings.getAttribute('aria-current')).toBe('page');
    expect(bookings.classList).toContain('is-active');
    // Colour alone would leave the state invisible to assistive tech.
    expect(linkByText('Overview').hasAttribute('aria-current')).toBe(false);
  });

  it('keeps items with duplicate labels distinct', async () => {
    fixture.componentInstance.items.set([
      { label: 'Reports', routerLink: '/reports/daily' },
      { label: 'Reports', routerLink: '/reports/monthly' },
    ]);
    await settle();

    // Tracked by reference, so a repeated label is not a duplicate key.
    expect(links().map((l) => l.getAttribute('href'))).toEqual([
      '/reports/daily',
      '/reports/monthly',
    ]);
  });
});

describe('Tabs scroll', () => {
  // jsdom has no layout: the viewport shows 0-200px and the tabs sit side by side.
  const VIEWPORT_WIDTH = 200;
  let tabWidth = 100;
  let headerWidth = 0;
  let scrollX = 0;
  let scrollBy: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<TabsHost>;
  let host: TabsHost;

  const isViewport = (el: Element): boolean => el.classList.contains('tabs-viewport');

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function viewportEl(): HTMLElement {
    const el = root().querySelector<HTMLElement>('.tabs-viewport');
    if (!el) {
      throw new Error('viewport not rendered');
    }
    return el;
  }

  function tabEl(label: string): HTMLElement {
    const el = Array.from(root().querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
      t.textContent.includes(label),
    );
    if (!el) {
      throw new Error(`tab ${label} not rendered`);
    }
    return el;
  }

  function nextButton(): HTMLButtonElement {
    const el = root().querySelector<HTMLButtonElement>('.tabs-scroll--end');
    if (!el) {
      throw new Error('next button not rendered');
    }
    return el;
  }

  function rect(left: number, width: number): DOMRect {
    return {
      left,
      right: left + width,
      x: left,
      width,
      top: 0,
      bottom: 40,
      y: 0,
      height: 40,
      toJSON: () => ({}),
    };
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Renders a scrollable strip with `active` selected from the start. */
  async function render(active: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TabsHost],
      providers: [...TRANSLOCO_PROVIDERS],
    }).compileComponents();
    fixture = TestBed.createComponent(TabsHost);
    host = fixture.componentInstance;
    host.scrollable.set(true);
    host.active.set(active);
    await settle();
  }

  beforeEach(() => {
    tabWidth = 100;
    headerWidth = 0;
    scrollX = 0;
    scrollBy = vi.fn(function (this: Element, options: ScrollToOptions) {
      if (isViewport(this)) {
        scrollX += options.left ?? 0;
      }
    });
    Object.defineProperty(Element.prototype, 'scrollBy', { value: scrollBy, configurable: true });
    vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockImplementation(function (this: Element) {
      return isViewport(this) ? scrollX : 0;
    });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
      if (isViewport(this)) {
        return VIEWPORT_WIDTH;
      }
      return this.classList.contains('tabs-header') ? headerWidth : 0;
    });
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      return isViewport(this) ? 3 * tabWidth : 0;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (isViewport(this)) {
        return rect(0, VIEWPORT_WIDTH);
      }
      const index = Array.from(this.parentElement?.children ?? [])
        .filter((el) => el.getAttribute('role') === 'tab')
        .indexOf(this);
      return this.getAttribute('role') === 'tab'
        ? rect(index * tabWidth - scrollX, tabWidth)
        : rect(0, 0);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(Element.prototype, 'scrollBy');
    ResizeObserverStub.live.clear();
  });

  it('shows the selected tab on first render without motion or a focus move', async () => {
    await render('c');

    expect(scrollBy).toHaveBeenCalledWith({ left: 100, behavior: 'instant' });
    expect(scrollX).toBe(100);
    expect(document.activeElement).toBe(document.body);
  });

  it('shows the selected tab when the labels widen after the first render', async () => {
    tabWidth = 50;
    await render('c');
    expect(scrollBy).not.toHaveBeenCalled();

    // A translation or a web font arrives: the tabs widen, the strip does not.
    tabWidth = 100;
    ResizeObserverStub.resize(tabEl('Gamma'));
    await settle();

    expect(scrollBy).toHaveBeenLastCalledWith({ left: 100, behavior: 'instant' });
    expect(scrollX).toBe(100);
  });

  it('hides the next button when a tab shrinks and the strip fits', async () => {
    await render('a');
    expect(nextButton().disabled).toBe(false);

    tabWidth = 50;
    ResizeObserverStub.resize(tabEl('Alpha'));
    await settle();

    expect(nextButton().disabled).toBe(true);
  });

  it('renders no scroll buttons while every tab fits the header', async () => {
    // The buttons take room from the viewport, so the fit is measured against the header.
    headerWidth = 3 * tabWidth + 68;
    await render('a');
    expect(root().querySelectorAll('.tabs-scroll')).toHaveLength(0);

    headerWidth = 3 * tabWidth - 10;
    ResizeObserverStub.resize(viewportEl());
    await settle();
    expect(root().querySelectorAll('.tabs-scroll')).toHaveLength(2);
  });

  it('scrolls a selection made by code into view, and jumps under reduced motion', async () => {
    await render('a');

    host.active.set('c');
    await settle();
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 100, behavior: 'smooth' });
    expect(document.activeElement).toBe(document.body);

    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    host.active.set('a');
    await settle();
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -100, behavior: 'instant' });
  });

  it('keeps the position the user scrolled to when the strip resizes', async () => {
    await render('a');

    nextButton().click();
    expect(scrollX).toBe(VIEWPORT_WIDTH * 0.8);
    scrollBy.mockClear();

    ResizeObserverStub.resize(viewportEl());
    await settle();

    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe('Tabs copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...TRANSLOCO_PROVIDERS,
        provideUiCopy({ 'tabs.closeLabel': 'customer.closeTab' }),
      ],
    });
    const fixture = TestBed.createComponent(TabsHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { closeTab: 'Remove' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await loadTabsScope();
    fixture.detectChanges();

    const close = (fixture.nativeElement as HTMLElement).querySelector('.tab-close');
    expect(tooltipOf(close)).toBe('Remove');
  });
});

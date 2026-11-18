import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tooltip } from './tooltip';
import { TooltipPosition } from './tooltip-positions';

@Component({
  imports: [Tooltip],
  template: `
    <button
      [libTooltip]="content()"
      [tooltipPosition]="position()"
      [tooltipDisabled]="disabled()"
      [showDelay]="showDelay()"
      [hideDelay]="0"
    >
      Save
    </button>
    <button class="second" libTooltip="Second tip" [showDelay]="0" [hideDelay]="0">More</button>
    <button
      class="described"
      libTooltip="Third tip"
      aria-describedby="external-hint"
      [showDelay]="0"
      [hideDelay]="0"
    >
      Info
    </button>
    <span class="composite" libTooltip="Composite tip" [showDelay]="0" [hideDelay]="0">
      <button class="composite-inner" type="button">Inner</button>
      <button type="button">Other</button>
    </span>
    <span id="external-hint">Costs extra</span>
    <button class="default-delay" libTooltip="Default tip">Plain</button>
  `,
})
class TooltipHost {
  readonly content = signal('Save changes');
  readonly position = signal<TooltipPosition>('top');
  readonly disabled = signal(false);
  readonly showDelay = signal(0);
}

describe('Tooltip', () => {
  let fixture: ComponentFixture<TooltipHost>;
  let host: TooltipHost;

  function button(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('button');
    if (!element) {
      throw new Error('button not rendered');
    }
    return element;
  }

  function tooltip(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="tooltip"]');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(TooltipHost);
    host = fixture.componentInstance;
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('does not render a tooltip until triggered', () => {
    expect(tooltip()).toBeNull();
    expect(button().hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows on pointer enter and hides on pointer leave', async () => {
    button().dispatchEvent(new Event('mouseenter'));
    await settle();

    expect(tooltip()?.textContent).toContain('Save changes');

    button().dispatchEvent(new Event('mouseleave'));
    await settle();

    expect(tooltip()).toBeNull();
  });

  it('shows on focus and describes the host (WCAG 1.4.13)', async () => {
    button().dispatchEvent(new Event('focusin'));
    await settle();

    const surface = tooltip();
    expect(surface).not.toBeNull();
    expect(button().getAttribute('aria-describedby')).toBe(surface?.id);

    button().dispatchEvent(new Event('focusout'));
    await settle();

    expect(tooltip()).toBeNull();
    expect(button().hasAttribute('aria-describedby')).toBe(false);
  });

  it('dismisses on Escape while focused', async () => {
    button().dispatchEvent(new Event('focusin'));
    await settle();
    expect(tooltip()).not.toBeNull();

    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();

    expect(tooltip()).toBeNull();
  });

  it('dismisses on Escape shown by hover alone (WCAG 1.4.13)', async () => {
    button().dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(tooltip()).not.toBeNull();

    // Nothing on the host has focus, so the key never reaches it — the
    // dismissible requirement is met from the document instead.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(tooltip()).toBeNull();
  });

  it('swallows Escape only while a tooltip is showing', async () => {
    // An enclosing dialog listens for Escape too; the tooltip must not
    // keep eating the key once it is gone.
    const seen: string[] = [];
    const listener = (event: Event): void => {
      seen.push((event as KeyboardEvent).key);
    };
    document.addEventListener('keydown', listener);
    try {
      button().dispatchEvent(new Event('mouseenter'));
      await settle();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(tooltip()).toBeNull();
      expect(seen).toEqual([]);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(seen).toEqual(['Escape']);
    } finally {
      document.removeEventListener('keydown', listener);
    }
  });

  it('never shows two tooltips at once', async () => {
    button().dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(tooltip()?.textContent).toContain('Save changes');

    // Straight onto the second trigger — no mouseleave on the first.
    const second = (fixture.nativeElement as HTMLElement).querySelector('button.second');
    second?.dispatchEvent(new Event('mouseenter'));
    await settle();

    const surfaces = document.querySelectorAll('[role="tooltip"]');
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].textContent).toContain('Second tip');
  });

  it('hides when the host is clicked, even while focused', async () => {
    button().dispatchEvent(new Event('focusin'));
    button().dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(tooltip()).not.toBeNull();

    button().click();
    await settle();

    expect(tooltip()).toBeNull();
    expect(button().hasAttribute('aria-describedby')).toBe(false);
  });

  it('hides when disabled while showing', async () => {
    button().dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(tooltip()).not.toBeNull();

    host.disabled.set(true);
    await settle();

    expect(tooltip()).toBeNull();
  });

  it('stays hidden while disabled', async () => {
    host.disabled.set(true);
    await settle();

    button().dispatchEvent(new Event('mouseenter'));
    await settle();

    expect(tooltip()).toBeNull();
  });

  it('exposes the landed side for origin-aware styling', async () => {
    host.position.set('bottom');
    await settle();

    button().dispatchEvent(new Event('mouseenter'));
    await settle();

    expect(tooltip()?.getAttribute('data-position')).toBe('bottom');
  });

  it('keeps a consumer-supplied aria-describedby intact', async () => {
    const described = (fixture.nativeElement as HTMLElement).querySelector('button.described');
    if (!described) {
      throw new Error('described button not rendered');
    }

    // The directive must describe *in addition to* the consumer's ids,
    // never instead of them.
    expect(described.getAttribute('aria-describedby')).toBe('external-hint');

    described.dispatchEvent(new Event('focusin'));
    await settle();

    const ids = described.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(ids).toContain('external-hint');
    expect(ids).toContain(tooltip()?.id);

    described.dispatchEvent(new Event('focusout'));
    await settle();

    expect(described.getAttribute('aria-describedby')).toBe('external-hint');
  });

  it('keeps the tooltip up while focus moves inside the host', async () => {
    const composite = (fixture.nativeElement as HTMLElement).querySelector('.composite');
    const inner = (fixture.nativeElement as HTMLElement).querySelector('.composite-inner');
    if (!composite || !inner) {
      throw new Error('composite host not rendered');
    }

    composite.dispatchEvent(new Event('focusin'));
    await settle();
    expect(tooltip()).not.toBeNull();

    // focusout fires on the host for a move between its own children;
    // treating that as a blur would flicker the tooltip away.
    composite.dispatchEvent(new FocusEvent('focusout', { relatedTarget: inner }));
    await settle();

    expect(tooltip()).not.toBeNull();
  });

  it('treats a negative or non-numeric delay as no delay', async () => {
    host.showDelay.set(-500);
    await settle();

    button().dispatchEvent(new Event('mouseenter'));
    await settle();

    // A raw numberAttribute would hand setTimeout nonsense; normalized,
    // it just shows immediately.
    expect(tooltip()).not.toBeNull();
  });

  it('waits for the show delay before appearing', async () => {
    vi.useFakeTimers();
    try {
      host.showDelay.set(300);
      await settle();

      button().dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(tooltip()).toBeNull();

      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      expect(tooltip()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits 150ms before appearing by default', () => {
    vi.useFakeTimers();
    try {
      const plain = (fixture.nativeElement as HTMLElement).querySelector('button.default-delay');
      if (!plain) {
        throw new Error('default-delay button not rendered');
      }
      plain.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();

      vi.advanceTimersByTime(149);
      fixture.detectChanges();
      expect(tooltip()).toBeNull();

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(tooltip()?.textContent).toContain('Default tip');
    } finally {
      vi.useRealTimers();
    }
  });
});

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { Button, ButtonIcon, ButtonSeverity, ButtonSize, ButtonVariant } from './button';

const buttonStyles = readFileSync('src/button.scss', 'utf8');

@Component({
  imports: [Button, ButtonIcon],
  template: `
    <button
      libButton
      [severity]="severity()"
      [variant]="variant()"
      [size]="size()"
      [iconOnly]="iconOnly()"
      [rounded]="rounded()"
      [raised]="raised()"
      [disabled]="disabled()"
      [loading]="loading()"
      [minDuration]="minDuration()"
    >
      <svg libButtonIcon class="host-icon" aria-hidden="true"></svg>
      Book now
    </button>
    <a libButton href="/booking" [disabled]="disabled()" [loading]="loading()">View booking</a>
  `,
})
class Host {
  readonly severity = signal<ButtonSeverity>('primary');
  readonly variant = signal<ButtonVariant>('filled');
  readonly size = signal<ButtonSize>('md');
  readonly iconOnly = signal(false);
  readonly rounded = signal(false);
  readonly raised = signal(false);
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly minDuration = signal(500);
}

describe('Button', () => {
  let fixture: ComponentFixture<Host>;
  let button: HTMLButtonElement;
  let anchor: HTMLAnchorElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const renderedButton = host.querySelector('button');
    const renderedAnchor = host.querySelector('a');
    if (!renderedButton || !renderedAnchor) {
      throw new Error('expected a native <button> and <a> to be rendered');
    }
    button = renderedButton;
    anchor = renderedAnchor;
  });

  /**
   * Advances the fake clock and redraws.
   *
   * `detectChanges` and no `whenStable`: the clock is faked, and Angular's zoneless scheduler
   * notifies through a `setTimeout` of its own, so awaiting stability under a fake clock waits
   * for a timer only `advanceTimersByTime` can fire. `detectChanges` flushes the effect and the
   * render synchronously, which is all these assertions read.
   */
  function tick(ms: number): void {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  it('renders on native button and anchor elements', () => {
    expect(button.textContent).toContain('Book now');
    expect(anchor.textContent).toContain('View booking');
  });

  it('defaults to a filled primary button at medium size', () => {
    expect(button.getAttribute('data-severity')).toBe('primary');
    expect(button.getAttribute('data-variant')).toBe('filled');
    expect(button.getAttribute('data-size')).toBe('md');
  });

  it('reflects severity, variant, and size inputs as data attributes', async () => {
    fixture.componentInstance.severity.set('error');
    fixture.componentInstance.variant.set('outlined');
    fixture.componentInstance.size.set('lg');
    await fixture.whenStable();

    expect(button.getAttribute('data-severity')).toBe('error');
    expect(button.getAttribute('data-variant')).toBe('outlined');
    expect(button.getAttribute('data-size')).toBe('lg');
  });

  it('keeps the accessible foreground while outlined and text buttons are pressed', () => {
    const pressedPlainRules = Array.from(
      buttonStyles.matchAll(
        /:host\(\[data-variant='(?:outlined|text)'\]\)\s*\{[\s\S]*?&:active\s*\{([^}]*)}/g,
      ),
    );

    expect(pressedPlainRules).toHaveLength(2);
    for (const rule of pressedPlainRules) {
      const declarations = rule[1];
      expect(declarations).toContain('background: var(--btn-subtle)');
      expect(declarations).not.toMatch(/\bcolor\s*:/);
    }
  });

  it('leaves the padding override undeclared, so a consumer rule can reach it', () => {
    // A custom property set on the element beats one inherited from an ancestor, so a size
    // rule declaring `--btn-pad-*` would make the override unreachable at any specificity.
    expect(buttonStyles).toContain(
      'padding: var(--btn-pad-y, var(--btn-size-pad-y)) var(--btn-pad-x, var(--btn-size-pad-x))',
    );
    expect(buttonStyles).not.toMatch(/--btn-pad-[xy]\s*:/);
  });

  it('gives every size a padding of its own on both axes', () => {
    const sizeRules = Array.from(
      buttonStyles.matchAll(/:host\(\[data-size='(sm|md|lg)'\]\)\s*\{([^}]*)}/g),
    );

    expect(sizeRules.map((rule) => rule[1])).toEqual(['sm', 'md', 'lg']);
    for (const rule of sizeRules) {
      expect(rule[2]).toMatch(/--btn-size-pad-y\s*:/);
      expect(rule[2]).toMatch(/--btn-size-pad-x\s*:/);
    }
  });

  it('keeps an icon-only button square through the override, not around it', () => {
    const rule = /:host\(\[data-icon-only\]\)\s*\{([^}]*)}/.exec(buttonStyles);
    if (rule === null) {
      throw new Error('no icon-only rule');
    }

    expect(rule[1]).toContain('aspect-ratio: 1');
    // The horizontal padding follows the vertical one a consumer may have raised.
    expect(rule[1]).toContain('--btn-size-pad-x: var(--btn-pad-y, var(--btn-size-pad-y))');
  });

  it('draws no spinner and reports nothing busy until loading', () => {
    expect(button.querySelector('.btn-spinner')).toBeNull();
    expect(button.hasAttribute('data-loading')).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.querySelector('.host-icon')).not.toBeNull();
  });

  it('replaces the marked icon with a spinner while loading, keeping the caption', async () => {
    const caption = button.textContent.trim();

    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();

    expect(button.querySelector('.btn-spinner')).not.toBeNull();
    // Replaced, not joined: the caption must not be pushed sideways mid-action.
    expect(button.querySelector('.host-icon')).toBeNull();
    expect(button.getAttribute('data-loading')).toBe('');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent.trim()).toBe(caption);
  });

  it('hides the spinner from assistive tech, which reads aria-busy instead', async () => {
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();

    expect(button.querySelector('.btn-spinner')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('blocks a loading button and anchor, so neither can be pressed twice', async () => {
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.tabIndex).toBe(-1);
  });

  it('blocks activation of a loading anchor, as it does a disabled one', async () => {
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  describe('the minimum-duration floor', () => {
    // Faked here and not in the outer hook: `compileComponents()` awaits work of its own that a
    // fake clock never lets finish, so every test in the file would time out in setup.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Raises `loading`, waits `ms` on the fake clock, then lowers it. */
    function action(ms: number): void {
      fixture.componentInstance.loading.set(true);
      fixture.detectChanges();

      tick(ms);
      fixture.componentInstance.loading.set(false);
      fixture.detectChanges();
    }

    it('keeps spinning for the rest of the floor when the action ends early', () => {
      action(60);

      // The request is over, but two frames of spinner reads as a glitch, not as feedback.
      expect(button.querySelector('.btn-spinner')).not.toBeNull();
      expect(button.getAttribute('aria-busy')).toBe('true');

      tick(440);

      expect(button.querySelector('.btn-spinner')).toBeNull();
      expect(button.hasAttribute('aria-busy')).toBe(false);
    });

    it('refuses a press while the floor alone is holding it', () => {
      action(60);

      // Otherwise a spinning button takes a second submission for the action just finished.
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(anchor.tabIndex).toBe(-1);
    });

    it('adds nothing to an action that already outlasts the floor', () => {
      action(900);

      // The floor elapsed long ago, so lowering the flag stops the spinner in the same pass.
      expect(button.querySelector('.btn-spinner')).toBeNull();
      expect(button.disabled).toBe(false);
    });

    it('restores the icon once the floor is over, not when the action ends', () => {
      action(60);
      // The slot lives in an `@else`, so this is what proves the icon comes back at all.
      expect(button.querySelector('.host-icon')).toBeNull();

      tick(440);

      expect(button.querySelector('.host-icon')).not.toBeNull();
    });

    it('stops spinning with the action when the floor is turned off', () => {
      fixture.componentInstance.minDuration.set(0);
      fixture.detectChanges();

      action(0);

      expect(button.querySelector('.btn-spinner')).toBeNull();
      expect(button.disabled).toBe(false);
    });

    it('takes a negative floor as no floor, never as a negative timeout', () => {
      fixture.componentInstance.minDuration.set(-1);
      fixture.detectChanges();

      action(0);

      expect(button.querySelector('.btn-spinner')).toBeNull();
    });
  });

  it('sizes the spinner in em, so it follows the font size each size already sets', () => {
    const rule = /\.btn-spinner\s*\{([^}]*)}/.exec(buttonStyles);
    if (rule === null) {
      throw new Error('no spinner rule');
    }

    expect(rule[1]).toContain('width: 1em');
    expect(rule[1]).toContain('height: 1em');
    expect(rule[1]).toMatch(/animation:\s*btn-spin/);
    // The base layer's reduced-motion rule covers it, so no query of its own.
    expect(buttonStyles).not.toContain('prefers-reduced-motion');
  });

  it('omits the boolean modifier attributes by default', () => {
    expect(button.hasAttribute('data-icon-only')).toBe(false);
    expect(button.hasAttribute('data-rounded')).toBe(false);
    expect(button.hasAttribute('data-raised')).toBe(false);
    expect(button.disabled).toBe(false);
  });

  it('reflects the boolean modifiers as data attributes', async () => {
    fixture.componentInstance.iconOnly.set(true);
    fixture.componentInstance.rounded.set(true);
    fixture.componentInstance.raised.set(true);
    await fixture.whenStable();

    expect(button.hasAttribute('data-icon-only')).toBe(true);
    expect(button.hasAttribute('data-rounded')).toBe(true);
    expect(button.hasAttribute('data-raised')).toBe(true);
  });

  it('disables the native button and marks both hosts aria-disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
  });

  it('takes a disabled anchor out of the tab order', async () => {
    expect(anchor.hasAttribute('tabindex')).toBe(false);

    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    expect(anchor.tabIndex).toBe(-1);
  });

  it('blocks activation of a disabled anchor, including from the keyboard', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    // Enter on a focused anchor dispatches a click; `pointer-events`
    // never sees it, so navigation has to be blocked on the event.
    const activation = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(activation);

    expect(activation.defaultPrevented).toBe(true);
  });

  it('does not put an inert disabled attribute on anchor hosts', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    expect(anchor.hasAttribute('disabled')).toBe(false);
  });

  it('restores anchor interaction when re-enabled', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    fixture.componentInstance.disabled.set(false);
    await fixture.whenStable();

    expect(anchor.hasAttribute('tabindex')).toBe(false);
    const activation = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(activation);

    expect(activation.defaultPrevented).toBe(false);
  });
});

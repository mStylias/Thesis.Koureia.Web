import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { Spin, SPIN_ANIMATIONS } from './spin';

const spinStyles = readFileSync('../../styles/src/components/_spin.scss', 'utf8');

@Component({
  imports: [Spin],
  template: `
    <svg [libSpin]="busy()" aria-hidden="true">
      <g><path d="M0 0" /></g>
    </svg>
  `,
})
class Host {
  readonly busy = signal(false);
}

/** jsdom has no `AnimationEvent`. The directive reads only `target` and `animationName`. */
function turn(target: Element, type: string, animationName: string): void {
  target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { animationName }));
}

describe('Spin', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let icon: SVGElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    if (!svg) {
      throw new Error('icon not rendered');
    }
    icon = svg;
  });

  it('marks the host for the partial and stays still while idle', () => {
    expect(icon.hasAttribute('data-lib-spin')).toBe(true);
    expect(icon.hasAttribute('data-spinning')).toBe(false);
  });

  it('spins while the work runs', async () => {
    host.busy.set(true);
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(true);
  });

  it('keeps turning after the work ends, until the turn comes to rest', async () => {
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();
    // Removing the attribute here is the snap back this directive exists to prevent.
    expect(icon.hasAttribute('data-spinning')).toBe(true);

    turn(icon, 'animationiteration', 'lib-spin-loop');
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(false);
  });

  it('gives a short load the whole of the lead turn', async () => {
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();

    turn(icon, 'animationend', 'lib-spin-lead');
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(false);
  });

  it('keeps spinning through a turn boundary while the work still runs', async () => {
    host.busy.set(true);
    await settle();

    turn(icon, 'animationend', 'lib-spin-lead');
    turn(icon, 'animationiteration', 'lib-spin-loop');
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(true);
  });

  it('keeps the spin when work starts again before the turn ends', async () => {
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();
    host.busy.set(true);
    await settle();

    turn(icon, 'animationiteration', 'lib-spin-loop');
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(true);
  });

  it('ignores the animations of descendants and of other keyframes', async () => {
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();

    const path = icon.querySelector('path');
    if (!path) {
      throw new Error('path not rendered');
    }
    turn(path, 'animationiteration', 'lib-spin-loop');
    turn(icon, 'animationend', 'something-else');
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(true);
  });

  it('stops when the browser cancels the turn, as it does for a hidden host', async () => {
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();

    turn(icon, 'animationcancel', 'lib-spin-loop');
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(false);
  });

  // Regression: under reduced motion no turn runs, so no boundary event ever comes.
  it('stops at once when no spin animation runs', async () => {
    Object.defineProperty(icon, 'getAnimations', { value: () => [] });
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(false);
  });

  it('waits for the boundary while a spin animation runs', async () => {
    const running = [{ animationName: 'lib-spin-loop' }];
    Object.defineProperty(icon, 'getAnimations', { value: () => running });
    host.busy.set(true);
    await settle();
    host.busy.set(false);
    await settle();
    expect(icon.hasAttribute('data-spinning')).toBe(true);
  });
});

describe('Spin styles', () => {
  it('defines every keyframe the directive listens for', () => {
    for (const name of SPIN_ANIMATIONS) {
      expect(spinStyles).toContain(`@keyframes ${name}`);
    }
  });

  it('starts the loop when the lead turn ends', () => {
    expect(spinStyles).toMatch(/lib-spin-lead var\(--dur-spin\)/);
    expect(spinStyles).toMatch(/lib-spin-loop var\(--dur-spin\) \S+ var\(--dur-spin\) infinite/);
  });

  it('removes the animation under reduced motion', () => {
    expect(spinStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\[data-lib-spin\]\[data-spinning\]\s*\{\s*animation: none;/,
    );
  });
});

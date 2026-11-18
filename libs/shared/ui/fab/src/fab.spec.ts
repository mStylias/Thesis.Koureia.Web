import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { readFileSync } from 'node:fs';

import { Fab } from './fab';
import { FabGroup } from './fab-group';
import type { FabGroupPosition, FabSeverity, FabSize } from './fab.types';

const fabStyles = readFileSync('src/fab.scss', 'utf8');
const groupStyles = readFileSync('src/fab-group.scss', 'utf8');

@Component({
  imports: [Fab, FabGroup],
  template: `
    <lib-fab-group [position]="position()">
      <button libFab type="button" size="sm" severity="secondary" aria-label="Change view">
        <svg aria-hidden="true"></svg>
      </button>
      <button
        libFab
        type="button"
        aria-label="New appointment"
        [size]="size()"
        [severity]="severity()"
        [disabled]="disabled()"
        (click)="presses.set(presses() + 1)"
      >
        <svg aria-hidden="true"></svg>
      </button>
    </lib-fab-group>
  `,
})
class Host {
  readonly position = signal<FabGroupPosition>('fixed');
  readonly size = signal<FabSize>('md');
  readonly severity = signal<FabSeverity>('primary');
  readonly disabled = signal(false);
  readonly presses = signal(0);
}

describe('Fab', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function main(): HTMLButtonElement {
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="New appointment"]',
    );
    if (!button) throw new Error('main button not rendered');
    return button;
  }

  function group(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-fab-group',
    );
    if (!element) throw new Error('group not rendered');
    return element;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  it('defaults to the medium primary button', () => {
    expect(main().getAttribute('data-size')).toBe('md');
    expect(main().getAttribute('data-severity')).toBe('primary');
  });

  it('reflects size and severity on the host', async () => {
    fixture.componentInstance.size.set('lg');
    fixture.componentInstance.severity.set('secondary');
    await settle();

    expect(main().getAttribute('data-size')).toBe('lg');
    expect(main().getAttribute('data-severity')).toBe('secondary');
  });

  it('stays a native button, so disabled refuses the press', async () => {
    main().click();
    fixture.componentInstance.disabled.set(true);
    await settle();
    main().click();

    expect(main().disabled).toBe(true);
    expect(fixture.componentInstance.presses()).toBe(1);
  });

  it('pins the group to the viewport unless told to use its container', async () => {
    expect(group().getAttribute('data-position')).toBe('fixed');

    fixture.componentInstance.position.set('absolute');
    await settle();

    expect(group().getAttribute('data-position')).toBe('absolute');
  });

  it('keeps the elevation under the focus ring, and a frame in forced colors', () => {
    expect(fabStyles).toMatch(
      /:host\(:focus-visible\)\s*\{\s*box-shadow:\s*0 0 0 2px var\(--focus-ring\),/,
    );
    expect(fabStyles).toContain('@media (forced-colors: active)');
  });

  // jsdom does no hit testing, so `click()` passes whatever the styles say. The rule that turns
  // pointer events back on must be on the button itself. A `> *` rule in the group never
  // matches, because the buttons are projected content.
  it('turns pointer events back on in the button, where the group cannot reach', () => {
    expect(groupStyles).toContain('pointer-events: none');
    expect(groupStyles).not.toMatch(/>\s*\*\s*\{/);
    expect(fabStyles).toMatch(/:host\s*\{[^}]*pointer-events: auto;/);
  });

  it('clears the safe area and sits under overlays', () => {
    expect(groupStyles).toContain('env(safe-area-inset-bottom');
    expect(groupStyles).toContain('z-index: var(--z-sticky)');
  });
});

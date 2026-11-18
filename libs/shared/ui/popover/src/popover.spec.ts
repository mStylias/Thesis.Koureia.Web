import { Component, inject, TemplateRef, viewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverRef } from './popover-ref';
import { PopoverService } from './popover.service';
import { PopoverCloseReason, PopoverConfig } from './popover.types';

@Component({
  template: `
    <ng-template #content>
      <div class="popover-content">
        Καλημέρα
        <!-- Stands in for any control that opens an overlay of its own: a date
             picker, a select, a menu. It names its popup the way they do. -->
        <button type="button" class="nested-trigger" aria-controls="nested-popup">
          Ημερομηνία
        </button>
      </div>
    </ng-template>
  `,
})
class PopoverHost {
  readonly content = viewChild.required<TemplateRef<unknown>>('content');
  readonly viewContainerRef = inject(ViewContainerRef);
  readonly popover = inject(PopoverService);
}

describe('PopoverService', () => {
  let fixture: ComponentFixture<PopoverHost>;
  let host: PopoverHost;
  let closeReasons: PopoverCloseReason[];

  beforeEach(() => {
    fixture = TestBed.createComponent(PopoverHost);
    host = fixture.componentInstance;
    closeReasons = [];
    fixture.detectChanges();
  });

  function open(config?: Partial<PopoverConfig>): PopoverRef {
    return host.popover.open({
      anchor: { x: 40, y: 60 },
      template: host.content(),
      viewContainerRef: host.viewContainerRef,
      positions: [{ originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' }],
      onClose: (reason) => closeReasons.push(reason),
      ...config,
    });
  }

  function pane(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.cdk-overlay-pane');
  }

  it('renders the template inside an overlay pane', () => {
    const ref = open();

    expect(pane()).toBeTruthy();
    expect(document.querySelector('.popover-content')?.textContent).toContain('Καλημέρα');

    ref.dispose();
  });

  it('close() tears the overlay down and reports the reason once', async () => {
    const ref = open();

    await ref.close();
    await ref.close();

    expect(pane()).toBeNull();
    expect(closeReasons).toEqual(['programmatic']);
    expect(ref.closed).toBe(true);
  });

  it('awaits beforeDispose before removing the pane', async () => {
    let resolveExit!: () => void;
    const exit = new Promise<void>((resolve) => (resolveExit = resolve));
    const ref = open({ beforeDispose: () => exit });

    const closing = ref.close();
    expect(pane()).toBeTruthy();

    resolveExit();
    await closing;
    expect(pane()).toBeNull();
  });

  it('still tears the overlay down when beforeDispose rejects', async () => {
    const ref = open({
      beforeDispose: () => Promise.reject(new Error('exit animation failed')),
    });

    await expect(ref.close()).rejects.toThrow('exit animation failed');

    expect(pane()).toBeNull();
  });

  it('still tears the overlay down when onClose throws', async () => {
    const ref = open({
      onClose: () => {
        throw new Error('consumer blew up');
      },
    });

    await expect(ref.close()).rejects.toThrow('consumer blew up');

    expect(pane()).toBeNull();
  });

  it('dismisses on pointer interaction outside the pane', () => {
    open();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closeReasons).toEqual(['outside']);
  });

  it('does not dismiss on clicks inside the pane', () => {
    const ref = open();

    const content = document.querySelector('.popover-content');
    content?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closeReasons).toEqual([]);
    ref.dispose();
  });

  // A control inside a popover opens its overlay as a sibling pane, so CDK
  // reports every pointer in it as outside. Dismissing there kills the control
  // on pointerdown, before its click can land — the popover vanishes and
  // nothing is recorded. `aria-controls` is the link that says otherwise.
  it('does not dismiss for a pointer inside a popup the pane declares it controls', () => {
    const ref = open();

    const popup = document.createElement('div');
    popup.id = 'nested-popup';
    popup.innerHTML = '<button type="button" class="day">14</button>';
    document.body.appendChild(popup);

    const day = popup.querySelector('.day');
    day?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    day?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closeReasons).toEqual([]);

    popup.remove();
    ref.dispose();
  });

  it('still dismisses for a pointer in an unrelated overlay', () => {
    open();

    const other = document.createElement('div');
    other.id = 'someone-elses-popup';
    document.body.appendChild(other);

    other.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    other.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closeReasons).toEqual(['outside']);
    other.remove();
  });

  it('dismisses on Escape captured at the pane', () => {
    open();

    pane()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closeReasons).toEqual(['escape']);
  });

  it('dispose() is idempotent', () => {
    const ref = open();

    ref.dispose();
    // overlayElement is null after the first teardown, so an unguarded
    // second call threw — which an exit animation racing a reopen hits.
    expect(() => {
      ref.dispose();
    }).not.toThrow();
    expect(pane()).toBeNull();
  });

  it('dispose() after close() does not throw', async () => {
    const ref = open();

    await ref.close();
    expect(() => {
      ref.dispose();
    }).not.toThrow();
    expect(closeReasons).toEqual(['programmatic']);
  });

  it('can be re-anchored while open', () => {
    const ref = open();

    expect(() => {
      ref.updateAnchor({ x: 200, y: 300 });
    }).not.toThrow();
    expect(closeReasons).toEqual([]);

    ref.dispose();
  });
});

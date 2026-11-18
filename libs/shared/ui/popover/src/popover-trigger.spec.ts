import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverTrigger } from './popover-trigger';

@Component({
  imports: [PopoverTrigger],
  template: `
    <button
      type="button"
      class="trigger"
      [libPopoverTriggerFor]="content"
      [popoverAriaLabel]="ariaLabel()"
      [popoverDisabled]="disabled()"
    >
      Details
    </button>
    <ng-template #content>
      <div class="popover-body">
        <button type="button" class="inner">Action</button>
      </div>
    </ng-template>
  `,
})
class PopoverTriggerHost {
  readonly ariaLabel = signal('');
  readonly disabled = signal(false);
}

describe('PopoverTrigger', () => {
  let fixture: ComponentFixture<PopoverTriggerHost>;
  let host: PopoverTriggerHost;

  beforeEach(() => {
    fixture = TestBed.createComponent(PopoverTriggerHost);
    host = fixture.componentInstance;
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

  function dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.cdk-overlay-pane [role="dialog"]');
  }

  async function clickTrigger(): Promise<void> {
    // A real click is preceded by pointerdown, which the trigger uses
    // to snapshot open-state for correct toggling.
    trigger().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  }

  it('marks the trigger with the dialog ARIA contract', () => {
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a dialog surface with the content on click', async () => {
    await clickTrigger();

    expect(dialog()).toBeTruthy();
    expect(document.querySelector('.popover-body')).toBeTruthy();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(dialog()?.id);
  });

  it('moves focus to the first focusable element inside the dialog', async () => {
    await clickTrigger();

    expect(document.activeElement).toBe(document.querySelector('.inner'));
  });

  it('toggles closed on a second trigger click', async () => {
    await clickTrigger();
    await clickTrigger();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on outside pointer interaction', async () => {
    await clickTrigger();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(dialog()).toBeNull();
  });

  it('names the dialog after the trigger when nothing else does', async () => {
    await clickTrigger();

    // A role="dialog" with no accessible name fails AXE's
    // aria-dialog-name; the trigger the user just activated is the
    // fallback name.
    expect(trigger().id).toBeTruthy();
    expect(dialog()?.getAttribute('aria-labelledby')).toBe(trigger().id);
    expect(dialog()?.hasAttribute('aria-label')).toBe(false);
  });

  it('drops the fallback when an explicit name is given', async () => {
    host.ariaLabel.set('Shop hours');
    await clickTrigger();

    // aria-labelledby wins over aria-label, so it must not linger.
    expect(dialog()?.getAttribute('aria-label')).toBe('Shop hours');
    expect(dialog()?.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('follows a name that changes while the popover is open', async () => {
    host.ariaLabel.set('Shop hours');
    await clickTrigger();

    host.ariaLabel.set('Ώρες λειτουργίας');
    await settle();

    expect(dialog()?.getAttribute('aria-label')).toBe('Ώρες λειτουργίας');
  });

  it('advertises no popup while disabled, and does not open', async () => {
    host.disabled.set(true);
    await settle();

    expect(trigger().hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger().hasAttribute('aria-expanded')).toBe(false);

    await clickTrigger();
    expect(dialog()).toBeNull();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    trigger().focus();
    await clickTrigger();

    document
      .querySelector<HTMLElement>('.cdk-overlay-pane')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});

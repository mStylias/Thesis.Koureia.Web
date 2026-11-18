import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucidePlus } from '@lucide/angular';
import { Accordion } from './accordion';
import {
  AccordionHeading,
  AccordionContent,
  AccordionIndicator,
  AccordionPanel,
  AccordionPanelBody,
  AccordionTrigger,
} from './accordion-parts';
import { AccordionValue } from './accordion.types';

@Component({
  imports: [
    Accordion,
    AccordionHeading,
    AccordionContent,
    AccordionIndicator,
    AccordionPanel,
    AccordionPanelBody,
    AccordionTrigger,
    LucidePlus,
  ],
  template: `
    <lib-accordion [multiple]="multiple()" [(value)]="active" #accordion>
      <section>
        <h3 libAccordionHeading>
          <button libAccordionTrigger value="account" [panel]="accountPanel">Account</button>
        </h3>
        <div libAccordionPanel #accountPanel="ngAccordionPanel">
          <ng-template libAccordionContent>
            <div libAccordionPanelBody>
              <span class="account-content">Account content</span>
            </div>
          </ng-template>
        </div>
      </section>

      <section>
        <h3 libAccordionHeading>
          <button
            libAccordionTrigger
            value="security"
            [panel]="securityPanel"
            [disabled]="securityDisabled()"
          >
            Security
            <svg libAccordionIndicator lucidePlus></svg>
          </button>
        </h3>
        <div libAccordionPanel #securityPanel="ngAccordionPanel">
          <ng-template libAccordionContent>
            <div libAccordionPanelBody>
              <span class="security-content">Security content</span>
            </div>
          </ng-template>
        </div>
      </section>
    </lib-accordion>
  `,
})
class AccordionHost {
  readonly active = signal<AccordionValue>('account');
  readonly multiple = signal(false);
  readonly securityDisabled = signal(false);
}

describe('Accordion', () => {
  let fixture: ComponentFixture<AccordionHost>;
  let host: AccordionHost;

  function triggers(): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button[libAccordionTrigger]',
      ),
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccordionHost] }).compileComponents();
    fixture = TestBed.createComponent(AccordionHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('wires triggers and regions with the complete aria contract', () => {
    const [account] = triggers();
    const controlledId = account.getAttribute('aria-controls');
    const panel = controlledId
      ? (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${controlledId}`)
      : null;

    expect(account.getAttribute('type')).toBe('button');
    expect(account.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.getAttribute('aria-labelledby')).toBe(account.id);
    expect(panel?.hasAttribute('inert')).toBe(false);
  });

  it('synchronizes click interaction back to the controlled value', async () => {
    const [, security] = triggers();
    security.focus();
    security.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.active()).toBe('security');
    expect(security.getAttribute('aria-expanded')).toBe('true');
    expect(triggers()[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('reacts to external controlled value changes', async () => {
    host.active.set('security');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggers()[0].getAttribute('aria-expanded')).toBe('false');
    expect(triggers()[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('supports multiple expansion with an array value', async () => {
    host.multiple.set(true);
    host.active.set(['account', 'security']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggers().map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
    ]);

    triggers()[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.active()).toEqual(['security']);
  });

  /**
   * The array value was only ever exercised by writing it from outside.
   * `multiple` is enforced by the reconciling effect rather than by the
   * headless group, so the click path is what can actually regress.
   */
  it('keeps earlier panels open when a second is clicked in multiple mode', async () => {
    host.multiple.set(true);
    host.active.set(['account']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    triggers()[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggers().map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
    ]);
    expect(host.active()).toEqual(['account', 'security']);
  });

  /** Both public methods were untested, and both write back through `value`. */
  it('expands and collapses every panel through the group methods', async () => {
    const accordion = fixture.debugElement.children[0].componentInstance as Accordion;
    host.multiple.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    accordion.expandAll();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggers().map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
    ]);
    expect(host.active()).toEqual(['account', 'security']);

    accordion.collapseAll();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggers().map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false',
    ]);
    expect(host.active()).toEqual([]);
  });

  it('marks disabled triggers and prevents their activation', async () => {
    host.securityDisabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const [, security] = triggers();
    expect(security.getAttribute('aria-disabled')).toBe('true');
    security.click();
    fixture.detectChanges();
    expect(host.active()).toBe('account');
  });

  it('moves focus between headers with the accordion keyboard model', async () => {
    const [account, security] = triggers();
    account.focus();
    account.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(security);
  });

  it('uses the projected indicator instead of the default chevron', () => {
    const [account, security] = triggers();
    expect(account.querySelector('[lucidechevrondown]')).toBeTruthy();
    expect(security.querySelector('[libAccordionIndicator]')).toBeTruthy();
    expect(security.querySelector('[lucidechevrondown]')).toBeNull();
  });

  it('lazily creates content on first expansion and preserves it', async () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.account-content')).toBeTruthy();
    expect(root.querySelector('.security-content')).toBeNull();

    triggers()[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('.security-content')).toBeTruthy();

    triggers()[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('.security-content')).toBeTruthy();
  });
});

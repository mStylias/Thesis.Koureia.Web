import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Checkbox } from './checkbox';

@Component({
  imports: [Checkbox],
  template: `
    <lib-checkbox
      [(value)]="value"
      [indeterminate]="indeterminate()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      [name]="name()"
      [ariaLabelledby]="ariaLabelledby()"
      [ariaDescribedby]="ariaDescribedby()"
      (touch)="touchCount = touchCount + 1"
    >
      Remember me
    </lib-checkbox>
  `,
})
class CheckboxHost {
  readonly value = signal(false);
  readonly indeterminate = signal(false);
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly required = signal(false);
  readonly name = signal('');
  readonly ariaLabelledby = signal('');
  readonly ariaDescribedby = signal('');

  touchCount = 0;
}

/** A label carrying a link, the shape the registration terms checkbox uses. */
@Component({
  imports: [Checkbox],
  template: `
    <lib-checkbox [(value)]="value">
      I agree to the <a href="/terms">Terms of Service</a>.
    </lib-checkbox>
  `,
})
class ProjectedLinkHost {
  readonly value = signal(false);
}

describe('Checkbox', () => {
  let fixture: ComponentFixture<CheckboxHost>;
  let host: CheckboxHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-checkbox');
    if (!element) {
      throw new Error('lib-checkbox not rendered');
    }
    return element as HTMLElement;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!element) {
      throw new Error('native input not rendered');
    }
    return element;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(CheckboxHost);
    host = fixture.componentInstance;
    await settle();
  });

  it('renders the projected label and an unchecked native input', () => {
    expect(root().textContent).toContain('Remember me');
    expect(input().checked).toBe(false);
    expect(root().hasAttribute('data-checked')).toBe(false);
  });

  it('toggles the value on click and reflects data-checked', async () => {
    input().click();
    await settle();

    expect(host.value()).toBe(true);
    expect(root().hasAttribute('data-checked')).toBe(true);

    input().click();
    await settle();

    expect(host.value()).toBe(false);
    expect(root().hasAttribute('data-checked')).toBe(false);
  });

  it('follows programmatic value changes', async () => {
    host.value.set(true);
    await settle();

    expect(input().checked).toBe(true);
  });

  it('sets the native indeterminate property', async () => {
    host.indeterminate.set(true);
    await settle();

    expect(input().indeterminate).toBe(true);
  });

  it('blocks interaction while disabled', async () => {
    host.disabled.set(true);
    await settle();

    input().click();
    await settle();

    expect(host.value()).toBe(false);
    expect(input().disabled).toBe(true);
    expect(root().hasAttribute('data-disabled')).toBe(true);
  });

  it('reflects invalid as aria-invalid on the native input', async () => {
    host.invalid.set(true);
    await settle();

    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(root().hasAttribute('data-invalid')).toBe(true);
  });

  // Regression: the browser clears `indeterminate` on click, and the bound
  // value has not changed, so Angular writes nothing — the mixed dash
  // disappeared for good even though the consumer still reported mixed.
  it('restores indeterminate after a click that leaves it set', async () => {
    host.indeterminate.set(true);
    await settle();
    expect(input().indeterminate).toBe(true);

    input().click();
    await settle();

    expect(host.value()).toBe(true);
    expect(input().indeterminate).toBe(true);
  });

  it('clears indeterminate when the consumer clears it', async () => {
    host.indeterminate.set(true);
    await settle();

    input().click();
    host.indeterminate.set(false);
    await settle();

    expect(input().indeterminate).toBe(false);
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    host.required.set(true);
    await settle();

    expect(input().getAttribute('aria-required')).toBe('true');
    expect(input().hasAttribute('required')).toBe(false);
    expect(input().required).toBe(false);
  });

  it('omits optional attributes until they are set', async () => {
    expect(input().hasAttribute('name')).toBe(false);
    expect(input().hasAttribute('aria-labelledby')).toBe(false);
    expect(input().hasAttribute('aria-describedby')).toBe(false);
    expect(input().hasAttribute('aria-required')).toBe(false);
    expect(input().hasAttribute('aria-invalid')).toBe(false);

    host.name.set('terms');
    host.ariaLabelledby.set('terms-heading');
    host.ariaDescribedby.set('terms-hint');
    await settle();

    expect(input().getAttribute('name')).toBe('terms');
    expect(input().getAttribute('aria-labelledby')).toBe('terms-heading');
    expect(input().getAttribute('aria-describedby')).toBe('terms-hint');
  });

  it('emits touch when focus leaves', async () => {
    input().dispatchEvent(new Event('focusout', { bubbles: true }));
    await settle();

    expect(host.touchCount).toBe(1);
  });

  // The stretched input used to paint over the projected label, so a link in the
  // label took no clicks at all. The fix is one CSS declaration, which jsdom
  // cannot observe because it does no layout.
  //
  // What these pin is the half that survives in the DOM: a label forwards a click
  // on its text to the input and never forwards one aimed at a link. The fix
  // relies on that asymmetry, so a change to the markup that broke it would make
  // the CSS insufficient. Verify the stacking itself in a browser.
  describe('projected interactive content', () => {
    let linkFixture: ComponentFixture<ProjectedLinkHost>;
    let linkHost: ProjectedLinkHost;

    function linkRoot(): HTMLElement {
      const element = (linkFixture.nativeElement as HTMLElement).querySelector('lib-checkbox');
      if (!element) {
        throw new Error('lib-checkbox not rendered');
      }
      return element as HTMLElement;
    }

    function label(): HTMLElement {
      const element = linkRoot().querySelector<HTMLElement>('.checkbox-label');
      if (!element) {
        throw new Error('projected label not rendered');
      }
      return element;
    }

    function link(): HTMLAnchorElement {
      const element = linkRoot().querySelector('a');
      if (!element) {
        throw new Error('projected link not rendered');
      }
      return element;
    }

    beforeEach(async () => {
      linkFixture = TestBed.createComponent(ProjectedLinkHost);
      linkHost = linkFixture.componentInstance;
      linkFixture.detectChanges();
      await linkFixture.whenStable();
    });

    it('projects the link inside the label that covers the input', () => {
      expect(label().contains(link())).toBe(true);
    });

    it('does not toggle when a projected link is clicked', async () => {
      link().click();
      linkFixture.detectChanges();
      await linkFixture.whenStable();

      expect(linkHost.value()).toBe(false);
    });

    it('still toggles when the label text is clicked', async () => {
      label().click();
      linkFixture.detectChanges();
      await linkFixture.whenStable();

      expect(linkHost.value()).toBe(true);
    });
  });
});

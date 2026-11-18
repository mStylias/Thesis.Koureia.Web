import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { readFileSync } from 'node:fs';
import { Switch } from './switch';
import { SwitchSize } from './switch.types';

@Component({
  imports: [Switch],
  template: `
    <lib-switch
      [(value)]="value"
      [size]="size()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
      [ariaDescribedby]="ariaDescribedby()"
      inputId="reminders"
      name="reminders"
      (touch)="touchCount = touchCount + 1"
    >
      Appointment reminders
    </lib-switch>
  `,
})
class SwitchHost {
  readonly value = signal(false);
  readonly size = signal<SwitchSize>('md');
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly required = signal(false);
  readonly ariaLabel = signal('');
  readonly ariaLabelledby = signal('');
  readonly ariaDescribedby = signal('');
  readonly switch = viewChild.required(Switch);

  touchCount = 0;
}

@Component({
  imports: [Switch, FormField],
  template: `
    <lib-switch [formField]="settingsForm.reminders"> Appointment reminders </lib-switch>
  `,
})
class SignalFormsHost {
  readonly model = signal({ reminders: false });
  readonly settingsForm = form(this.model, (path) => {
    required(path.reminders, { message: 'Enable reminders' });
  });
}

/** A label carrying a link, the shape a consent switch uses. */
@Component({
  imports: [Switch],
  template: `
    <lib-switch [(value)]="value"> I accept the <a href="/terms">Terms of Service</a>. </lib-switch>
  `,
})
class ProjectedLinkHost {
  readonly value = signal(false);
}

describe('Switch', () => {
  let fixture: ComponentFixture<SwitchHost>;
  let host: SwitchHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-switch');
    if (!element) {
      throw new Error('lib-switch not rendered');
    }
    return element as HTMLElement;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector<HTMLInputElement>('input');
    if (!element) {
      throw new Error('native input not rendered');
    }
    return element;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(SwitchHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('renders a labelled native checkbox with switch semantics', () => {
    expect(root().textContent).toContain('Appointment reminders');
    expect(input().type).toBe('checkbox');
    expect(input().getAttribute('role')).toBe('switch');
    expect(input().id).toBe('reminders');
    expect(input().name).toBe('reminders');
    expect(input().checked).toBe(false);
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    expect(input().hasAttribute('aria-required')).toBe(false);

    host.required.set(true);
    await fixture.whenStable();

    expect(input().getAttribute('aria-required')).toBe('true');
    // The native attribute would block the submit event outright and
    // raise an OS-locale bubble over the form's translated message.
    expect(input().hasAttribute('required')).toBe(false);
    expect(input().required).toBe(false);
  });

  it('passes aria-describedby through to the native input', async () => {
    host.ariaDescribedby.set('reminders-hint');
    await fixture.whenStable();

    expect(input().getAttribute('aria-describedby')).toBe('reminders-hint');
  });

  it('toggles the value and filled host state on click', async () => {
    input().click();
    await fixture.whenStable();

    expect(host.value()).toBe(true);
    expect(root().hasAttribute('data-checked')).toBe(true);
    expect(root().hasAttribute('data-filled')).toBe(true);

    input().click();
    await fixture.whenStable();

    expect(host.value()).toBe(false);
    expect(root().hasAttribute('data-checked')).toBe(false);
    expect(root().hasAttribute('data-filled')).toBe(false);
  });

  it('follows programmatic value and size changes', async () => {
    host.value.set(true);
    host.size.set('lg');
    await fixture.whenStable();

    expect(input().checked).toBe(true);
    expect(root().getAttribute('data-size')).toBe('lg');
  });

  it('blocks interaction while disabled', async () => {
    host.disabled.set(true);
    await fixture.whenStable();

    input().click();
    await fixture.whenStable();

    expect(host.value()).toBe(false);
    expect(input().disabled).toBe(true);
    expect(root().hasAttribute('data-disabled')).toBe(true);
  });

  it('reflects invalid state to the host and native input', async () => {
    host.invalid.set(true);
    await fixture.whenStable();

    expect(root().hasAttribute('data-invalid')).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('supports aria-label and aria-labelledby', async () => {
    host.ariaLabel.set('Notifications');
    host.ariaLabelledby.set('settings-heading');
    await fixture.whenStable();

    expect(input().getAttribute('aria-label')).toBe('Notifications');
    expect(input().getAttribute('aria-labelledby')).toBe('settings-heading');
  });

  it('emits touch when focus leaves', async () => {
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();

    expect(host.touchCount).toBe(1);
  });

  it('focuses the native input through the public focus method', () => {
    host.switch().focus();

    expect(document.activeElement).toBe(input());
  });

  it('binds value, invalid, and touched state through Signal Forms', async () => {
    const formsFixture = TestBed.createComponent(SignalFormsHost);
    await formsFixture.whenStable();

    const formsHost = formsFixture.componentInstance;
    const switchRoot = (formsFixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-switch',
    );
    const switchInput = switchRoot?.querySelector<HTMLInputElement>('input');

    expect(switchRoot?.hasAttribute('data-invalid')).toBe(true);

    switchInput?.click();
    await formsFixture.whenStable();

    expect(formsHost.model().reminders).toBe(true);
    expect(formsHost.settingsForm.reminders().valid()).toBe(true);

    switchInput?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await formsFixture.whenStable();

    expect(formsHost.settingsForm.reminders().touched()).toBe(true);
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

    function label(): HTMLElement {
      const element = (linkFixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '.switch-label',
      );
      if (!element) {
        throw new Error('projected label not rendered');
      }
      return element;
    }

    function link(): HTMLAnchorElement {
      const element = (linkFixture.nativeElement as HTMLElement).querySelector('a');
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

describe('Switch styles', () => {
  const styles = readFileSync('src/switch.scss', 'utf8');
  const theme = (name: string): string =>
    readFileSync(`../../../themes/koureia/src/_${name}.scss`, 'utf8');

  // At `--surface` the thumb was the card under it in dark mode, so a disabled switch showed
  // only its outline.
  it('paints the thumb with its own token, which each theme sets', () => {
    const thumb = /\.switch-thumb \{[^}]*\}/.exec(styles)?.[0] ?? '';
    expect(thumb).toContain('background: var(--switch-thumb)');

    expect(theme('light')).toMatch(/--switch-thumb:/);
    const dark = /--switch-thumb:\s*([^;]+);/.exec(theme('dark'))?.[1];
    expect(dark).toBeDefined();
    expect(dark).not.toBe('var(--surface)');
  });
});

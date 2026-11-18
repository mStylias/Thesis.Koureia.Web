import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Toaster } from './toaster';
import { ToasterService } from './toaster.service';

// jsdom has no ResizeObserver; the toast measures itself with one.
class ResizeObserverStub {
  observe(): void {
    // noop
  }
  unobserve(): void {
    // noop
  }
  disconnect(): void {
    // noop
  }
}

// jsdom never backgrounds the tab, so `document.hidden` is stubbed.
let documentHidden = false;

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverStub;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => documentHidden,
  });
});

beforeEach(() => {
  documentHidden = false;
});

describe('ToasterService', () => {
  let service: ToasterService;

  beforeEach(() => {
    service = TestBed.inject(ToasterService);
  });

  it('adds toasts to the front of the stack', () => {
    service.success('Booking confirmed');
    const id = service.error('Slot no longer available');

    const toasts = service.toasts();
    expect(toasts.length).toBe(2);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].severity).toBe('error');
    expect(toasts[1].severity).toBe('success');
  });

  it('defaults to a closable, auto-dismissing secondary toast', () => {
    service.show({ message: 'Your barber is running late' });

    const toast = service.toasts()[0];
    expect(toast.severity).toBe('secondary');
    expect(toast.life).toBe(service.defaultLife());
    expect(toast.sticky).toBe(false);
    expect(toast.closable).toBe(true);
    expect(toast.loading).toBe(false);
  });

  it('creates sticky, non-closable loading toasts', () => {
    service.loading('Confirming your booking…');

    const toast = service.toasts()[0];
    expect(toast.loading).toBe(true);
    expect(toast.sticky).toBe(true);
    expect(toast.closable).toBe(false);
  });

  it('marks a toast for deletion on dismiss and drops it on remove', () => {
    const id = service.info('Kimonas has 3 slots left');

    service.dismiss(id);
    expect(service.toasts()[0].delete).toBe(true);

    service.remove(id);
    expect(service.toasts().length).toBe(0);
  });

  it('resolves a promise toast into a success toast', async () => {
    await service.promise(Promise.resolve('ok'), {
      loading: { message: 'Saving…' },
      success: (value) => ({ message: `Saved ${value}` }),
      error: { message: 'Failed' },
    });

    const toast = service.toasts()[0];
    expect(toast.severity).toBe('success');
    expect(toast.message).toBe('Saved ok');
    expect(toast.loading).toBe(false);
    expect(toast.sticky).toBe(false);
  });

  it('resolves a rejected promise toast into an error toast and rethrows', async () => {
    await expect(
      service.promise(Promise.reject(new Error('boom')), {
        loading: { message: 'Saving…' },
        success: { message: 'Saved' },
        error: { message: 'Could not save' },
      }),
    ).rejects.toThrow('boom');

    const toast = service.toasts()[0];
    expect(toast.severity).toBe('error');
    expect(toast.message).toBe('Could not save');
    expect(toast.loading).toBe(false);
  });
});

@Component({
  imports: [Toaster],
  template: `
    <button type="button" id="trigger">Fire</button>
    <lib-toaster />
  `,
})
class Host {}

@Component({
  imports: [Toaster],
  template: '<lib-toaster expand [life]="120" />',
})
class ExpandedHost {}

@Component({
  imports: [Toaster],
  template: '<lib-toaster ariaLabel="Booking updates" closeAriaLabel="Dismiss" />',
})
class NamedHost {}

/**
 * Both aria labels come from the lib's own scope, so every fixture needs a
 * root Transloco config — there is no global provider in a lib spec.
 */
function provideToasterTransloco(): void {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: {
          availableLangs: ['el', 'en'],
          defaultLang: 'en',
          fallbackLang: 'en',
          missingHandler: { useFallbackTranslation: true },
        },
      }),
    ],
  });
}

/**
 * The `toaster` scope loads through a dynamic import, and only a transformed
 * pipe registers its inline loader — so the fixture has to render before the
 * load, never the other way round.
 */
async function loadToasterScope(): Promise<void> {
  await firstValueFrom(TestBed.inject(TranslocoService).load('toaster/en'));
}

describe('Toaster', () => {
  beforeEach(() => {
    provideToasterTransloco();
  });

  it('renders fired toasts in a stack appended to the body', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.success('Booking confirmed for Friday at 17:30');
    await fixture.whenStable();

    const list = document.body.querySelector('ol.toaster');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('data-y-position')).toBe('bottom');
    expect(list?.getAttribute('data-x-position')).toBe('right');

    const toast = document.body.querySelector('li[lib-toast]');
    expect(toast?.getAttribute('data-severity')).toBe('success');
    expect(toast?.textContent).toContain('Booking confirmed for Friday at 17:30');

    fixture.destroy();
    expect(document.body.querySelector('ol.toaster')).toBeNull();
  });

  it('shows title and message separately when a title is set', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.error('That slot was just taken', 'Booking failed');
    await fixture.whenStable();

    const title = document.body.querySelector('.toast-title');
    const description = document.body.querySelector('.toast-description');
    expect(title?.textContent).toContain('Booking failed');
    expect(description?.textContent).toContain('That slot was just taken');

    fixture.destroy();
  });

  it('keeps toasts past the visible limit out of the tab order', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({
      message: 'Confirm your booking',
      sticky: true,
      action: { label: 'Confirm' },
    });
    service.info('Second');
    service.info('Third');
    service.info('Fourth');
    await fixture.whenStable();

    const toasts = [...document.body.querySelectorAll('li[lib-toast]')];
    expect(toasts).toHaveLength(4);

    // Newest first, so the sticky one is now the fourth — past the
    // default limit of three, faded out and non-interactive.
    const hidden = toasts[3];
    expect(hidden.getAttribute('data-visible')).toBe('false');
    expect(hidden.getAttribute('tabindex')).toBe('-1');
    expect(hidden.querySelector('.toast-action')?.getAttribute('tabindex')).toBe('-1');
    expect(hidden.querySelector('.toast-close')?.getAttribute('tabindex')).toBe('-1');

    expect(toasts[0].getAttribute('tabindex')).toBe('0');

    fixture.destroy();
  });

  it('holds the auto-dismiss timer while the tab is hidden', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({ message: 'Booking confirmed', life: 120 });
    await fixture.whenStable();

    documentHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();

    // Well past the toast's life plus the unmount delay.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();
    expect(service.toasts()).toHaveLength(1);

    documentHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();
    expect(service.toasts()).toHaveLength(0);

    fixture.destroy();
  });

  it('auto-dismisses toasts when the stack is always expanded', async () => {
    const fixture = TestBed.createComponent(ExpandedHost);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.success('Booking confirmed');
    await fixture.whenStable();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();

    expect(service.toasts()).toHaveLength(0);
    fixture.destroy();
  });

  it('names the stack and the close button from the lib scope', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({ message: 'Shop closed on 15 Aug', sticky: true });
    await fixture.whenStable();
    await loadToasterScope();
    await fixture.whenStable();

    expect(document.body.querySelector('ol.toaster')?.getAttribute('aria-label')).toBe(
      'Notifications',
    );
    expect(document.body.querySelector('.toast-close')?.getAttribute('aria-label')).toBe(
      'Close notification',
    );

    fixture.destroy();
  });

  it('lets the consumer override both names', async () => {
    const fixture = TestBed.createComponent(NamedHost);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({ message: 'Shop closed on 15 Aug', sticky: true });
    await fixture.whenStable();
    await loadToasterScope();
    await fixture.whenStable();

    expect(document.body.querySelector('ol.toaster')?.getAttribute('aria-label')).toBe(
      'Booking updates',
    );
    expect(document.body.querySelector('.toast-close')?.getAttribute('aria-label')).toBe('Dismiss');

    fixture.destroy();
  });

  it('keeps the stack a list even with its bullets removed', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    TestBed.inject(ToasterService).info('Kimonas has 3 slots left');
    await fixture.whenStable();

    // `list-style: none` drops list semantics in WebKit; the role restates it.
    expect(document.body.querySelector('ol.toaster')?.getAttribute('role')).toBe('list');

    fixture.destroy();
  });

  it('does not start a swipe from a press on a button icon', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    TestBed.inject(ToasterService).show({
      message: 'Shop closed on 15 Aug',
      sticky: true,
    });
    await fixture.whenStable();

    const toast = document.body.querySelector('li[lib-toast]');
    const icon = toast?.querySelector('.toast-close svg');
    if (!icon) {
      throw new Error('expected the close button icon to render');
    }

    // The icon fills the middle of the button, so this is the ordinary press.
    icon.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();

    expect(toast?.getAttribute('data-swiping')).toBe('false');

    fixture.destroy();
  });

  it('holds the auto-dismiss timer while a toast has keyboard focus', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({ message: 'Booking confirmed', life: 120 });
    await fixture.whenStable();

    const toast = document.body.querySelector<HTMLElement>('li[lib-toast]');
    if (!toast) {
      throw new Error('expected a toast to render');
    }
    toast.focus();
    await fixture.whenStable();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();
    expect(service.toasts()).toHaveLength(1);

    toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await fixture.whenStable();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();
    expect(service.toasts()).toHaveLength(0);

    fixture.destroy();
  });

  it('moves focus to the next toast when the focused one is dismissed', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({ message: 'Older', sticky: true });
    service.show({ message: 'Newer', sticky: true });
    await fixture.whenStable();

    const toasts = [...document.body.querySelectorAll<HTMLElement>('li[lib-toast]')];
    toasts[0].focus();

    const close = toasts[0].querySelector<HTMLElement>('.toast-close');
    if (!close) {
      throw new Error('expected a close button on a sticky toast');
    }
    close.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(toasts[1]);

    fixture.destroy();
  });

  it('returns focus outside the stack once the last toast is dismissed', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector('#trigger');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error('expected the trigger to render');
    }

    TestBed.inject(ToasterService).show({ message: 'Only', sticky: true });
    await fixture.whenStable();

    const toast = document.body.querySelector<HTMLElement>('li[lib-toast]');
    toast?.focus();
    // jsdom does not populate `relatedTarget` when focus() moves focus, and
    // that is the only record of where focus came from.
    toast?.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: trigger }));
    await fixture.whenStable();

    toast?.querySelector<HTMLElement>('.toast-close')?.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(trigger);

    fixture.destroy();
  });

  it('does not stay paused after the hovered stack empties', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.show({ message: 'First', life: 120 });
    await fixture.whenStable();

    const list = document.body.querySelector('ol.toaster');
    list?.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();

    // Dismissing by hand unmounts the whole `<ol>` under the pointer, so no
    // `mouseleave` ever arrives — the next toast must not inherit the pause.
    service.dismissAll();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await fixture.whenStable();
    expect(service.toasts()).toHaveLength(0);

    service.show({ message: 'Second', life: 120 });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();

    expect(service.toasts()).toHaveLength(0);

    fixture.destroy();
  });

  it('still pauses an always-expanded stack while it is hovered', async () => {
    const fixture = TestBed.createComponent(ExpandedHost);
    await fixture.whenStable();

    const service = TestBed.inject(ToasterService);
    service.success('Booking confirmed');
    await fixture.whenStable();

    const list = document.body.querySelector('ol.toaster');
    if (!list) {
      throw new Error('expected the toast stack to render');
    }
    list.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();
    expect(service.toasts()).toHaveLength(1);

    list.dispatchEvent(new MouseEvent('mouseleave'));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await fixture.whenStable();

    expect(service.toasts()).toHaveLength(0);
    fixture.destroy();
  });
});

describe('Toaster copy', () => {
  it('reads keys the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({
          'toaster.notifications': 'customer.notifications',
          'toaster.closeLabel': 'customer.closeToast',
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(
      { customer: { notifications: 'Your updates', closeToast: 'Got it' } },
      'en',
      { merge: true },
    );
    await fixture.whenStable();
    TestBed.inject(ToasterService).show({ message: 'Shop closed on 15 Aug', sticky: true });
    await fixture.whenStable();
    await loadToasterScope();
    await fixture.whenStable();

    expect(document.body.querySelector('ol.toaster')?.getAttribute('aria-label')).toBe(
      'Your updates',
    );
    expect(document.body.querySelector('.toast-close')?.getAttribute('aria-label')).toBe('Got it');
    fixture.destroy();
  });
});

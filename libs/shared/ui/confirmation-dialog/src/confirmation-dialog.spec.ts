import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideUiCopy } from '@util/ui-copy';
import { CONFIRMATION_CLOSE_DELAY } from './confirmation-dialog.constants';
import { ConfirmationService } from './confirmation-dialog.service';

// jsdom does not implement the <dialog> methods; the component drives
// the dialog with showModal()/close().
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

function dialogElement(): HTMLDialogElement | null {
  return document.body.querySelector('dialog.confirmation-dialog');
}

async function settle(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

/**
 * The `confirmationDialog` scope loads lazily via dynamic import — await it
 * so the translated default copy is in place before assertions run.
 */
async function loadCopy(lang = 'en'): Promise<void> {
  await firstValueFrom(TestBed.inject(TranslocoService).load(`confirmationDialog/${lang}`));
  await settle();
}

/** Waits out the exit transition so the service can tear the dialog down. */
async function closeDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_CLOSE_DELAY + 50));
}

describe('ConfirmationService', () => {
  let service: ConfirmationService;

  beforeEach(() => {
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
    service = TestBed.inject(ConfirmationService);
  });

  afterEach(() => {
    document.body.querySelectorAll('lib-confirmation-dialog').forEach((element) => {
      element.remove();
    });
  });

  it('opens a modal dialog with the given copy appended to the body', async () => {
    void service.open({
      title: 'Cancel booking?',
      message: 'Friday at 17:30 will be freed up.',
    });
    await settle();

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain('Cancel booking?');
    expect(dialog?.textContent).toContain('Friday at 17:30 will be freed up.');
  });

  it('falls back to the warning defaults', async () => {
    void service.open();
    await settle();
    await loadCopy();

    const dialog = dialogElement();
    expect(dialog?.getAttribute('data-severity')).toBe('warning');
    expect(dialog?.textContent).toContain('Confirm action');

    const buttons = dialog?.querySelectorAll('.dialog-actions button') ?? [];
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Cancel');
    expect(buttons[1].textContent).toContain('Confirm');
  });

  it('translates the default copy and the dismiss label', async () => {
    TestBed.inject(TranslocoService).setActiveLang('el');
    void service.open({ dismissible: true });
    await settle();
    await loadCopy('el');

    const dialog = dialogElement();
    // Defaults used to be hardcoded English regardless of the active lang.
    expect(dialog?.textContent).toContain('Επιβεβαίωση ενέργειας');
    expect(dialog?.textContent).toContain('Είστε βέβαιοι ότι θέλετε να συνεχίσετε;');
    expect(dialog?.querySelector('.dialog-dismiss')?.getAttribute('aria-label')).toBe(
      'Κλείσιμο διαλόγου',
    );

    const buttons = dialog?.querySelectorAll('.dialog-actions button') ?? [];
    expect(buttons[0].textContent).toContain('Άκυρο');
    expect(buttons[1].textContent).toContain('Επιβεβαίωση');
  });

  it('keeps caller-supplied copy over the translations', async () => {
    TestBed.inject(TranslocoService).setActiveLang('el');
    void service.open({ title: 'Ακύρωση ραντεβού;', confirmLabel: 'Ναι' });
    await settle();
    await loadCopy('el');

    const dialog = dialogElement();
    expect(dialog?.textContent).toContain('Ακύρωση ραντεβού;');
    expect(dialog?.textContent).not.toContain('Επιβεβαίωση ενέργειας');
    expect(dialog?.querySelector('.dialog-actions button:last-of-type')?.textContent).toContain(
      'Ναι',
    );
  });

  it("reads the caller's copy overrides through the injector it is given", async () => {
    TestBed.inject(TranslocoService).setTranslation(
      { customer: { title: 'Sure about this?', confirm: 'Yes, go ahead' } },
      'en',
      { merge: true },
    );
    const caller = Injector.create({
      parent: TestBed.inject(Injector),
      providers: [
        provideUiCopy({
          'confirmationDialog.title': 'customer.title',
          'confirmationDialog.confirmLabel': 'customer.confirm',
        }),
      ],
    });
    void service.open({}, caller);
    await settle();
    await loadCopy();

    const dialog = dialogElement();
    expect(dialog?.querySelector('.dialog-title')?.textContent).toContain('Sure about this?');
    expect(dialog?.querySelector('.dialog-actions button:last-of-type')?.textContent).toContain(
      'Yes, go ahead',
    );
    // The overrides stop at the call site: a dialog opened without them keeps its own copy.
    void service.open({});
    await settle();
    const plain = [...document.body.querySelectorAll('dialog.confirmation-dialog')].at(1);
    expect(plain?.querySelector('.dialog-title')?.textContent).toContain('Confirm action');
  });

  it('drops the heading and description for empty copy', async () => {
    void service.open({ title: '', message: '' });
    await settle();
    await loadCopy();

    const dialog = dialogElement();
    expect(dialog?.querySelector('.dialog-title')).toBeNull();
    expect(dialog?.querySelector('.dialog-message')).toBeNull();
    expect(dialog?.hasAttribute('aria-labelledby')).toBe(false);
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
    // Dropping the heading must not leave the dialog nameless — the
    // translated default title carries the name instead.
    expect(dialog?.getAttribute('aria-label')).toBe('Confirm action');
  });

  it('names itself from the heading rather than aria-label when one renders', async () => {
    void service.open({ title: 'Cancel booking?' });
    await settle();
    await loadCopy();

    const dialog = dialogElement();
    expect(dialog?.getAttribute('aria-labelledby')).toMatch(/^lib-confirmation-title-\d+$/);
    expect(dialog?.hasAttribute('aria-label')).toBe(false);
  });

  it('resolves with "confirmed" and removes the dialog on confirm', async () => {
    const result = service.open();
    await settle();

    const confirmButton = dialogElement()?.querySelector<HTMLButtonElement>(
      '.dialog-actions button:last-of-type',
    );
    confirmButton?.click();
    await closeDelay();

    await expect(result).resolves.toBe('confirmed');
    expect(dialogElement()).toBeNull();
  });

  it('resolves with "cancelled" on cancel', async () => {
    const result = service.open();
    await settle();

    const cancelButton = dialogElement()?.querySelector<HTMLButtonElement>(
      '.dialog-actions button:first-of-type',
    );
    cancelButton?.click();
    await closeDelay();

    await expect(result).resolves.toBe('cancelled');
  });

  it('resolves with "dismissed" through the × button when dismissible', async () => {
    const result = service.open({ dismissible: true });
    await settle();

    const dismissButton = dialogElement()?.querySelector<HTMLButtonElement>('.dialog-dismiss');
    expect(dismissButton).not.toBeNull();
    dismissButton?.click();
    await closeDelay();

    await expect(result).resolves.toBe('dismissed');
  });

  it('hides the × button and blocks Escape when not dismissible', async () => {
    void service.open();
    await settle();

    const dialog = dialogElement();
    expect(dialog?.querySelector('.dialog-dismiss')).toBeNull();

    dialog?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(dialogElement()?.open).toBe(true);
  });

  it('closes on Escape when dismissible', async () => {
    const result = service.open({ dismissible: true });
    await settle();

    dialogElement()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await closeDelay();

    await expect(result).resolves.toBe('dismissed');
  });

  it('renders a single confirm button when the cancel action is hidden', async () => {
    void service.open({ showCancel: false, confirmLabel: 'Got it' });
    await settle();

    const buttons = dialogElement()?.querySelectorAll('.dialog-actions button') ?? [];
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Got it');
  });
});

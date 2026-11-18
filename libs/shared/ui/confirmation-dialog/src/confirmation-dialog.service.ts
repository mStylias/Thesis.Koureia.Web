import {
  ApplicationRef,
  createComponent,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Injector,
  Service,
} from '@angular/core';
import { UI_COPY } from '@util/ui-copy';
import { ConfirmationDialog } from './confirmation-dialog';
import { CONFIRMATION_DEFAULTS } from './confirmation-dialog.constants';
import {
  ConfirmationConfig,
  ConfirmationResult,
  ResolvedConfirmationConfig,
} from './confirmation-dialog.types';

/**
 * Opens confirmation dialogs imperatively. Created on demand, appended to `<body>` and
 * destroyed on close, so nothing goes in the app shell.
 *
 * ```ts
 * import { ConfirmationService } from '@ui/confirmation-dialog';
 * ```
 *
 * ```ts
 * private readonly confirmation = inject(ConfirmationService);
 *
 * const result = await this.confirmation.open({
 *   title: 'Cancel booking?',
 *   message: 'Friday at 17:30 with Kimonas will be freed up.',
 *   severity: 'error',
 *   confirmLabel: 'Cancel booking',
 *   cancelLabel: 'Keep it',
 * });
 * if (result === 'confirmed') { … }
 * ```
 *
 * The dialog is created in the root environment, which a route's `provideUiCopy` does not reach.
 * Pass the caller's injector to give the default copy the caller's overrides:
 *
 * ```ts
 * private readonly injector = inject(Injector);
 *
 * await this.confirmation.open({ severity: 'error' }, this.injector);
 * ```
 */
@Service()
export class ConfirmationService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  /**
   * Opens a dialog; omitted `config` fields fall back to `CONFIRMATION_DEFAULTS`. Resolves
   * on close with how it closed: `confirmed`, `cancelled` or `dismissed`. `injector` supplies the
   * `provideUiCopy` overrides in force at the call site.
   */
  open(config: ConfirmationConfig = {}, injector?: Injector): Promise<ConfirmationResult> {
    const resolved: ResolvedConfirmationConfig = {
      ...CONFIRMATION_DEFAULTS,
      ...config,
    };

    return new Promise<ConfirmationResult>((resolve) => {
      const componentRef = createComponent(ConfirmationDialog, {
        environmentInjector: this.environmentInjector,
        // Only the copy crosses over, so nothing else of the caller's leaks into the dialog.
        elementInjector: injector
          ? Injector.create({ providers: [{ provide: UI_COPY, useValue: injector.get(UI_COPY) }] })
          : undefined,
      });
      componentRef.setInput('config', resolved);

      const subscription = componentRef.instance.closed.subscribe((result) => {
        subscription.unsubscribe();
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
        resolve(result);
      });

      this.appRef.attachView(componentRef.hostView);
      this.document.body.appendChild(componentRef.location.nativeElement);
    });
  }
}

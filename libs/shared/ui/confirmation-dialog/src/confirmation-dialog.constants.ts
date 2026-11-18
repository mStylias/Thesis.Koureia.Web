import { ResolvedConfirmationConfig } from './confirmation-dialog.types';

/**
 * Behavioral defaults only. The copy is deliberately absent: the dialog
 * renders its own translated defaults for anything the caller omits, which
 * a module-level constant cannot do (it would be frozen to one language).
 * Pass an empty string to drop the title or message altogether.
 */
export const CONFIRMATION_DEFAULTS: ResolvedConfirmationConfig = {
  severity: 'warning',
  showIcon: true,
  showCancel: true,
  dismissible: false,
};

/** Time the exit transition gets before the dialog is torn down (--dur-fast). */
export const CONFIRMATION_CLOSE_DELAY = 140;

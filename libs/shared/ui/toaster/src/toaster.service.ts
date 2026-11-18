import { Service, signal } from '@angular/core';
import {
  ToastData,
  ToastOptions,
  ToastPromiseMessage,
  ToastPromiseOptions,
  ToastSeverity,
} from './toaster.types';
import { TOAST_LIFETIME } from './toaster.constants';

/**
 * Global toast queue for the design system. Place a single
 * `<lib-toaster>` in the app shell, then trigger toasts from anywhere:
 *
 * ```ts
 * import { ToasterService } from '@ui/toaster';
 *
 * private readonly toaster = inject(ToasterService);
 *
 * this.toaster.success('Booking confirmed');
 * this.toaster.error('Slot no longer available', 'Booking failed');
 * await this.toaster.promise(save(), {
 *   loading: { message: 'Saving booking…' },
 *   success: { message: 'Booking saved' },
 *   error: { message: 'Could not save booking' },
 * });
 * ```
 */
@Service()
export class ToasterService {
  private idCounter = 0;

  /** Newest first — the front of the stack is index 0. */
  readonly toasts = signal<readonly ToastData[]>([]);
  readonly defaultLife = signal(TOAST_LIFETIME);

  /** Shows a success (green) toast. Returns the toast id. */
  success(message: string, title?: string): string {
    return this.show({ severity: 'success', message, title });
  }

  /** Shows an info (blue) toast. Returns the toast id. */
  info(message: string, title?: string): string {
    return this.show({ severity: 'info', message, title });
  }

  /** Shows a warning (amber) toast. Returns the toast id. */
  warning(message: string, title?: string): string {
    return this.show({ severity: 'warning', message, title });
  }

  /** Shows an error (red) toast. Returns the toast id. */
  error(message: string, title?: string): string {
    return this.show({ severity: 'error', message, title });
  }

  /** Sticky spinner toast; resolve it with `dismiss()` or `promise()`. */
  loading(message: string, title?: string): string {
    const id = this.show({
      severity: 'info',
      message,
      title,
      sticky: true,
      life: 0,
      closable: false,
    });
    this.patch(id, { loading: true });
    return id;
  }

  /** Shows a fully configured toast. Returns the toast id. */
  show(options: ToastOptions): string {
    const toast: ToastData = {
      id: this.nextId(),
      severity: options.severity ?? 'secondary',
      title: options.title,
      message: options.message,
      life: options.life ?? this.defaultLife(),
      sticky: options.sticky ?? false,
      closable: options.closable ?? true,
      loading: false,
      createdAt: Date.now(),
      action: options.action,
    };

    this.toasts.update((current) => [toast, ...current]);
    return toast.id;
  }

  /** Shows a loading toast that resolves into a success or error toast. */
  async promise<T>(task: Promise<T>, options: ToastPromiseOptions<T>): Promise<T> {
    const id = this.loading(options.loading.message, options.loading.title);

    try {
      const value = await task;
      const success = this.resolvePromiseMessage(options.success, value);
      this.patch(id, this.toResolvedToast(success, 'success'));
      return value;
    } catch (error) {
      const failure = this.resolvePromiseMessage(options.error, error);
      this.patch(id, this.toResolvedToast(failure, 'error'));
      throw error;
    }
  }

  /** Animates the toast out; the component removes it once finished. */
  dismiss(id: string): void {
    const toast = this.toasts().find((item) => item.id === id);
    if (!toast || toast.delete) {
      return;
    }

    this.toasts.update((current) =>
      current.map((item) => (item.id === id ? { ...item, delete: true } : item)),
    );
  }

  dismissAll(): void {
    this.toasts.update((current) => current.map((toast) => ({ ...toast, delete: true })));
  }

  /** Drops the toast immediately, without the exit animation. */
  remove(id: string): void {
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }

  private patch(id: string, patch: Partial<ToastData>): void {
    this.toasts.update((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  private resolvePromiseMessage<T>(
    message: ToastPromiseMessage | ((value: T) => ToastPromiseMessage),
    value: T,
  ): ToastPromiseMessage {
    return typeof message === 'function' ? message(value) : message;
  }

  private toResolvedToast(
    message: ToastPromiseMessage,
    fallbackSeverity: ToastSeverity,
  ): Partial<ToastData> {
    return {
      severity: message.severity ?? fallbackSeverity,
      title: message.title,
      message: message.message,
      loading: false,
      sticky: false,
      life: this.defaultLife(),
      closable: true,
    };
  }

  private nextId(): string {
    this.idCounter += 1;
    return `lib-toast-${this.idCounter}`;
  }
}

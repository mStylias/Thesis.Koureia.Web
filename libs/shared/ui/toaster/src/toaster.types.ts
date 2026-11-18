/** Semantic color. Mirrors the design system's button severities. */
export type ToastSeverity = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';

export type ToasterPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type SwipeDirection = 'top' | 'right' | 'bottom' | 'left' | 'up' | 'down';

export interface ToastAction {
  label: string;
  onClick?: (event: MouseEvent) => void;
}

/** Internal: measured toast heights drive the stack offsets. */
export interface ToastHeight {
  toastId: string;
  height: number;
  position: ToasterPosition;
}

export interface ToastData {
  id: string;
  severity: ToastSeverity;
  title?: string;
  message: string;
  /** Auto-dismiss delay in ms. `0` disables auto-dismiss. */
  life: number;
  /** Sticky toasts never auto-dismiss and show a close button. */
  sticky: boolean;
  closable: boolean;
  /** Shows a spinner instead of the severity icon. */
  loading: boolean;
  createdAt: number;
  /** Marked by the service; the toast animates out, then removes itself. */
  delete?: boolean;
  action?: ToastAction;
}

export interface ToastOptions {
  severity?: ToastSeverity;
  title?: string;
  message: string;
  life?: number;
  sticky?: boolean;
  closable?: boolean;
  action?: ToastAction;
}

export interface ToastPromiseMessage {
  title?: string;
  message: string;
  severity?: ToastSeverity;
}

export interface ToastPromiseOptions<T = unknown> {
  loading: ToastPromiseMessage;
  success: ToastPromiseMessage | ((value: T) => ToastPromiseMessage);
  error: ToastPromiseMessage | ((error: unknown) => ToastPromiseMessage);
}

export function getDefaultSwipeDirections(position: ToasterPosition): SwipeDirection[] {
  const [y, x] = position.split('-') as [SwipeDirection, SwipeDirection];
  return [y, x].filter(Boolean);
}

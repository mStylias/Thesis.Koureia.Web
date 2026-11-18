import type { Signal } from '@angular/core';

export type DialogPosition =
  | 'center'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'top-left';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

/** Maximum surface height before the content region starts scrolling. */
export type DialogMaxHeight = 'sm' | 'md' | 'lg' | 'viewport';

export type DialogCloseReason = 'programmatic' | 'close-button' | 'escape' | 'backdrop';

export interface DialogClosedEvent {
  readonly reason: DialogCloseReason;
}

export interface DialogDragEndEvent {
  /** Horizontal free-drag offset from the selected position, in CSS pixels. */
  readonly x: number;
  /** Vertical free-drag offset from the selected position, in CSS pixels. */
  readonly y: number;
}

/** API exposed as the implicit value of `libDialogHeadless`. */
export interface DialogHeadlessContext {
  readonly maximized: Signal<boolean>;
  readonly fullScreen: Signal<boolean>;
  close(): void;
  maximize(): void;
  restore(): void;
  moveTo(position: DialogPosition): void;
}

export interface DialogHeadlessTemplateContext {
  readonly $implicit: DialogHeadlessContext;
}

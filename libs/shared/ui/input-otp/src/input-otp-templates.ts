import { Directive, inject, TemplateRef } from '@angular/core';

/** Template context handed to a custom cell renderer. */
export interface InputOtpCellContext {
  /** What the cell should show: the character, or the mask glyph, or `''`. */
  $implicit: string;
  /** The raw character behind the cell, `''` while empty. Ignores `mask`. */
  char: string;
  /** Zero-based position of the cell. */
  index: number;
  /** Whether the cell holds a character. */
  filled: boolean;
  /** Whether the caret (or the selection) currently covers the cell. */
  active: boolean;
}

/** Template context for the separator rendered between two cell groups. */
export interface InputOtpSeparatorContext {
  /** One-based position the separator follows, as given to `separatorAfter`. */
  $implicit: number;
}

/**
 * Custom rendering for the contents of each cell. The cell box, its
 * focus ring, and the caret stay with the component — the template only
 * replaces the glyph, so a custom renderer can never break the control:
 *
 * ```html
 * <lib-input-otp [(value)]="code">
 *   <ng-template libInputOtpCell let-char let-filled="filled">
 *     <span class="digit">{{ filled ? char : '·' }}</span>
 *   </ng-template>
 * </lib-input-otp>
 * ```
 */
@Directive({ selector: 'ng-template[libInputOtpCell]' })
export class InputOtpCellTemplate {
  readonly templateRef = inject<TemplateRef<InputOtpCellContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: InputOtpCellTemplate,
    _context: unknown,
  ): _context is InputOtpCellContext {
    return true;
  }
}

/**
 * Custom rendering for the group separators declared by `separatorAfter`.
 * Defaults to an en dash when omitted:
 *
 * ```html
 * <lib-input-otp [(value)]="code" [length]="6" [separatorAfter]="[3]">
 *   <ng-template libInputOtpSeparator><svg lucideMinus></svg></ng-template>
 * </lib-input-otp>
 * ```
 */
@Directive({ selector: 'ng-template[libInputOtpSeparator]' })
export class InputOtpSeparatorTemplate {
  readonly templateRef = inject<TemplateRef<InputOtpSeparatorContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: InputOtpSeparatorTemplate,
    _context: unknown,
  ): _context is InputOtpSeparatorContext {
    return true;
  }
}

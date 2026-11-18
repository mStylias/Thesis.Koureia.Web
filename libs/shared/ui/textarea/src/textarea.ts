import {
  afterEveryRender,
  booleanAttribute,
  Component,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { TextareaResize, TextareaSize } from './textarea.types';

/**
 * Design-system multi-line text input, applied as an attribute on a native `<textarea>` so
 * semantics, IME behaviour and form participation stay native and Signal Forms binds
 * straight to the element.
 *
 * ```ts
 * import { Textarea } from '@ui/textarea';
 * ```
 *
 * ```html
 * <textarea libTextarea placeholder="Notes"></textarea>
 * <textarea libTextarea size="sm" invalid></textarea>
 * <textarea libTextarea autoResize [formField]="form.notes"></textarea>
 * ```
 *
 * Composes with `@ui/form-field`'s label wrappers — give it `placeholder=" "` so the float
 * label can detect a value. `autoResize` grows the control to fit and hides the handle.
 */
@Component({
  // Attribute selector: the `textarea` element name cannot carry the lib prefix.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: 'textarea[libTextarea]',
  template: '',
  styleUrl: './textarea.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-resize]': 'autoResize() ? "none" : resize()',
    '[attr.data-auto-resize]': 'autoResize() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.aria-invalid]': 'invalid() ? true : null',
    // Keyboard and paste edits; programmatic writes are caught by afterEveryRender below.
    '(input)': 'resizeToContent()',
  },
})
export class Textarea {
  /** Control size on the shared form-control scale. Defaults to `md`. */
  readonly size = input<TextareaSize>('md');

  /** Invalid styling; also reflected as `aria-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Manual resize handle. Defaults to `vertical`; superseded by `autoResize`. */
  readonly resize = input<TextareaResize>('vertical');

  /** Grows to fit its content on every edit, hiding the scrollbar and the handle. */
  readonly autoResize = input(false, { transform: booleanAttribute });

  private readonly host = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  /**
   * Whether the inline height on the element is ours. Tracked so turning `autoResize` off
   * releases it without clobbering a height the consumer set.
   */
  private autoSized = false;

  /**
   * Inputs of the last fit. Only content and available width can change the resulting
   * height, so this is what earns a re-measure — see `resizeToContent`.
   */
  private lastFit?: { value: string; width: number };

  constructor() {
    // `value` is a DOM property, not reactive state, so re-fit after every render to catch
    // programmatic writes and the initial value.
    afterEveryRender(() => {
      this.resizeToContent();
    });
  }

  protected resizeToContent(): void {
    const element = this.host.nativeElement;
    if (!this.autoResize()) {
      // Hand the height back to the stylesheet, or the control freezes at the last
      // size auto-resize gave it.
      if (this.autoSized) {
        this.autoSized = false;
        this.lastFit = undefined;
        element.style.removeProperty('height');
      }
      return;
    }
    // The render hook fires on every change-detection pass, so a re-measure must be earned:
    // collapsing the box to read `scrollHeight` forces layout, and its two style writes feed
    // Storybook's `style` MutationObserver into a resize → write → grow → resize loop.
    const value = element.value;
    const width = element.clientWidth;
    if (this.lastFit?.value === value && this.lastFit.width === width) {
      return;
    }
    // Collapse first, so scrollHeight reflects the content and not the current box.
    element.style.height = 'auto';
    // `scrollHeight` covers content + padding but stops at the border, while the box is
    // border-box — writing it back bare leaves the control two hairlines short and clips
    // the last line, with the scrollbar that would reveal it hidden.
    const borders = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + borders}px`;
    this.autoSized = true;
    this.lastFit = { value, width };
  }
}

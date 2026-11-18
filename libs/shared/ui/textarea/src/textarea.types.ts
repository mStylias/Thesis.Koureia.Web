/** Control size, aligned with the InputText, Button, and Select sizes. */
export type TextareaSize = 'sm' | 'md' | 'lg';

/**
 * Manual resize affordance, mapped to the CSS `resize` property. Ignored
 * while `autoResize` is on, since the control then sizes itself.
 */
export type TextareaResize = 'vertical' | 'none' | 'both';

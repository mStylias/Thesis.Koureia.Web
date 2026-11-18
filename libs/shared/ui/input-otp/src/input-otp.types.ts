/** Control size, aligned with the Button, InputText, and InputNumber sizes. */
export type InputOtpSize = 'sm' | 'md' | 'lg';

/**
 * Characters the control accepts. Drives the `beforeinput` filter, the
 * paste sanitizer, and the mobile keyboard (`inputmode`).
 *
 * - `numeric` — `0-9`, numeric keypad. The usual SMS/authenticator code.
 * - `alphanumeric` — `0-9` plus `A-Z`/`a-z`, standard keyboard. Case is
 *   preserved; normalize in the consumer if the backend is case-insensitive.
 */
export type InputOtpCharset = 'numeric' | 'alphanumeric';

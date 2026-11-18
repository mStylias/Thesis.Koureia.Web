const GREEK_PHONE = /^\+30(\d{3})(\d{3})(\d{4})$/;

/**
 * A stored number as a read-only view shows it. A Greek number is grouped, `+30 690 000 0001`.
 * Any other number shows as stored.
 *
 * ```ts
 * formatPhone('+306912345678'); // '+30 691 234 5678'
 * ```
 */
export function formatPhone(phone: string): string {
  const match = GREEK_PHONE.exec(phone.replace(/\s+/g, ''));
  return match === null ? phone : `+30 ${match[1]} ${match[2]} ${match[3]}`;
}

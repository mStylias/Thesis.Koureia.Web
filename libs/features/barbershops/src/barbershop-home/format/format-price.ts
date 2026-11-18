/**
 * A price in the shop's currency, written the way the reader's locale writes it: `15 €` in Greek,
 * `€15` in English. A whole amount shows no decimals, and any other shows two.
 */
export function formatPrice(amount: number, currency: string, locale: string): string {
  if (!Number.isFinite(amount)) return '';

  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

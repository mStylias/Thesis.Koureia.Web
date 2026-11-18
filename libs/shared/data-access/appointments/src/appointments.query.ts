import type { AppointmentsQuery } from './appointments.types';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = /^[a-z_]+$/;

/**
 * The `$filter` expression for {@link AppointmentsQuery}.
 *
 * Written by hand, not through `odata-query`: `localDate` is an `Edm.Date` and takes an unquoted
 * literal, and the category facet needs an `any()` lambda. Values that do not match their literal
 * form are dropped, so a stored preset cannot inject an expression.
 *
 * @throws when `from` or `to` is not `YYYY-MM-DD`. The endpoint has no row cap, so a request
 * without a range reads the whole book.
 */
export function appointmentsFilter(query: AppointmentsQuery): string {
  if (!DATE.test(query.from) || !DATE.test(query.to)) {
    throw new Error(`appointments: invalid range ${query.from} – ${query.to}`);
  }
  const parts = [`localDate ge ${query.from}`, `localDate lt ${query.to}`];

  const staff = query.staffMemberIds.filter((id) => GUID.test(id));
  if (staff.length > 0) parts.push(`staffMemberId in (${staff.join(',')})`);

  const customers = query.customerIds.filter((id) => GUID.test(id));
  if (customers.length > 0) parts.push(`customerId in (${customers.join(',')})`);

  const statuses = query.statuses.filter((status) => STATUS.test(status));
  if (statuses.length > 0) {
    parts.push(`status in (${statuses.map((status) => `'${status}'`).join(',')})`);
  }

  const categories = query.categoryIds.filter((id) => GUID.test(id));
  if (categories.length > 0) {
    parts.push(`services/any(s: s/categoryId in (${categories.join(',')}))`);
  }

  return parts.join(' and ');
}

/**
 * The `$apply` expression for the per-day counts under the same query.
 *
 * The filter must sit inside `$apply`. A `$filter` beside it runs after the grouping.
 */
export function dayCountsApply(query: AppointmentsQuery): string {
  return `filter(${appointmentsFilter(query)})/groupby((localDate),aggregate($count as count))`;
}

/**
 * The `$filter` for one customer's appointments, at any date.
 *
 * @throws when `customerId` is not a GUID. The endpoint has no row cap, so a dropped filter would
 * read the whole book.
 */
export function customerAppointmentsFilter(customerId: string): string {
  if (!GUID.test(customerId)) {
    throw new Error(`appointments: invalid customer ${customerId}`);
  }
  return `customerId eq ${customerId}`;
}

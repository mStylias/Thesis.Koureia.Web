import { computed, inject, type Signal } from '@angular/core';
import { StaffAccessStore } from '@auth/data-access';

/**
 * The shop's active barbers, at least 1: the bars of a per-barber skeleton. A tab sizes the
 * skeleton and the loaded chart with one count, so the card keeps its height when the counts
 * match. An inactive barber rarely has a value in the period, so the count leaves them out.
 *
 * Call it in an injection context.
 */
export function injectStaffRows(): Signal<number> {
  const staff = inject(StaffAccessStore).staff;
  return computed(() => Math.max(1, staff().filter((member) => member.isActive).length));
}

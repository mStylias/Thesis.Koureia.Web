import type { AppointmentResponse } from '@api/customer-appointments';

import type { CompanyBookingOptionsResponse } from '../../data/booking.api.types';
import type { BookingTotals, ChosenService, RescheduleQuote } from '../booking.types';
import { barbersFor, chosenServices, totalsFor } from './booking-catalog';

/**
 * What a move costs, priced the way the server prices it.
 *
 * A service kept with the same barber keeps the price and length agreed at booking. A new
 * service, or a new barber, costs today's catalog price. With Anyone the server keeps the current
 * barber whenever they are free: free at the chosen slot, or, before a slot is chosen, able to do
 * the whole selection.
 *
 * `slotStaffIds` is who is free at the chosen slot, or `null` when no slot is chosen yet.
 */
export function rescheduleQuote(
  options: CompanyBookingOptionsResponse,
  serviceIds: readonly string[],
  staffMemberId: string | null,
  booked: AppointmentResponse,
  slotStaffIds: readonly string[] | null,
): RescheduleQuote {
  const barber = effectiveBarber(options, serviceIds, staffMemberId, booked, slotStaffIds);

  if (barber === null) {
    return {
      chosen: chosenServices(options, serviceIds, null),
      totals: totalsFor(options, serviceIds, null),
    };
  }

  const keepsBarber = barber === booked.staffMemberId;
  const bookedLines = new Map(booked.services.map((line) => [line.serviceId, line]));
  const chosen: ChosenService[] = chosenServices(options, serviceIds, barber).map((service) => {
    const line = keepsBarber ? bookedLines.get(service.id) : undefined;
    return line === undefined
      ? service
      : { ...service, price: line.price, durationMinutes: line.durationMinutes };
  });

  return { chosen, totals: sum(chosen) };
}

/** The barber the server will book: the one named, else the current one when it can keep them. */
function effectiveBarber(
  options: CompanyBookingOptionsResponse,
  serviceIds: readonly string[],
  staffMemberId: string | null,
  booked: AppointmentResponse,
  slotStaffIds: readonly string[] | null,
): string | null {
  if (staffMemberId !== null) return staffMemberId;

  if (slotStaffIds !== null) {
    return slotStaffIds.includes(booked.staffMemberId) ? booked.staffMemberId : null;
  }

  const canKeep = barbersFor(options, serviceIds).some(
    (candidate) => candidate.id === booked.staffMemberId,
  );
  return canKeep ? booked.staffMemberId : null;
}

function sum(services: readonly ChosenService[]): BookingTotals {
  return {
    durationMinutes: services.reduce((total, service) => total + service.durationMinutes, 0),
    price: services.reduce((total, service) => total + service.price, 0),
    exact: true,
  };
}

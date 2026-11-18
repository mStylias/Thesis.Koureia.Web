import type {
  BookableStaffMemberViewDto,
  BookingServiceViewDto,
  CompanyBookingOptionsResponse,
} from '../../data/booking.api.types';
import type { BookingTotals, ChosenService, ServiceGroupView } from '../booking.types';

/** Every bookable service, categorized or not, flattened. */
export function bookableServices(
  options: CompanyBookingOptionsResponse,
): readonly BookingServiceViewDto[] {
  return [
    ...options.serviceCategories.flatMap((category) => category.services),
    ...options.uncategorizedServices,
  ];
}

/** The service list as the step renders it: categories in order, uncategorized last. */
export function serviceGroups(options: CompanyBookingOptionsResponse): readonly ServiceGroupView[] {
  const groups: ServiceGroupView[] = options.serviceCategories.map((category) => ({
    id: category.id,
    name: category.name,
    services: category.services,
  }));

  if (options.uncategorizedServices.length > 0) {
    groups.push({ id: null, name: null, services: options.uncategorizedServices });
  }
  return groups;
}

/** Whether this barber performs every service in the set. An empty set is nobody's to perform. */
export function performsAll(
  barber: BookableStaffMemberViewDto,
  serviceIds: readonly string[],
): boolean {
  if (serviceIds.length === 0) return false;

  const offered = new Set(barber.offerings.map((offering) => offering.serviceId));
  return serviceIds.every((id) => offered.has(id));
}

/** The barbers who can take the whole selection, in the shop's own order. */
export function barbersFor(
  options: CompanyBookingOptionsResponse,
  serviceIds: readonly string[],
): readonly BookableStaffMemberViewDto[] {
  return options.barbers.filter((barber) => performsAll(barber, serviceIds));
}

/**
 * The chosen services with the price and duration that apply.
 *
 * With a barber chosen, their overrides win. With Anyone, the base values stand — see
 * {@link totalsFor} for why the total that goes with them is a floor rather than a promise.
 * The order is the customer's, because it is the order the services are performed in.
 */
export function chosenServices(
  options: CompanyBookingOptionsResponse,
  serviceIds: readonly string[],
  staffMemberId: string | null,
): readonly ChosenService[] {
  const catalog = new Map(bookableServices(options).map((service) => [service.id, service]));
  const barber =
    staffMemberId === null
      ? undefined
      : options.barbers.find((candidate) => candidate.id === staffMemberId);
  const overrides = new Map(
    (barber?.offerings ?? []).map((offering) => [offering.serviceId, offering]),
  );

  const chosen: ChosenService[] = [];
  for (const id of serviceIds) {
    const service = catalog.get(id);
    if (service === undefined) continue;

    const override = overrides.get(id);
    chosen.push({
      id,
      name: service.name,
      price: override?.price ?? service.price,
      durationMinutes: override?.durationMinutes ?? service.durationMinutes,
    });
  }
  return chosen;
}

/**
 * What the selection costs and how long it takes.
 *
 * `exact` is false only when no barber is chosen and the barbers who could take the selection do
 * not all charge the same. The number is then the lowest of them, which is what `από 25€` means.
 * Stating one barber's price as the price when another charges more is the thing to avoid.
 */
export function totalsFor(
  options: CompanyBookingOptionsResponse,
  serviceIds: readonly string[],
  staffMemberId: string | null,
): BookingTotals {
  if (staffMemberId !== null) {
    return sum(chosenServices(options, serviceIds, staffMemberId), true);
  }

  const candidates = barbersFor(options, serviceIds);
  if (candidates.length === 0) return sum(chosenServices(options, serviceIds, null), true);

  const perBarber = candidates.map((barber) =>
    sum(chosenServices(options, serviceIds, barber.id), true),
  );
  const cheapest = perBarber.reduce((best, totals) => (totals.price < best.price ? totals : best));
  const agree = perBarber.every(
    (totals) =>
      totals.price === cheapest.price && totals.durationMinutes === cheapest.durationMinutes,
  );

  return { ...cheapest, exact: agree };
}

function sum(services: readonly ChosenService[], exact: boolean): BookingTotals {
  return {
    durationMinutes: services.reduce((total, service) => total + service.durationMinutes, 0),
    price: services.reduce((total, service) => total + service.price, 0),
    exact,
  };
}
